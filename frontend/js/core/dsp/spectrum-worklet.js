/**
 * SoundMaster Pro — DSP Utilities: Spectrum Worklet-Ready
 * =========================================================
 * Cálculos de magnitude, fase, coerência e métricas espectrais.
 * Sem dependências externas - versão inline auto-contida.
 */

'use strict';

export const SpectrumWorklet = {
    /**
     * Calcula magnitude em dB a partir de espectro complexo
     * @param {Float64Array|Float32Array} re - Parte real
     * @param {Float64Array|Float32Array} im - Parte imaginária
     * @param {number} norm - Normalização (opcional)
     * @returns {Float64Array} magnitude em dB
     */
    magnitudeDb(re, im, norm = 1.0) {
        const n = re.length;
        const half = n >>> 1;
        const result = new Float64Array(half);
        
        for (let i = 0; i < half; i++) {
            const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]) * norm;
            result[i] = 20 * Math.log10(mag + 1e-30);
        }
        return result;
    },

    /**
     * Calcula magnitude linear (para coerência)
     * @param {Float64Array} re
     * @param {Float64Array} im
     * @returns {Float64Array}
     */
    magnitudeLinear(re, im) {
        const n = re.length;
        const half = n >>> 1;
        const result = new Float64Array(half);
        
        for (let i = 0; i < half; i++) {
            result[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
        }
        return result;
    },

    /**
     * Calcula fase enrolada (wrapped)
     * @param {Float64Array} re
     * @param {Float64Array} im
     * @returns {Float64Array} fase em radianos [-π, π]
     */
    phaseWrapped(re, im) {
        const n = re.length;
        const half = n >>> 1;
        const result = new Float64Array(half);
        
        for (let i = 0; i < half; i++) {
            result[i] = Math.atan2(im[i], re[i]);
        }
        return result;
    },

    /**
     * Desenrola a fase (unwrap) acumulando saltos > π
     * @param {Float64Array} wrappedPhase
     * @returns {Float64Array} fase desenrolada
     */
    phaseUnwrapped(wrappedPhase) {
        const n = wrappedPhase.length;
        const result = new Float64Array(n);
        result[0] = wrappedPhase[0];
        
        for (let i = 1; i < n; i++) {
            let diff = wrappedPhase[i] - wrappedPhase[i - 1];
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            result[i] = result[i - 1] + diff;
        }
        return result;
    },

    /**
     * Calcula Coerência (Magnitude-Squared Coherence)
     * γ² = |Gxy|² / (Gxx * Gyy)
     * 
     * @param {Float64Array} Gxy_re - Cross-spectrum real
     * @param {Float64Array} Gxy_im - Cross-spectrum imag
     * @param {Float64Array} Gxx - Auto-spectrum referência
     * @param {Float64Array} Gyy - Auto-spectrum medição
     * @returns {Float64Array} coerência 0-1
     */
    coherence(Gxy_re, Gxy_im, Gxx, Gyy) {
        const n = Gxy_re.length;
        const result = new Float64Array(n);
        
        for (let i = 0; i < n; i++) {
            const Gxy_sq = Gxy_re[i] * Gxy_re[i] + Gxy_im[i] * Gxy_im[i];
            const denom = Gxx[i] * Gyy[i];
            
            if (denom > 1e-30) {
                result[i] = Math.min(1, Math.max(0, Gxy_sq / denom));
            } else {
                result[i] = 0;
            }
        }
        return result;
    },

    /**
     * Aplica leaky integration (suavização temporal)
     * y[n] = α * x[n] + (1-α) * y[n-1]
     * 
     * @param {Float64Array} current - valor atual
     * @param {Float64Array} previous - valor anterior
     * @param {number} alpha - fator de suavização (0-1)
     * @returns {Float64Array} resultado suavizado
     */
    leakySmooth(current, previous, alpha) {
        const n = current.length;
        const result = new Float64Array(n);
        
        for (let i = 0; i < n; i++) {
            result[i] = alpha * current[i] + (1 - alpha) * previous[i];
        }
        return result;
    },

    /**
     * Calcula energia total do espectro
     * @param {Float64Array} magnitudeDb - magnitude em dB
     * @returns {number} energia total
     */
    totalEnergy(magnitudeDb) {
        let sum = 0;
        for (let i = 0; i < magnitudeDb.length; i++) {
            sum += Math.pow(10, magnitudeDb[i] / 10);
        }
        return sum;
    },

    /**
     * Calcula SPL ponderado (A, C ou Z)
     * @param {Float64Array} magnitudeDb
     * @param {number} sampleRate
     * @param {number} fftSize
     * @param {string} weighting - 'A', 'C', ou 'Z'
     * @returns {number} SPL em dB
     */
    calculateSPL(magnitudeDb, sampleRate, fftSize, weighting = 'A') {
        const hzPerBin = sampleRate / fftSize;
        let sumPower = 0;
        
        for (let i = 1; i < magnitudeDb.length; i++) {
            const freq = i * hzPerBin;
            const weight = this._getWeight(weighting, freq);
            const power = Math.pow(10, (magnitudeDb[i] + weight) / 10);
            sumPower += power;
        }
        
        return 10 * Math.log10(sumPower + 1e-30) + 94;
    },

    _getWeight(type, f) {
        if (type === 'Z' || f < 20) return 0;
        
        const f2 = f * f;
        const f4 = f2 * f2;
        const num = 12194 * 12194 * f4;
        const den = (f2 + 20.6 * 20.6) * 
                   Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * 
                   (f2 + 12194 * 12194);
        const rA = num / (den + 1e-30);
        
        return type === 'A' 
            ? 20 * Math.log10(rA + 1e-30) + 2.00
            : 0;
    }
};

export default SpectrumWorklet;