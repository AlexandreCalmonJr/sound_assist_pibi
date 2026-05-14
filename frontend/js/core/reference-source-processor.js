// reference-source-processor.js
// AudioWorkletProcessor para alimentar a fonte de referência (loopback via WebSocket PCM)

class ReferenceSourceProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array(0);
        
        // Recebe PCM chunks enviados da thread principal (analyzer.js)
        this.port.onmessage = (event) => {
            if (event.data && event.data.type === 'pcm') {
                this._appendData(event.data.samples);
            }
        };
    }

    _appendData(newData) {
        const newBuffer = new Float32Array(this.buffer.length + newData.length);
        newBuffer.set(this.buffer, 0);
        newBuffer.set(newData, this.buffer.length);
        this.buffer = newBuffer;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0];

        // Se não tivermos dados suficientes, silêncio
        if (this.buffer.length < channel.length) {
            for (let i = 0; i < channel.length; i++) {
                channel[i] = 0;
            }
            return true;
        }

        // Toca o áudio disponível
        for (let i = 0; i < channel.length; i++) {
            channel[i] = this.buffer[i];
        }

        // Remove amostras já tocadas
        this.buffer = this.buffer.slice(channel.length);

        return true;
    }
}

registerProcessor('reference-source-processor', ReferenceSourceProcessor);
