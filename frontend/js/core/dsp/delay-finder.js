/**
 * SoundMaster Pro — DSP Utilities: Delay Finder (GCC-PHAT)
 * ==========================================================
 * Generalised Cross-Correlation with Phase Transform (GCC-PHAT)
 * para estimativa de delay entre dois sinais.
 * 
 * Algoritmo:
 * 1. FFT de ambos os sinais
 * 2. Cross-spectrum: Gxy = X * conj(Y)
 * 3. PHAT: normalizar pela magnitude (|Gxy|)
 * 4. IFFT para obter correlação
 * 5. Encontrar pico (delay)
 * 6. Interpolação parabólica para precisão sub-sample
 */

'use strict';

export const DelayFinder = {
    /**
     * Estima delay entre dois sinais usando GCC-PHAT
     * @param {Float64Array} signalA - sinal de referência
     * @param {Float64Array} signalB - sinal a ser alinhado
     * @param {number} sampleRate
     * @returns {{delaySamples: number, delayMs: number, confidence: number}}
     */
    findDelay(signalA, signalB, sampleRate) {
        const n = signalA.length;
        const fftSize = this._nextPow2(n * 2);
        const half = fftSize >>> 1;
        
        // FFT de ambos sinais
        const fftA = this._fft(signalA, fftSize);
        const fftB = this._fft(signalB, fftSize);
        
        // Cross-spectrum: Gxy = A * conj(B)
        const Gxy_re = new Float64Array(half);
        const Gxy_im = new Float64Array(half);
        
        for (let k = 0; k < half; k++) {
            Gxy_re[k] = fftA.re[k] * fftB.re[k] + fftA.im[k] * fftB.im[k];
            Gxy_im[k] = fftA.im[k] * fftB.re[k] - fftA.re[k] * fftB.im[k];
        }
        
        // PHAT: normalizar pela magnitude
        let maxMag = 0;
        for (let k = 0; k < half; k++) {
            const mag = Math.sqrt(Gxy_re[k] * Gxy_re[k] + Gxy_im[k] * Gxy_im[k]);
            if (mag > maxMag) maxMag = mag;
            
            if (mag > 1e-10) {
                Gxy_re[k] /= mag;
                Gxy_im[k] /= mag;
            }
        }
        
        // IFFT do cross-spectrum normalizado
        const corr = this._ifft(Gxy_re, Gxy_im);
        
        // Encontrar pico (busca na segunda metade para delay positivo)
        let peakIdx = 0;
        let peakVal = -Infinity;
        
        const searchStart = half;
        const searchEnd = fftSize;
        
        for (let i = searchStart; i < searchEnd; i++) {
            if (corr[i] > peakVal) {
                peakVal = corr[i];
                peakIdx = i;
            }
        }
        
        // Interpolação parabólica para precisão sub-sample
        if (peakIdx > 0 && peakIdx < corr.length - 1) {
            const alpha = corr[peakIdx - 1];
            const beta = corr[peakIdx];
            const gamma = corr[peakIdx + 1];
            const p = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
            peakIdx = peakIdx + p;
        }
        
        // Converter para delay em samples (compensar offset)
        const delaySamples = peakIdx - half;
        
        // Confiança baseada na relação pico/média
        let sum = 0;
        for (let i = 0; i < corr.length; i++) sum += corr[i];
        const avg = sum / corr.length;
        const confidence = avg > 0 ? Math.min(1, (peakVal / (avg * 10 + 1e-10))) : 0;
        
        return {
            delaySamples: Math.round(delaySamples),
            delayMs: (delaySamples / sampleRate) * 1000,
            confidence: Math.max(0, Math.min(1, confidence))
        };
    },

    /**
     * Estima delay no domínio da frequência (mais eficiente)
     * Usa apenas a fase (PHAT) sem cálculo completo de correlação
     */
    findDelayPHAT(signalA, signalB, sampleRate) {
        const n = signalA.length;
        const fftSize = this._nextPow2(n);
        
        // FFT
        const A = this._fft(signalA, fftSize);
        const B = this._fft(signalB, fftSize);
        
        // PHAT normalization
        const half = fftSize >>> 1;
        for (let k = 0; k < half; k++) {
            const mag = Math.sqrt(A.re[k] * A.re[k] + A.im[k] * A.im[k]);
            const phaseA = Math.atan2(A.im[k], A.re[k]);
            const phaseB = Math.atan2(B.im[k], B.re[k]);
            
            //-phase difference = phaseA - phaseB
            const phaseDiff = phaseA - phaseB;
            
            A.re[k] = Math.cos(phaseDiff);
            A.im[k] = Math.sin(phaseDiff);
        }
        
        // IFFT simplificado
        const corr = this._ifft(A.re, A.im);
        
        // Encontrar pico
        let peakIdx = half;
        let peakVal = corr[half];
        
        for (let i = half + 1; i < fftSize; i++) {
            if (corr[i] > peakVal) {
                peakVal = corr[i];
                peakIdx = i;
            }
        }
        
        const delaySamples = peakIdx - half;
        
        return {
            delaySamples: Math.round(delaySamples),
            delayMs: (delaySamples / sampleRate) * 1000,
            confidence: 0.8 // Simplified confidence
        };
    },

    _nextPow2(n) {
        let p = 1;
        while (p < n) p <<= 1;
        return p;
    },

    _fft(signal, size) {
        const re = new Float64Array(size);
        const im = new Float64Array(size);
        
        // Zero-pad
        for (let i = 0; i < signal.length && i < size; i++) {
            re[i] = signal[i];
        }
        
        // FFT (simplificada)
        this._fftCore(re, im);
        
        return { re, im };
    },

    _fftCore(re, im) {
        const n = re.length;
        
        // Bit-reversal
        for (let i = 0, j = 0; i < n; i++) {
            if (i < j) {
                let t = re[i]; re[i] = re[j]; re[j] = t;
                t = im[i]; im[i] = im[j]; im[j] = t;
            }
            let m = n >>> 1;
            while (m >= 1 && j >= m) { j -= m; m >>>= 1; }
            j += m;
        }
        
        // Butterfly
        for (let len = 2; len <= n; len <<= 1) {
            const half = len >>> 1;
            const ang = -Math.PI / half;
            
            for (let i = 0; i < n; i += len) {
                let wR = 1, wI = 0;
                const wbR = Math.cos(ang);
                const wbI = Math.sin(ang);
                
                for (let j = 0; j < half; j++) {
                    const uR = re[i + j];
                    const uI = im[i + j];
                    const vR = re[i + j + half] * wR - im[i + j + half] * wI;
                    const vI = re[i + j + half] * wI + im[i + j + half] * wR;
                    
                    re[i + j] = uR + vR;
                    im[i + j] = uI + vI;
                    re[i + j + half] = uR - vR;
                    im[i + j + half] = uI - vI;
                    
                    const nwR = wR * wbR - wI * wbI;
                    wI = wR * wbI + wI * wbR;
                    wR = nwR;
                }
            }
        }
    },

    _ifft(re, im) {
        const n = re.length;
        
        // Conjugado
        for (let i = 0; i < n; i++) im[i] = -im[i];
        
        // FFT
        this._fftCore(re, im);
        
        // Conjugado e escala
        const result = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            result[i] = -im[i] / n;
        }
        
        return result;
    }
};

export default DelayFinder;