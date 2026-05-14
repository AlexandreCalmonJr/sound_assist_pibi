/**
 * SoundMaster Pro — DSP Worklet Bundle
 * ====================================
 * Bundle combinado de funções DSP para uso em AudioWorklets.
 * Copie este conteúdo para dentro do seu AudioWorklet processor.
 * 
 * Origem: módulos em dsp/fft-worklet.js, dsp/windowing-worklet.js, dsp/spectrum-worklet.js
 * 
 *用法: Copie tudo a partir de "=== FFT ===" até "=== END ===" para dentro do seu .js do processor.
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════════════
// === FFT (Cooley-Tukey radix-2 DIT) ===
// ══════════════════════════════════════════════════════════════════════════════

const _TW_CACHE = new Map();

function _getTw(n) {
    if (_TW_CACHE.has(n)) return _TW_CACHE.get(n);
    const tw = { re: new Float64Array(n), im: new Float64Array(n) };
    for (let k = 0; k < n; k++) {
        const a = -2 * Math.PI * k / n;
        tw.re[k] = Math.cos(a);
        tw.im[k] = Math.sin(a);
    }
    _TW_CACHE.set(n, tw);
    return tw;
}

export const FFT = {
    forward(re, im) {
        const n = re.length;
        if ((n & (n - 1)) !== 0) throw new Error('FFT size must be power of 2');
        
        for (let i = 0, j = 0; i < n; i++) {
            if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
            let m = n >>> 1;
            while (m >= 1 && j >= m) { j -= m; m >>>= 1; }
            j += m;
        }
        
        for (let len = 2; len <= n; len <<= 1) {
            const half = len >>> 1;
            const tw = _getTw(len);
            for (let i = 0; i < n; i += len) {
                for (let k = 0; k < half; k++) {
                    const uR = re[i + k], uI = im[i + k];
                    const vR = re[i + k + half] * tw.re[k] - im[i + k + half] * tw.im[k];
                    const vI = re[i + k + half] * tw.im[k] + im[i + k + half] * tw.re[k];
                    re[i + k] = uR + vR; im[i + k] = uI + vI;
                    re[i + k + half] = uR - vR; im[i + k + half] = uI - vI;
                }
            }
        }
    },

    inverse(re, im) {
        for (let i = 0; i < re.length; i++) im[i] = -im[i];
        this.forward(re, im);
        const s = 1 / re.length;
        for (let i = 0; i < re.length; i++) { im[i] = -im[i] * s; re[i] *= s; }
    },

    forwardFloat32(input) {
        const re = Float64Array.from(input), im = new Float64Array(input.length);
        this.forward(re, im);
        return { re: Float32Array.from(re), im: Float32Array.from(im) };
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// === WINDOWING ===
// ══════════════════════════════════════════════════════════════════════════════

export function buildHann(N) {
    const w = new Float64Array(N), c = 2 * Math.PI / (N - 1);
    for (let i = 0; i < N; i++) w[i] = 0.5 * (1 - Math.cos(c * i));
    return w;
}

export function buildBlackmanHarris(N) {
    const w = new Float64Array(N), a = [0.35875, 0.48829, 0.14128, 0.01168], c = 2 * Math.PI / (N - 1);
    for (let i = 0; i < N; i++) w[i] = a[0] - a[1] * Math.cos(c * i) + a[2] * Math.cos(2 * c * i) - a[3] * Math.cos(3 * c * i);
    return w;
}

export function buildFlatTop(N) {
    const w = new Float64Array(N), a = [1.0, 1.9320, 1.2862, 0.3880, 0.0322], c = 2 * Math.PI / (N - 1);
    for (let i = 0; i < N; i++) {
        w[i] = (a[0] - a[1] * Math.cos(c * i) + a[2] * Math.cos(2 * c * i) - a[3] * Math.cos(3 * c * i) + a[4] * Math.cos(4 * c * i)) / 4.6384;
    }
    return w;
}

function _besselI0(x) {
    let s = 1, t = 1;
    for (let k = 1; k <= 30; k++) { t *= (x / (2 * k)) * (x / (2 * k)); s += t; if (t < 1e-15 * s) break; }
    return s;
}

export function buildKaiser(N, beta) {
    const w = new Float64Array(N), i0b = _besselI0(beta);
    for (let n = 0; n < N; n++) {
        const x = 2 * n / (N - 1) - 1;
        w[n] = _besselI0(beta * Math.sqrt(Math.max(0, 1 - x * x))) / i0b;
    }
    return w;
}

export function buildRectangular(N) { return new Float64Array(N).fill(1); }

export const Windowing = {
    create(type, N, opts = {}) {
        switch (type) {
            case 'hann': return buildHann(N);
            case 'blackman': return buildBlackmanHarris(N);
            case 'flattop': return buildFlatTop(N);
            case 'kaiser': return buildKaiser(N, opts.beta || 9);
            case 'rectangular': return buildRectangular(N);
            default: return buildBlackmanHarris(N);
        }
    },
    getAmplitudeNorm(w) { let s = 0; for (let i = 0; i < w.length; i++) s += w[i]; return 2.0 / (s + 1e-30); },
    getEnergyNorm(w) { let s = 0; for (let i = 0; i < w.length; i++) s += w[i] * w[i]; return 1.0 / (s + 1e-30); }
};

// ══════════════════════════════════════════════════════════════════════════════
// === SPECTRUM CALCULATOR ===
// ══════════════════════════════════════════════════════════════════════════════

export const Spectrum = {
    magnitudeDb(re, im, norm = 1.0) {
        const h = re.length >>> 1, res = new Float64Array(h);
        for (let i = 0; i < h; i++) res[i] = 20 * Math.log10(Math.sqrt(re[i] * re[i] + im[i] * im[i]) * norm + 1e-30);
        return res;
    },
    magnitudeLinear(re, im) {
        const h = re.length >>> 1, res = new Float64Array(h);
        for (let i = 0; i < h; i++) res[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
        return res;
    },
    phaseWrapped(re, im) {
        const h = re.length >>> 1, res = new Float64Array(h);
        for (let i = 0; i < h; i++) res[i] = Math.atan2(im[i], re[i]);
        return res;
    },
    phaseUnwrapped(wp) {
        const n = wp.length, res = new Float64Array(n);
        res[0] = wp[0];
        for (let i = 1; i < n; i++) {
            let d = wp[i] - wp[i - 1];
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            res[i] = res[i - 1] + d;
        }
        return res;
    },
    coherence(Gxy_re, Gxy_im, Gxx, Gyy) {
        const n = Gxy_re.length, res = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const gsq = Gxy_re[i] * Gxy_re[i] + Gxy_im[i] * Gxy_im[i];
            const den = Gxx[i] * Gyy[i];
            res[i] = den > 1e-30 ? Math.min(1, Math.max(0, gsq / den)) : 0;
        }
        return res;
    },
    leakySmooth(curr, prev, alpha) {
        const n = curr.length, res = new Float64Array(n);
        for (let i = 0; i < n; i++) res[i] = alpha * curr[i] + (1 - alpha) * prev[i];
        return res;
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// === END OF BUNDLE ===
// ══════════════════════════════════════════════════════════════════════════════

export default { FFT, Windowing, Spectrum };