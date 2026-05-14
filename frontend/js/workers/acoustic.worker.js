/**
 * SoundMaster Pro — Acoustic Analysis Worker
 * Cálculos matemáticos pesados executados em background thread.
 *
 * Mensagens recebidas:
 *   { type: 'calculate-rt60',           data: { buffer, sampleRate } }
 *   { type: 'calculate-rt60-schroeder', data: { buffer, sampleRate } }
 *   { type: 'deconvolve-sweep',         data: { recording, reference, sampleRate } }
 *
 * Mensagens enviadas:
 *   { type: 'rt60-result',     result: { rt60, t20, t30, edt, snr, curve, warning } }
 *   { type: 'ir-result',       result: { ir_db, schroeder, edt, t20, t30, rt60_est, snr_db, warning } }
 *   { type: 'error',           message: string }
 */

'use strict';

self.onmessage = function (e) {
    const { type, data } = e.data;

    try {
        if (type === 'calculate-rt60' || type === 'calculate-rt60-schroeder') {
            const result = _schroederRT60(data.buffer, data.sampleRate);
            self.postMessage({ type: 'rt60-result', result });

        } else if (type === 'deconvolve-sweep') {
            const result = _deconvolveSweep(data.recording, data.reference, data.sampleRate);
            self.postMessage({ type: 'ir-result', result });

        } else {
            self.postMessage({ type: 'error', message: `Tipo desconhecido: ${type}` });
        }
    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
};

// ─── Deconvolução ESS → IR (frontend) ────────────────────────────────────────

/**
 * Deconvolução espectral com regularização Tikhonov.
 * H(f) = conj(REF(f)) · REC(f) / (|REF(f)|² + ε)
 *
 * Retorna EDT, T20, T30, curva de Schroeder e IR em dB.
 */
function _deconvolveSweep(recording, reference, sampleRate) {
    const rec = Float64Array.from(recording);
    const ref = Float64Array.from(reference);
    const nFft = _nextPow2(rec.length + ref.length - 1);

    // FFT de ambos
    const [recRe, recIm] = _realFFT(rec, nFft);
    const [refRe, refIm] = _realFFT(ref, nFft);

    // Regularização: ε = 1e-4 × max(|REF|²)
    let maxRefPwr = 0;
    const h = (nFft >>> 1) + 1;
    for (let k = 0; k < h; k++) {
        const p = refRe[k] * refRe[k] + refIm[k] * refIm[k];
        if (p > maxRefPwr) maxRefPwr = p;
    }
    const eps = 1e-4 * maxRefPwr;

    // Filtro inverso H(f) = conj(REF) * REC / (|REF|² + ε)
    const hRe = new Float64Array(h);
    const hIm = new Float64Array(h);
    for (let k = 0; k < h; k++) {
        const refPwr = refRe[k] * refRe[k] + refIm[k] * refIm[k] + eps;
        // conj(REF) = (refRe, -refIm)
        const xRe = recRe[k] * refRe[k] + recIm[k] * refIm[k];   // Re(conj(REF)·REC)
        const xIm = recRe[k] * (-refIm[k]) - recIm[k] * refRe[k]; // Im → wrong sign, fix:
        // Re(conj(REF)·REC) = recRe·refRe + recIm·refIm
        // Im(conj(REF)·REC) = recIm·refRe - recRe·refIm
        hRe[k] = (recRe[k] * refRe[k] + recIm[k] * refIm[k]) / refPwr;
        hIm[k] = (recIm[k] * refRe[k] - recRe[k] * refIm[k]) / refPwr;
    }

    // IFFT → IR no domínio do tempo
    const ir = _irfft(hRe, hIm, nFft).slice(0, rec.length);

    // Localiza pico (onset)
    let peakIdx = 0, peakAmp = 0;
    for (let i = 0; i < ir.length; i++) {
        const a = Math.abs(ir[i]);
        if (a > peakAmp) { peakAmp = a; peakIdx = i; }
    }

    // Noise floor: primeiros 50 ms antes do pico
    const nNoise = Math.min(peakIdx, Math.floor(0.05 * sampleRate));
    let noiseEnergy = 0;
    for (let i = 0; i < nNoise; i++) noiseEnergy += rec[i] * rec[i];
    const noiseFloor = noiseEnergy / Math.max(nNoise, 1);
    const snrDb = 10 * Math.log10((peakAmp * peakAmp) / (noiseFloor + 1e-30));

    // Trunca IR a partir do pico
    const preSamples = Math.min(peakIdx, Math.floor(0.05 * sampleRate));
    const irTrunc = ir.slice(peakIdx - preSamples);

    // Schroeder backward integration
    const irSq = irTrunc.map(x => x * x);
    const schroeder = _backwardIntegrate(irSq);
    const maxS = schroeder[0] || 1e-30;
    const schroederDb = schroeder.map(v => 10 * Math.log10(v / maxS + 1e-30));

    // IR em dB normalizada
    const irMax = Math.max(...irTrunc.map(Math.abs)) || 1e-30;
    const irDb  = Array.from(irTrunc).map(v => 20 * Math.log10(Math.abs(v) / irMax + 1e-30));

    // Parâmetros de reverberação
    const rev = _revParams(schroederDb, sampleRate);

    // Clarity (C50, C80)
    const clarity = _clarity(irSq, sampleRate);

    // Speech Transmission Index (STI) approximation
    const stiMetrics = _approximateSTI(irSq, sampleRate);

    // Downsample para UI (máx 2000 pontos)
    const step = Math.max(1, Math.floor(schroederDb.length / 1000));
    const schDownsampled = schroederDb.filter((_, i) => i % step === 0);
    const irDownsampled  = irDb.filter((_, i) => i % Math.max(1, Math.floor(irDb.length / 2000)) === 0);

    return {
        ir_db:      irDownsampled,
        schroeder:  schDownsampled,
        edt:        rev.edt,
        t20:        rev.t20,
        t30:        rev.t30,
        rt60_est:   rev.rt60_est,
        c50:        clarity.c50,
        c80:        clarity.c80,
        sti:        stiMetrics.sti,
        sti_category: stiMetrics.category,
        snr_db:     parseFloat(snrDb.toFixed(1)),
        warning:    rev.warning || (snrDb < 35 ? 'SNR baixo: resultado pode ser impreciso.' : null),
        duration_s: irTrunc.length / sampleRate,
    };
}

// ─── RT60 via Schroeder (pulso/ruído branco legado) ───────────────────────────

function _schroederRT60(buffer, sampleRate) {
    const n = buffer.length;
    const energy = new Float32Array(n);
    for (let i = 0; i < n; i++) energy[i] = buffer[i] * buffer[i];

    let peakEnergy = 0, peakIdx = 0;
    for (let i = 0; i < n; i++) {
        if (energy[i] > peakEnergy) { peakEnergy = energy[i]; peakIdx = i; }
    }

    const nNoise = Math.floor(sampleRate * 0.1);
    let noiseEnergy = 0;
    for (let i = 0; i < nNoise && i < peakIdx; i++) noiseEnergy += energy[i];
    const noiseFloorDb = 10 * Math.log10(Math.max(noiseEnergy / nNoise, 1e-12));
    const peakDb       = 10 * Math.log10(Math.max(peakEnergy, 1e-12));
    const snr          = peakDb - noiseFloorDb;

    // Schroeder desde o pico
    const schLen = n - peakIdx;
    const sch    = new Float64Array(schLen);
    let sum = 0;
    for (let i = n - 1; i >= peakIdx; i--) {
        sum += energy[i];
        sch[i - peakIdx] = sum;
    }

    const schDb = new Float32Array(schLen);
    const maxVal = sch[0] || 1e-12;
    for (let i = 0; i < schLen; i++) {
        schDb[i] = 10 * Math.log10(Math.max(sch[i] / maxVal, 1e-12));
    }

    const rev = _revParams(schDb, sampleRate);

    // C50, C80, STI
    const irSq = energy.slice(peakIdx);
    const clarity = _clarity(irSq, sampleRate);
    const stiMetrics = _approximateSTI(irSq, sampleRate);

    return {
        rt60:    rev.rt60_est ? parseFloat(rev.rt60_est.toFixed(2)) : null,
        t20:     rev.t20,
        t30:     rev.t30,
        edt:     rev.edt,
        c50:     clarity.c50,
        c80:     clarity.c80,
        sti:     stiMetrics.sti,
        sti_category: stiMetrics.category,
        snr:     snr.toFixed(1),
        warning: snr < 35 ? 'SNR Baixo: medição pode estar mascarada pelo ruído ambiente.' : null,
        curve:   Array.from(schDb).filter((_, i) => i % 100 === 0),
    };
}

// ─── Helpers DSP ─────────────────────────────────────────────────────────────

/** Parâmetros de reverberação a partir da curva de Schroeder em dB. */
function _revParams(schDb, sampleRate) {
    const n = schDb.length;

    function findLevel(target) {
        for (let i = 0; i < n; i++) if (schDb[i] <= target) return i;
        return null;
    }

    function slopeToRT(dbStart, dbEnd) {
        const i0 = findLevel(dbStart);
        const i1 = findLevel(dbEnd);
        if (i0 === null || i1 === null || i1 <= i0 + 3) return null;
        const duration = (i1 - i0) / sampleRate;
        const range    = Math.abs(dbEnd - dbStart);
        return parseFloat((duration / range * 60).toFixed(2));
    }

    const edt    = slopeToRT(0,  -10);
    const t20    = slopeToRT(-5, -25);
    const t30    = slopeToRT(-5, -35);
    const rt60_est = t30 ?? t20 ?? (edt != null ? parseFloat((edt * 6).toFixed(2)) : null);

    return { edt, t20, t30, rt60_est };
}

/** Integração de energia para Clarity (C50 e C80) */
function _clarity(irSq, sampleRate) {
    const totalEnergy = irSq.reduce((a, b) => a + b, 0);
    if (totalEnergy === 0) return { c50: 0, c80: 0 };

    const idx50 = Math.min(Math.floor(0.050 * sampleRate), irSq.length);
    const idx80 = Math.min(Math.floor(0.080 * sampleRate), irSq.length);

    let e50 = 0, e80 = 0;
    for (let i = 0; i < idx50; i++) e50 += irSq[i];
    for (let i = 0; i < idx80; i++) e80 += irSq[i];

    const late50 = totalEnergy - e50;
    const late80 = totalEnergy - e80;

    const c50 = late50 > 0 ? 10 * Math.log10(Math.max(e50 / late50, 1e-10)) : 20;
    const c80 = late80 > 0 ? 10 * Math.log10(Math.max(e80 / late80, 1e-10)) : 20;

    return { 
        c50: parseFloat(c50.toFixed(1)), 
        c80: parseFloat(c80.toFixed(1)) 
    };
}

/** Aproximação do Speech Transmission Index (STI) via MTF (Modulation Transfer Function) da resposta ao impulso. */
function _approximateSTI(irSq, sampleRate) {
    const totalEnergy = irSq.reduce((a, b) => a + b, 0);
    if (totalEnergy === 0) return { sti: 0, category: 'U' };

    // Frequências de modulação padrão do STI (bandas de oitava até 12.5 Hz)
    const fms = [0.63, 0.8, 1.0, 1.25, 1.6, 2.0, 2.5, 3.15, 4.0, 5.0, 6.3, 8.0, 10.0, 12.5];
    let sumTI = 0;

    for (const fm of fms) {
        let sumCos = 0, sumSin = 0;
        const omega = 2 * Math.PI * fm / sampleRate;
        for (let i = 0; i < irSq.length; i++) {
            const phase = omega * i;
            sumCos += irSq[i] * Math.cos(phase);
            sumSin += irSq[i] * Math.sin(phase);
        }
        
        const m = Math.sqrt(sumCos * sumCos + sumSin * sumSin) / totalEnergy;
        // Limit MTF between 0.001 and 0.999 to avoid Infinity
        const m_safe = Math.max(0.001, Math.min(0.999, m));
        
        let snrApp = 10 * Math.log10(m_safe / (1 - m_safe));
        snrApp = Math.max(-15, Math.min(15, snrApp));
        
        const ti = (snrApp + 15) / 30;
        sumTI += ti;
    }

    const sti = sumTI / fms.length;
    let category = 'U';
    if (sti >= 0.75) category = 'A (Excelente)';
    else if (sti >= 0.60) category = 'B (Bom)';
    else if (sti >= 0.45) category = 'C (Razoável)';
    else if (sti >= 0.30) category = 'D (Fraco)';
    else category = 'E (Ininteligível)';

    return { sti: parseFloat(sti.toFixed(2)), category };
}

/** Integração reversa de Schroeder. */
function _backwardIntegrate(energyArray) {
    const n = energyArray.length;
    const result = new Float64Array(n);
    let sum = 0;
    for (let i = n - 1; i >= 0; i--) {
        sum += energyArray[i];
        result[i] = sum;
    }
    return result;
}

/** FFT Cooley-Tukey radix-2 DIT in-place. */
function _fft(re, im) {
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
        const ang  = -Math.PI / half;
        const wbR  = Math.cos(ang), wbI = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let wR = 1, wI = 0;
            for (let j = 0; j < half; j++) {
                const uR = re[i + j], uI = im[i + j];
                const vR = re[i + j + half] * wR - im[i + j + half] * wI;
                const vI = re[i + j + half] * wI + im[i + j + half] * wR;
                re[i + j]        = uR + vR; im[i + j]        = uI + vI;
                re[i + j + half] = uR - vR; im[i + j + half] = uI - vI;
                const nwR = wR * wbR - wI * wbI;
                wI = wR * wbI + wI * wbR; wR = nwR;
            }
        }
    }
}

/** FFT de sinal real com zero-padding até nFft. */
function _realFFT(signal, nFft) {
    const re = new Float64Array(nFft);
    const im = new Float64Array(nFft);
    for (let i = 0; i < signal.length && i < nFft; i++) re[i] = signal[i];
    _fft(re, im);
    return [re, im];
}

/** IFFT de espectro half-complex → sinal real de comprimento nFft. */
function _irfft(hRe, hIm, nFft) {
    const h   = hRe.length;
    const re  = new Float64Array(nFft);
    const im  = new Float64Array(nFft);
    // Preenche espectro completo Hermitiano
    for (let k = 0; k < h; k++) {
        re[k] = hRe[k]; im[k] = hIm[k];
        if (k > 0 && k < nFft - h + 1) {
            re[nFft - k] =  hRe[k];
            im[nFft - k] = -hIm[k];
        }
    }
    // IFFT: conjuga → FFT → conjuga → escala
    for (let i = 0; i < nFft; i++) im[i] = -im[i];
    _fft(re, im);
    const inv = 1 / nFft;
    for (let i = 0; i < nFft; i++) { re[i] *= inv; im[i] *= -inv; }
    return re;
}

function _nextPow2(n) {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
}
