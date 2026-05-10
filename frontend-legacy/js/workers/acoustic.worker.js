/**
 * SoundMaster Pro - Acoustic Analysis Worker
 * Cálculos matemáticos pesados em background.
 */
self.onmessage = function(e) {
    const { type, data } = e.data;

    if (type === 'calculate-rt60-schroeder') {
        const { buffer, sampleRate } = data;
        const rt60 = calculateSchroederRT60(buffer, sampleRate);
        self.postMessage({ type: 'rt60-result', result: rt60 });
    }
};

/**
 * Método de Schroeder: Integração reversa da energia
 */
function calculateSchroederRT60(buffer, sampleRate) {
    const n = buffer.length;
    const energy = new Float32Array(n);
    
    // 1. Eleva ao quadrado (Energia)
    for (let i = 0; i < n; i++) {
        energy[i] = buffer[i] * buffer[i];
    }

    // 2. Integração reversa (Schroeder)
    const schroeder = new Float32Array(n);
    let sum = 0;
    for (let i = n - 1; i >= 0; i--) {
        sum += energy[i];
        schroeder[i] = sum;
    }

    // 3. Converte para dB
    const schroederDb = new Float32Array(n);
    const maxVal = schroeder[0] || 1e-12;
    for (let i = 0; i < n; i++) {
        schroederDb[i] = 10 * Math.log10(Math.max(schroeder[i] / maxVal, 1e-12));
    }

    // 4. Regressão Linear entre -5dB e -35dB (T30)
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < n; i++) {
        if (startIdx === -1 && schroederDb[i] <= -5) startIdx = i;
        if (endIdx === -1 && schroederDb[i] <= -35) endIdx = i;
    }

    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
        return { error: 'Sinal muito curto ou ruidoso para medição precisa.' };
    }

    const durationSeconds = (endIdx - startIdx) / sampleRate;
    const decayPerSecond = 30 / durationSeconds; // T30 -> RT60 (30dB de queda extrapolado para 60dB)
    const rt60 = 60 / decayPerSecond;

    return {
        rt60: rt60.toFixed(2),
        t30: (durationSeconds * 2).toFixed(2),
        curve: schroederDb.filter((_, i) => i % 100 === 0) // Downsample para gráfico
    };
}
