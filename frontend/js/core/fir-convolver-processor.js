/**
 * SoundMaster Pro — FIR Convolution AudioWorklet
 * ===============================================
 * Processa convolução FIR em tempo real usando Overlap-Add (OLA).
 * Suporta até 8192 taps para correção completa de fase.
 * 
 * Protocolo:
 *   port.onmessage: { type: 'set-ir', coefficients: Float32Array }
 *   port.onmessage: { type: 'set-bypass', value: bool }
 *   port.onmessage: { type: 'set-gain', value: float }
 */

'use strict';

class FIRConvolverProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        this._ir = null;
        this._irLen = 0;
        this._buffer = null;
        this._bufIdx = 0;
        this._bypass = false;
        this._gain = 1.0;
        
        this.port.onmessage = (e) => {
            if (e.data.type === 'set-ir') {
                this._setIR(e.data.coefficients);
            } else if (e.data.type === 'set-bypass') {
                this._bypass = !!e.data.value;
            } else if (e.data.type === 'set-gain') {
                this._gain = Math.max(0, Math.min(10, e.data.value));
            }
        };
        
        // Buffer de armazenamento para método Overlap-Add
        // Tamanho deve ser potência de 2 para performance
        this._blockSize = 128;
    }

    _setIR(coefficients) {
        if (!coefficients || coefficients.length === 0) {
            this._ir = null;
            this._irLen = 0;
            return;
        }
        
        this._ir = Float32Array.from(coefficients);
        this._irLen = this._ir.length;
        
        // Inicializa buffer de trabalho
        this._buffer = new Float32Array(this._blockSize + this._irLen);
        this._bufIdx = 0;
        
        console.log(`[FIR-Convolver] IR loaded: ${this._irLen} taps`);
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]?.[0];
        const output = outputs[0]?.[0];
        
        if (!input || !output) return true;
        
        const len = input.length;
        
        if (this._bypass || !this._ir) {
            // Bypass: copy input to output with gain
            for (let i = 0; i < len; i++) {
                output[i] = input[i] * this._gain;
            }
            return true;
        }

        // Overlap-Add Convolution
        const ir = this._ir;
        const irLen = this._irLen;
        const buf = this._buffer;
        
        for (let i = 0; i < len; i++) {
            // Adiciona nova amostra ao buffer de trabalho
            buf[this._bufIdx + i] = input[i];
            
            // Acumula saída (convolução parcial)
            let sum = 0;
            const maxTap = Math.min(this._bufIdx + i + 1, irLen);
            for (let j = 0; j < maxTap; j++) {
                sum += buf[this._bufIdx + i - j] * ir[j];
            }
            
            output[i] = sum * this._gain;
        }
        
        // Avança posição no buffer
        this._bufIdx += len;
        
        // Reset buffer quando excede IR length (evita grow perpétuo)
        if (this._bufIdx > irLen) {
            this._bufIdx = 0;
        }
        
        return true;
    }
}

registerProcessor('fir-convolver-processor', FIRConvolverProcessor);