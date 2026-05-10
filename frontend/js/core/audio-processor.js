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

        // ✅ Correção Auditoria: Acumular amostras para reduzir o volume de postMessage (throttle nativo)
        this._accBufferSize = 4096;
        this._accBuffer = new Float32Array(this._accBufferSize);
        this._accIdx = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            const inputChannel = input[0];
            
            // ✅ Correção Auditoria: Envia áudio bruto acumulado em vez de bloco a bloco (128 samples)
            // Isso reduz de ~375 msgs/sec para ~11 msgs/sec, melhorando muito a performance.
            for (let i = 0; i < inputChannel.length; i++) {
                this._accBuffer[this._accIdx++] = inputChannel[i];
                if (this._accIdx >= this._accBufferSize) {
                    this.port.postMessage({
                        type: 'raw-data',
                        buffer: this._accBuffer.slice()
                    });
                    this._accIdx = 0;
                }
            }

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
