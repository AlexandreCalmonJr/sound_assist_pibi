/**
 * SoundMaster Pro — Pink Noise AudioWorkletProcessor
 * ====================================================
 * Migração do ScriptProcessorNode (deprecated) para AudioWorklet.
 * Gera ruído rosa (densidade espectral ∝ 1/f) usando o algoritmo de
 * Voss-McCartney com 7 filtros de primeira ordem em paralelo.
 *
 * Este método é a aproximação mais eficiente computacionalmente para
 * ruído rosa no domínio digital — idêntico ao gerador do ARTA e REW.
 *
 * Protocolo (port.onmessage):
 *   { type: 'set-amplitude', value: 0.0–1.0 }
 *   { type: 'set-active',    value: bool }
 *
 * Protocolo (port.postMessage):
 *   { type: 'rms', value: number }  → emitido a cada 4096 amostras
 */

'use strict';

class PinkNoiseProcessor extends AudioWorkletProcessor {

    static get parameterDescriptors() {
        return [
            {
                name:         'amplitude',
                defaultValue: 0.25,
                minValue:     0,
                maxValue:     1,
                automationRate: 'k-rate'
            }
        ];
    }

    constructor() {
        super();
        // Filtros Voss-McCartney: 7 polos (produz inclinação -3dB/oitava)
        // Coeficientes optimizados por Paul Kellet para banda 20Hz–20kHz
        this._b = new Float64Array(7); // estados dos filtros (zero-init)

        this._active  = true;
        this._rmsBuf  = new Float32Array(4096);
        this._rmsIdx  = 0;

        this.port.onmessage = (e) => {
            if (e.data.type === 'set-active')    this._active    = !!e.data.value;
            if (e.data.type === 'set-amplitude') {
                // AudioParam nativa é preferida, mas suportamos override via mensagem
                this._ampOverride = Math.max(0, Math.min(1, e.data.value));
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0]?.[0];
        if (!output) return true;

        const amp = this._ampOverride ?? parameters.amplitude[0];

        if (!this._active) {
            output.fill(0);
            return true;
        }

        const b   = this._b;
        const len = output.length;

        for (let i = 0; i < len; i++) {
            // Ruído branco uniforme [-1, 1]
            const white = Math.random() * 2 - 1;

            // 7 filtros de 1ª ordem em paralelo (Voss-McCartney / Paul Kellet)
            b[0] = 0.99886 * b[0] + white * 0.0555179;
            b[1] = 0.99332 * b[1] + white * 0.0750759;
            b[2] = 0.96900 * b[2] + white * 0.1538520;
            b[3] = 0.86650 * b[3] + white * 0.3104856;
            b[4] = 0.55000 * b[4] + white * 0.5329522;
            b[5] = -0.7616 * b[5] - white * 0.0168980;
            // b[6] é actualizado após a soma (delay de 1 sample)
            const pink = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + white * 0.5362);
            b[6] = white * 0.115926;

            // Normalização: saída bruta tem RMS ≈ 0.22 → escalar para 0.25 × amp
            output[i] = pink * 0.115 * amp;

            // Acumula para relatório de RMS
            this._rmsBuf[this._rmsIdx++] = output[i];
            if (this._rmsIdx >= this._rmsBuf.length) {
                this._rmsIdx = 0;
                let sum = 0;
                for (let j = 0; j < this._rmsBuf.length; j++) sum += this._rmsBuf[j] ** 2;
                const rms = Math.sqrt(sum / this._rmsBuf.length);
                this.port.postMessage({ type: 'rms', value: rms });
            }
        }

        return true;
    }
}

registerProcessor('pink-noise-processor', PinkNoiseProcessor);
