/**
 * SoundMaster Pro - Transfer Function Processor (AudioWorklet)
 * Implementação de Dual-Channel Transfer Function para alinhamento de sistemas.
 * Calcula: Cross-FFT, Phase Response, Coherence e Delay Finder.
 * 
 * Engenharia DSP: Alexandre Calmon Jr.
 */

class TransferFunctionProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._fftSize = 16384;
        this._hopSize = 4096; // Overlap de 75% para suavidade
        
        // Buffers de entrada
        this._refBuffer = new Float32Array(this._fftSize);
        this._measBuffer = new Float32Array(this._fftSize);
        this._writeIdx = 0;

        // Janelamento (Hann)
        this._window = new Float32Array(this._fftSize);
        for (let i = 0; i < this._fftSize; i++) {
            this._window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (this._fftSize - 1)));
        }

        // FFT Arrays (Complex)
        this._refFFT = { real: new Float32Array(this._fftSize), imag: new Float32Array(this._fftSize) };
        this._measFFT = { real: new Float32Array(this._fftSize), imag: new Float32Array(this._fftSize) };
        
        // Acumuladores para médias espectrais (Cross-Power e Auto-Power)
        // Necessários para o cálculo de Coerência e Transfer Function estável
        this._avgGxy = { real: new Float32Array(this._fftSize / 2), imag: new Float32Array(this._fftSize / 2) };
        this._avgGxx = new Float32Array(this._fftSize / 2);
        this._avgGyy = new Float32Array(this._fftSize / 2);
        this._avgWeight = 0.95; // Smoothing (Exponential Moving Average)

        this._isProcessing = false;
        
        // Delay Finder state
        this._delaySamples = 0;
        this._autoDelayEnabled = true;

        this._isDemoMode = false;
        this._demoDelaySamples = 480; // ~10ms de delay simulado para o demo
        
        // Estado do Filtro Simulado (Biquad LPF 2.5kHz)
        this._filterZ = [0, 0]; // Delay line
        this._filterCoefs = { 
            b0: 0.015, b1: 0.03, b2: 0.015, 
            a1: -1.65, a2: 0.71 
        };

        this.port.onmessage = (e) => {
            if (e.data.type === 'set-avg') this._avgWeight = e.data.value;
            if (e.data.type === 'set-demo-mode') this._isDemoMode = e.data.value;
        };
    }

    /**
     * Filtro Biquad Simples para a Simulação Digital
     */
    applyFilter(x) {
        const { b0, b1, b2, a1, a2 } = this._filterCoefs;
        const y = b0 * x + b1 * this._filterZ[0] + b2 * this._filterZ[1] - a1 * this._filterZ[0] - a2 * this._filterZ[1];
        this._filterZ[1] = this._filterZ[0];
        this._filterZ[0] = x;
        return y;
    }

    /**
     * Algoritmo FFT Radix-2 (In-place)
     */
    fft(real, imag) {
        const n = real.length;
        if (n <= 1) return;

        // Bit-reversal permutation
        for (let i = 0, j = 0; i < n; i++) {
            if (i < j) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
            }
            let m = n >> 1;
            while (m >= 1 && j >= m) {
                j -= m;
                m >>= 1;
            }
            j += m;
        }

        // Danielson-Lanczos algorithm
        for (let len = 2; len <= n; len <<= 1) {
            const ang = (2 * Math.PI) / len;
            const wlenReal = Math.cos(ang);
            const wlenImag = -Math.sin(ang); // Direção negativa para Forward FFT
            for (let i = 0; i < n; i += len) {
                let wReal = 1;
                let wImag = 0;
                for (let j = 0; j < len / 2; j++) {
                    const uReal = real[i + j];
                    const uImag = imag[i + j];
                    const vReal = real[i + j + len / 2] * wReal - imag[i + j + len / 2] * wImag;
                    const vImag = real[i + j + len / 2] * wImag + imag[i + j + len / 2] * wReal;
                    real[i + j] = uReal + vReal;
                    imag[i + j] = uImag + vImag;
                    real[i + j + len / 2] = uReal - vReal;
                    imag[i + j + len / 2] = uImag - vImag;
                    const nextWReal = wReal * wlenReal - wImag * wlenImag;
                    wImag = wReal * wlenImag + wImag * wlenReal;
                    wReal = nextWReal;
                }
            }
        }
    }

    /**
     * Inverse FFT (IFFT)
     */
    ifft(real, imag) {
        const n = real.length;
        // Conjugate
        for (let i = 0; i < n; i++) imag[i] = -imag[i];
        
        // Forward FFT
        this.fft(real, imag);
        
        // Conjugate and Scale
        for (let i = 0; i < n; i++) {
            real[i] /= n;
            imag[i] = -imag[i] / n;
        }
    }

    process(inputs, outputs, parameters) {
        // inputs[0] = Referência (AES67/Loopback)
        // inputs[1] = Medição (Microfone)
        const refInput = inputs[0];
        const measInput = inputs[1];

        // Se não houver entrada física mas estivermos em modo Demo, geramos ruído interno
        let refChannel = (refInput && refInput.length > 0) ? refInput[0] : null;
        let measChannel = (measInput && measInput.length > 0) ? measInput[0] : null;

        if (!refChannel && this._isDemoMode) {
            // Cria um bloco de ruído branco para manter a simulação viva
            refChannel = new Float32Array(128);
            for (let i = 0; i < 128; i++) refChannel[i] = (Math.random() * 2 - 1) * 0.5;
        }

        if (refChannel) {
            for (let i = 0; i < refChannel.length; i++) {
                this._refBuffer[this._writeIdx] = refChannel[i];
                
                if (this._isDemoMode) {
                    /**
                     * SIMULAÇÃO: 
                     * Pegamos o sinal de referência e aplicamos um atraso fixo 
                     * para que o Delay Finder tenha algo para encontrar.
                     */
                    const delayedIdx = (this._writeIdx - this._demoDelaySamples + this._fftSize) % this._fftSize;
                    const noise = (Math.random() * 2 - 1) * 0.01; 
                    
                    // Aplica o filtro Low-Pass para simular um crossover/driver real
                    const rawSignal = this._refBuffer[delayedIdx] + noise;
                    this._measBuffer[this._writeIdx] = this.applyFilter(rawSignal);
                } else {
                    this._measBuffer[this._writeIdx] = measChannel[i];
                }

                this._writeIdx++;
                if (this._writeIdx >= this._fftSize) {
                    this._writeIdx = 0;
                    this.computeTransferFunction();
                }
            }
        }

        return true;
    }

    computeTransferFunction() {
        const n = this._fftSize;
        const halfN = n / 2;

        // 1. Janelamento e Preparação
        const refReal = new Float32Array(n);
        const refImag = new Float32Array(n);
        const measReal = new Float32Array(n);
        const measImag = new Float32Array(n);

        for (let i = 0; i < n; i++) {
            refReal[i] = this._refBuffer[i] * this._window[i];
            measReal[i] = this._measBuffer[i] * this._window[i];
        }

        // 2. FFT de ambos os canais
        this.fft(refReal, refImag);
        this.fft(measReal, measImag);

        // 3. Cálculos Espectrais (Cross-Power e Auto-Power)
        const magnitude = new Float32Array(halfN);
        const phase = new Float32Array(halfN);
        const coherence = new Float32Array(halfN);

        // Arrays para Cross-Correlation (Delay Finder)
        const crossCorrReal = new Float32Array(n);
        const crossCorrImag = new Float32Array(n);

        for (let k = 0; k < halfN; k++) {
            // Conjugado de Ref * Meas (Gxy)
            // (a + bi)* * (c + di) = (a - bi) * (c + di) = (ac + bd) + (ad - bc)i
            const gxyReal = refReal[k] * measReal[k] + refImag[k] * measImag[k];
            const gxyImag = refReal[k] * measImag[k] - refImag[k] * measReal[k];

            // Auto-espectros (Gxx, Gyy)
            const gxx = refReal[k] * refReal[k] + refImag[k] * refImag[k];
            const gyy = measReal[k] * measReal[k] + measImag[k] * measImag[k];

            // Médias Exponenciais para suavização e coerência estável
            const alpha = this._avgWeight;
            this._avgGxy.real[k] = alpha * this._avgGxy.real[k] + (1 - alpha) * gxyReal;
            this._avgGxy.imag[k] = alpha * this._avgGxy.imag[k] + (1 - alpha) * gxyImag;
            this._avgGxx[k] = alpha * this._avgGxx[k] + (1 - alpha) * gxx;
            this._avgGyy[k] = alpha * this._avgGyy[k] + (1 - alpha) * gyy;

            // H(f) = Gxy / Gxx
            const hReal = this._avgGxy.real[k] / (this._avgGxx[k] + 1e-12);
            const hImag = this._avgGxy.imag[k] / (this._avgGxx[k] + 1e-12);

            magnitude[k] = 20 * Math.log10(Math.sqrt(hReal * hReal + hImag * hImag) + 1e-12);
            phase[k] = Math.atan2(hImag, hReal); // Resposta de Fase em Radianos

            // Coerência = |Gxy|^2 / (Gxx * Gyy)
            const gxyMagSq = this._avgGxy.real[k] * this._avgGxy.real[k] + this._avgGxy.imag[k] * this._avgGxy.imag[k];
            coherence[k] = (gxyMagSq / (this._avgGxx[k] * this._avgGyy[k] + 1e-12)) * 100;

            // Para o Delay Finder (usamos o espectro sem médias para resposta instantânea)
            crossCorrReal[k] = gxyReal;
            crossCorrImag[k] = gxyImag;
        }

        // 4. Delay Finder (Correlação Cruzada via IFFT)
        // Espelhamos para a segunda metade do buffer (hermitiano para sinal real)
        for (let k = 1; k < halfN; k++) {
            crossCorrReal[n - k] = crossCorrReal[k];
            crossCorrImag[n - k] = -crossCorrImag[k];
        }

        this.ifft(crossCorrReal, crossCorrImag);

        // Encontrar o pico da correlação
        let maxCorr = -1;
        let peakIdx = 0;
        for (let i = 0; i < n; i++) {
            const corrMag = crossCorrReal[i] * crossCorrReal[i] + crossCorrImag[i] * crossCorrImag[i];
            if (corrMag > maxCorr) {
                maxCorr = corrMag;
                peakIdx = i;
            }
        }

        // O pico pode estar na segunda metade (atraso negativo ou sinal cíclico)
        const delaySamples = peakIdx > halfN ? peakIdx - n : peakIdx;
        const delayMs = (delaySamples / sampleRate) * 1000;

        // Enviar dados para o Main Thread
        this.port.postMessage({
            type: 'transfer-function',
            magnitude,
            phase,
            coherence,
            delayMs,
            delaySamples
        });
    }
}

registerProcessor('transfer-function-processor', TransferFunctionProcessor);
