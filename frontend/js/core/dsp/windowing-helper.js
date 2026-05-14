/**
 * SoundMaster Pro — DSP Utilities: Windowing Helper
 * ==================================================
 * Funções de janelamento para análise espectral.
 * 
 * Tipos de janela suportados:
 * - Hann (von Hann): uso geral, bom equilíbrio
 * - Blackman-Harris (4-term): alta dinâmica para medições acústicas
 * - Flat-Top: máxima precisão de amplitude
 * - Kaiser-Bessel: controlo contínuo via β
 * - Rectangular: resolução máxima (para comparação)
 */

'use strict';

/**
 * Hann (von Hann): trade-off equilibrado entre resolução e vazamento.
 * w(n) = 0.5 · (1 - cos(2πn/N))
 * Sidelobe: -31.5 dBc | Resolução: 1.5 bins
 */
export function buildHann(N) {
    const w = new Float64Array(N);
    const c = 2 * Math.PI / (N - 1);
    for (let i = 0; i < N; i++) w[i] = 0.5 * (1 - Math.cos(c * i));
    return w;
}

/**
 * Blackman-Harris (4-term): alta dinâmica
 * Sidelobe: -92 dBc | Resolução: 2.0 bins
 */
export function buildBlackmanHarris(N) {
    const w = new Float64Array(N);
    const a = [0.35875, 0.48829, 0.14128, 0.01168];
    const c = 2 * Math.PI / (N - 1);
    for (let i = 0; i < N; i++) {
        w[i] = a[0]
             - a[1] * Math.cos(    c * i)
             + a[2] * Math.cos(2 * c * i)
             - a[3] * Math.cos(3 * c * i);
    }
    return w;
}

/**
 * Flat-Top (HFT95): máxima precisão de amplitude (+/−0.01 dB)
 * Sidelobe: -95 dBc | Resolução: 3.8 bins
 */
export function buildFlatTop(N) {
    const w = new Float64Array(N);
    const a = [1.0, 1.9320, 1.2862, 0.3880, 0.0322];
    const c = 2 * Math.PI / (N - 1);
    for (let i = 0; i < N; i++) {
        w[i] = a[0]
             - a[1] * Math.cos(    c * i)
             + a[2] * Math.cos(2 * c * i)
             - a[3] * Math.cos(3 * c * i)
             + a[4] * Math.cos(4 * c * i);
        w[i] /= 4.6384; // normaliza para max=1
    }
    return w;
}

/**
 * Kaiser-Bessel: controllable trade-off via β
 * β = 0 → rectangular | β = 6 → similar Hann | β = 9 → similar BH
 */
export function buildKaiser(N, beta) {
    const w = new Float64Array(N);
    const i0b = _besselI0(beta);
    for (let n = 0; n < N; n++) {
        const x = 2 * n / (N - 1) - 1;
        w[n] = _besselI0(beta * Math.sqrt(Math.max(0, 1 - x * x))) / i0b;
    }
    return w;
}

/**
 * Rectangular: máxima resolução, mínimo vazamento
 */
export function buildRectangular(N) {
    return new Float64Array(N).fill(1);
}

/** Função de Bessel modificada I₀ (série de Taylor) */
function _besselI0(x) {
    let sum = 1, term = 1;
    for (let k = 1; k <= 30; k++) {
        term *= (x / (2 * k)) * (x / (2 * k));
        sum += term;
        if (term < 1e-15 * sum) break;
    }
    return sum;
}

/**
 * Factory de janelas
 */
export const Windowing = {
    create(type, N, options = {}) {
        switch (type) {
            case 'hann':     return buildHann(N);
            case 'blackman': return buildBlackmanHarris(N);
            case 'flattop':  return buildFlatTop(N);
            case 'kaiser':   return buildKaiser(N, options.beta || 9);
            case 'rectangular': return buildRectangular(N);
            default:         return buildBlackmanHarris(N);
        }
    },

    /**
     * Calcula factor de normalização para amplitude correta
     * @param {Float64Array} window 
     * @returns {number}
     */
    getAmplitudeNorm(window) {
        let sum = 0;
        for (let i = 0; i < window.length; i++) sum += window[i];
        return 2.0 / (sum + 1e-30);
    },

    /**
     * Calcula factor de normalização para energia
     * @param {Float64Array} window 
     * @returns {number}
     */
    getEnergyNorm(window) {
        let sum = 0;
        for (let i = 0; i < window.length; i++) sum += window[i] * window[i];
        return 1.0 / (sum + 1e-30);
    },

    /**
     * Aplica janela a sinal
     * @param {Float64Array} signal 
     * @param {Float64Array} window 
     * @returns {Float64Array}
     */
    apply(signal, window) {
        const result = new Float64Array(signal.length);
        for (let i = 0; i < signal.length; i++) {
            result[i] = signal[i] * window[i];
        }
        return result;
    }
};

export default Windowing;