// reference-source-processor.js
// AudioWorkletProcessor para alimentar a fonte de referencia (loopback via WebSocket PCM).

class ReferenceSourceProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._buffer = new Float32Array(48000);
        this._readPtr = 0;
        this._writePtr = 0;
        this._available = 0;

        this.port.onmessage = (event) => {
            if (event.data && event.data.type === 'pcm') {
                this._appendSamples(event.data.samples);
            }
        };
    }

    _appendSamples(samples) {
        if (!samples || samples.length === 0) return;

        for (let i = 0; i < samples.length; i++) {
            this._buffer[this._writePtr] = samples[i];
            this._writePtr = (this._writePtr + 1) % this._buffer.length;

            if (this._available < this._buffer.length) {
                this._available++;
            } else {
                this._readPtr = (this._readPtr + 1) % this._buffer.length;
            }
        }
    }

    process(inputs, outputs) {
        const channel = outputs[0]?.[0];
        if (!channel) return true;

        for (let i = 0; i < channel.length; i++) {
            if (this._available > 0) {
                channel[i] = this._buffer[this._readPtr];
                this._readPtr = (this._readPtr + 1) % this._buffer.length;
                this._available--;
            } else {
                channel[i] = 0;
            }
        }

        return true;
    }
}

registerProcessor('reference-source-processor', ReferenceSourceProcessor);
