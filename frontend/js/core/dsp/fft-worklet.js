/**
 * SoundMaster Pro — DSP Utilities: FFT Worklet-Ready
 * ====================================================
 * FFT Cooley-Tukey radix-2 DIT otimizado para AudioWorklet.
 * Sem dependências externas - versão inline auto-contida.
 *
 * Para uso em AudioWorklets: simplesmente copie este código
 * para dentro do arquivo do processor.
 */

'use strict';

// Pre-computed twiddle factors para potências comuns de 2
const _TWIDDLE_CACHE = new Map();

function _getTwiddles(n) {
    if (_TWIDDLE_CACHE.has(n)) return _TWIDDLE_CACHE.get(n);
    
    const twiddles = { re: new Float64Array(n), im: new Float64Array(n) };
    for (let k = 0; k < n; k++) {
        const angle = -2 * Math.PI * k / n;
        twiddles.re[k] = Math.cos(angle);
        twiddles.im[k] = Math.sin(angle);
    }
    _TWIDDLE_CACHE.set(n, twiddles);
    return twiddles;
}

export const FFTWorklet = {
    /**
     * FFT direta in-place (Float64Array)
     * @param {Float64Array} re - Parte real (modificado in-place)
     * @param {Float64Array} im - Parte imaginária (modificado in-place)
     */
    forward(re, im) {
        const n = re.length;
        if (n === 0 || (n & (n - 1)) !== 0) {
            throw new Error('FFT size must be power of 2');
        }
        
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
            const tw = _getTwiddles(len);
            
            for (let i = 0; i < n; i += len) {
                for (let k = 0; k < half; k++) {
                    const uR = re[i + k];
                    const uI = im[i + k];
                    const vR = re[i + k + half] * tw.re[k] - im[i + k + half] * tw.im[k];
                    const vI = re[i + k + half] * tw.im[k] + im[i + k + half] * tw.re[k];
                    
                    re[i + k] = uR + vR;
                    im[i + k] = uI + vI;
                    re[i + k + half] = uR - vR;
                    im[i + k + half] = uI - vI;
                }
            }
        }
    },

    /**
     * FFT direta para Float32Array (converte para Float64, processa, converte de volta)
     * @param {Float32Array} input - Buffer de entrada
     * @returns {{re: Float32Array, im: Float32Array}}
     */
    forwardFloat32(input) {
        const n = input.length;
        const re = Float64Array.from(input);
        const im = new Float64Array(n);
        
        this.forward(re, im);
        
        return {
            re: Float32Array.from(re),
            im: Float32Array.from(im)
        };
    },

    /**
     * IFFT in-place
     * @param {Float64Array} re
     * @param {Float64Array} im
     */
    inverse(re, im) {
        const n = re.length;
        // Conjugado
        for (let i = 0; i < n; i++) im[i] = -im[i];
        
        // FFT
        this.forward(re, im);
        
        // Conjugado e escala
        const scale = 1 / n;
        for (let i = 0; i < n; i++) {
            im[i] = -im[i] * scale;
            re[i] *= scale;
        }
    },

    /**
     * Próximo power of 2
     * @param {number} n
     * @returns {number}
     */
    nextPow2(n) {
        let p = 1;
        while (p < n) p <<= 1;
        return p;
    }
};

export default FFTWorklet;