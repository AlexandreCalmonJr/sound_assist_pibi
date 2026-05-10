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

    // ✅ Correção Auditoria: 1.1 Encontrar o pico real do impulso (chegada do som)
    let peakEnergy = 0;
    let peakIdx = 0;
    for (let i = 0; i < n; i++) {
        if (energy[i] > peakEnergy) {
            peakEnergy = energy[i];
            peakIdx = i;
        }
    }

    // ✅ Novo: Cálculo do Noise Floor (ruído de fundo antes do impulso)
    // Pega os primeiros 100ms da gravação como referência de silêncio
    const noiseSamples = Math.floor(sampleRate * 0.1);
    let noiseEnergy = 0;
    for (let i = 0; i < noiseSamples && i < peakIdx; i++) {
        noiseEnergy += energy[i];
    }
    const noiseFloorDb = 10 * Math.log10(Math.max(noiseEnergy / noiseSamples, 1e-12));
    const peakDbActual = 10 * Math.log10(Math.max(peakEnergy, 1e-12));
    const snr = peakDbActual - noiseFloorDb;

    // 2. Integração reversa (Schroeder) SÓ a partir do pico
    const schroederLen = n - peakIdx;
    const schroeder = new Float32Array(schroederLen);
    let sum = 0;
    for (let i = n - 1; i >= peakIdx; i--) {
        sum += energy[i];
        schroeder[i - peakIdx] = sum;
    }

    // 3. Normalizar e converter para dB
    const schroederDb = new Float32Array(schroederLen);
    const maxVal = schroeder[0] || 1e-12;
    for (let i = 0; i < schroederLen; i++) {
        // Normalização: o início da curva de Schroeder deve ser 0dB
        schroederDb[i] = 10 * Math.log10(Math.max(schroeder[i] / maxVal, 1e-12));
    }

    // 4. Extração de T20 (-5dB a -25dB) para maior estabilidade em ambientes ruidosos
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < schroederLen; i++) {
        if (startIdx === -1 && schroederDb[i] <= -5) startIdx = i;
        if (endIdx === -1 && schroederDb[i] <= -25) endIdx = i;
    }

    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
        return { error: 'Sinal muito curto ou ruidoso para medição precisa.' };
    }

    const durationSeconds = (endIdx - startIdx) / sampleRate;
    // RT60 = T20 * 3 (extrapolando queda de 20dB para 60dB)
    const rt60 = durationSeconds * 3;

    return {
        rt60: rt60.toFixed(2),
        t30: (durationSeconds * 2).toFixed(2),
        snr: snr.toFixed(1),
        warning: snr < 35 ? 'SNR Baixo: medição pode estar mascarada pelo ruído ambiente.' : null,
        curve: schroederDb.filter((_, i) => i % 100 === 0) // Downsample para gráfico
    };
}
