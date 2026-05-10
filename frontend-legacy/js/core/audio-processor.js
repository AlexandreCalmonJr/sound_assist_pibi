/**
 * SoundMaster Pro - AudioWorkletProcessor
 * Processamento de alta performance em thread dedicada.
 */
class SoundMasterProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._bufferSize = 32768; // FFT Size
        this._buffer = new Float32Array(this._bufferSize);
        this._writeIndex = 0;
        
        // Pré-calcula a Janela de Hann para performance
        this._hannWindow = new Float32Array(this._bufferSize);
        for (let i = 0; i < this._bufferSize; i++) {
            this._hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (this._bufferSize - 1)));
        }
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            const inputChannel = input[0];
            
            // Envia o áudio bruto imediatamente (Essencial para captura de RT60 e decaimento real)
            this.port.postMessage({
                type: 'raw-data',
                buffer: inputChannel
            });

            for (let i = 0; i < inputChannel.length; i++) {
                this._buffer[this._writeIndex] = inputChannel[i];
                this._writeIndex++;

                if (this._writeIndex >= this._bufferSize) {
                    this._writeIndex = 0;
                    
                    // Aplica a Janela de Hann apenas para análise de espectro (FFT)
                    const windowedBuffer = new Float32Array(this._bufferSize);
                    for (let j = 0; j < this._bufferSize; j++) {
                        windowedBuffer[j] = this._buffer[j] * this._hannWindow[j];
                    }

                    this.port.postMessage({
                        type: 'analysis-data',
                        buffer: windowedBuffer
                    });
                }
            }
        }
        return true;
    }
}

registerProcessor('soundmaster-processor', SoundMasterProcessor);
