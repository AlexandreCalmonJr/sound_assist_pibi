// capture-processor.js
// Envia audio PCM de entrada para a thread principal sem usar ScriptProcessorNode.

class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._buffer = new Float32Array(4096);
        this._idx = 0;
        this._active = true;

        this.port.onmessage = (event) => {
            if (event.data && event.data.type === 'set-active') {
                this._active = !!event.data.value;
            }
        };
    }

    process(inputs, outputs) {
        const output = outputs[0]?.[0];
        if (output) output.fill(0);

        const input = inputs[0]?.[0];
        if (!this._active || !input) return true;

        for (let i = 0; i < input.length; i++) {
            this._buffer[this._idx++] = input[i];
            if (this._idx >= this._buffer.length) {
                const chunk = new Float32Array(this._buffer);
                this.port.postMessage({ type: 'pcm', samples: chunk }, [chunk.buffer]);
                this._idx = 0;
            }
        }

        return true;
    }
}

registerProcessor('capture-processor', CaptureProcessor);
