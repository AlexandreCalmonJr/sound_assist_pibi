/**
 * SoundMaster Pro — Log-Sine Sweep Processor (AudioWorklet)
 *
 * Gera um varrimento logarítmico (Exponential Sine Sweep / ESS) de f0→f1
 * com altíssima SNR para medição de Resposta ao Impulso (IR).
 *
 * Teoria (Farina 2000):
 *   x(t) = A · sin[ 2π·f0·T/ln(f1/f0) · (e^(t·ln(f1/f0)/T) - 1) ]
 *
 * A fase é acumulada de forma exata sample a sample para evitar drift
 * de frequência instantânea que ocorre quando se recalcula sin(Δφ·t) por frame.
 *
 * Protocolo (port.onmessage):
 *   { type: 'start',  params: { f0, f1, duration, amplitude, silencePre, silencePost } }
 *   { type: 'stop'  }
 *   { type: 'get-reference' }  → retorna buffer do sweep gerado (para deconvolução)
 *
 * Protocolo (port.postMessage):
 *   { type: 'sweep-ready',   totalSamples, f0, f1, duration }
 *   { type: 'sweep-done',    recording: Float32Array, reference: Float32Array }
 *   { type: 'reference',     buffer: Float32Array }
 *   { type: 'progress',      pct: 0–100 }
 *
 * Entradas/Saídas:
 *   inputs[0][0]  → microfone capturado simultaneamente
 *   outputs[0][0] → sweep reproduzido
 */

'use strict';

const _DEFAULT = {
    f0:          20,      // Hz
    f1:          20000,   // Hz
    duration:    10,      // segundos (sweep)
    amplitude:   0.85,   // pico normalizado
    silencePre:  0.5,    // segundos de silêncio antes do sweep (noise floor)
    silencePost: 1.5,    // segundos de silêncio após o sweep (cauda reverberante)
    fadeInMs:    20,     // ms de fade-in para evitar click
    fadeOutMs:   100,    // ms de fade-out suave
};

class LogSweepProcessor extends AudioWorkletProcessor {

    static get parameterDescriptors() { return []; }

    constructor() {
        super();
        this._sr        = sampleRate;
        this._active    = false;
        this._sweepBuf  = null;   // Float32Array: sweep completo (com silêncios)
        this._refBuf    = null;   // Float32Array: apenas o sweep puro (para deconvolução)
        this._recBuf    = null;   // Float32Array: gravação do microfone
        this._playIdx   = 0;
        this._recIdx    = 0;
        this._totalSamples = 0;

        this.port.onmessage = (e) => this._onMsg(e.data);
    }

    // ─── Mensagens de controle ────────────────────────────────────────────────

    _onMsg(msg) {
        switch (msg.type) {
            case 'start':
                this._build(msg.params || {});
                break;
            case 'stop':
                this._finalize(true); // cancelamento antecipado
                break;
            case 'get-reference':
                if (this._refBuf) {
                    this.port.postMessage({ type: 'reference', buffer: this._refBuf.slice() },
                                         [this._refBuf.slice().buffer]);
                }
                break;
        }
    }

    // ─── Construção do buffer de sweep ───────────────────────────────────────

    /**
     * Gera o ESS usando acumulação de fase sample a sample.
     *
     *   Δφ(n) = 2π · f0 · exp(n/fs · ln(f1/f0)/T) / fs
     *   φ(n)  = Σ Δφ(k), k=0..n
     *   x(n)  = A · sin(φ(n))
     *
     * Este método é numericamente preciso: a freq. instantânea em cada sample
     * é f(t) = f0 · (f1/f0)^(t/T), garantindo a lei exponencial exata.
     */
    _build(params) {
        const p = { ..._DEFAULT, ...params };
        const fs = this._sr;

        const nPre   = Math.floor(p.silencePre  * fs);
        const nSweep = Math.floor(p.duration     * fs);
        const nPost  = Math.floor(p.silencePost  * fs);
        const nFadeI = Math.min(Math.floor(p.fadeInMs  / 1000 * fs), 256);
        const nFadeO = Math.min(Math.floor(p.fadeOutMs / 1000 * fs), 1024);
        const total  = nPre + nSweep + nPost;

        const sweep = new Float32Array(total);
        const ref   = new Float32Array(nSweep); // apenas sweep puro, sem silêncios

        const lnRatio = Math.log(p.f1 / p.f0);
        let phase = 0;

        for (let i = 0; i < nSweep; i++) {
            // Frequência instantânea no sample i
            const fInst = p.f0 * Math.exp((i / fs) * lnRatio / p.duration);
            // Incremento de fase: Δφ = 2π·f/fs
            phase += (2 * Math.PI * fInst) / fs;

            let sample = Math.sin(phase);

            // Envelope: fade-in Hann
            if (i < nFadeI) {
                sample *= 0.5 * (1 - Math.cos(Math.PI * i / nFadeI));
            }
            // Envelope: fade-out exponencial
            if (i >= nSweep - nFadeO) {
                const t = (i - (nSweep - nFadeO)) / nFadeO;
                sample *= Math.exp(-5 * t);
            }

            sample *= p.amplitude;
            sweep[nPre + i] = sample;
            ref[i]          = sample; // referência pura (sem silêncios)
        }

        this._sweepBuf     = sweep;
        this._refBuf       = ref;
        this._recBuf       = new Float32Array(total);
        this._playIdx      = 0;
        this._recIdx       = 0;
        this._totalSamples = total;
        this._active       = true;
        this._p            = p;

        this.port.postMessage({
            type:         'sweep-ready',
            totalSamples: total,
            nPre,
            nSweep,
            nPost,
            f0:           p.f0,
            f1:           p.f1,
            duration:     p.duration,
            sampleRate:   fs
        });
    }

    // ─── process() ───────────────────────────────────────────────────────────

    process(inputs, outputs) {
        const outCh = outputs[0]?.[0];
        const inCh  = inputs[0]?.[0];

        if (!outCh) return true;

        const bsz = outCh.length;

        if (!this._active) {
            outCh.fill(0);
            return true;
        }

        for (let i = 0; i < bsz; i++) {
            // Reprodução
            const sweepSample = (this._playIdx < this._totalSamples)
                ? this._sweepBuf[this._playIdx]
                : 0;
            outCh[i] = sweepSample;

            // Captura simultânea do microfone
            if (this._recIdx < this._totalSamples) {
                this._recBuf[this._recIdx] = inCh ? inCh[i] : 0;
            }

            this._playIdx++;
            this._recIdx++;
        }

        // Relatório de progresso a cada ~0.5 s (evita flood de mensagens)
        if ((this._playIdx % Math.floor(this._sr * 0.5)) < bsz) {
            const pct = Math.min(100, Math.round(this._playIdx / this._totalSamples * 100));
            this.port.postMessage({ type: 'progress', pct });
        }

        // Fim do sweep
        if (this._playIdx >= this._totalSamples) {
            this._finalize(false);
        }

        return true;
    }

    // ─── Finalização ─────────────────────────────────────────────────────────

    _finalize(cancelled) {
        this._active = false;

        if (cancelled) {
            this.port.postMessage({ type: 'sweep-cancelled' });
            return;
        }

        // Transfere os buffers via zero-copy
        const recCopy = this._recBuf.slice(0, this._recIdx);
        const refCopy = this._refBuf.slice();

        this.port.postMessage({
            type:      'sweep-done',
            recording: recCopy,
            reference: refCopy,
            sampleRate: this._sr,
            params:     this._p
        }, [recCopy.buffer, refCopy.buffer]);

        // Cleanup
        this._sweepBuf = null;
        this._recBuf   = null;
        this._refBuf   = null;
    }
}

registerProcessor('log-sweep-processor', LogSweepProcessor);