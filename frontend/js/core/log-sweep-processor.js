/**
 * SoundMaster Pro - Log-Sine Sweep Processor (AudioWorklet)
 * Gera um varrimento logarítmico de 20Hz a 20kHz com decaimento exponencial controlado.
 * Altíssima SNR para medição de resposta ao impulso.
 *
 * Engenharia DSP: Alexandre Calmon Jr.
 */
class LogSweepProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'amplitude', defaultValue: 0.8, minValue: 0, maxValue: 1.0, automationRate: 'k-rate' },
            { name: 'duration', defaultValue: 12, minValue: 2, maxValue: 30, automationRate: 'k-rate' },
            { name: 'startFreq', defaultValue: 20, minValue: 1, maxValue: 200, automationRate: 'k-rate' },
            { name: 'endFreq', defaultValue: 20000, minValue: 500, maxValue: 22050, automationRate: 'k-rate' },
            { name: 'fadeOutMs', defaultValue: 500, minValue: 100, maxValue: 2000, automationRate: 'k-rate' }
        ];
    }

    constructor() {
        super();

        this._sampleRate = sampleRate;
        this._phase = 0;

        this._sweepParams = {
            startFreq: 20,
            endFreq: 20000,
            duration: 12,
            amplitude: 0.8,
            fadeOutMs: 500
        };

        this._sweepActive = false;
        this._sweepStartTime = 0;
        this._sweepEndTime = 0;
        this._fadeOutStartTime = 0;
        this._isFadingOut = false;

        this._sweepBuffer = null;
        this._sweepBufferIndex = 0;

        this._playbackPhase = 0;
        this._isPlaying = false;

        this._captureBuffer = new Float32Array(sampleRate * 8);
        this._captureWriteIdx = 0;
        this._captureActive = false;

        this.port.onmessage = (e) => {
            const { type, data } = e.data;

            if (type === 'start-sweep') {
                this._buildSweepBuffer(data || {});
                this._captureWriteIdx = 0;
                this._captureActive = true;
            }

            if (type === 'stop-sweep') {
                this._sweepActive = false;
                this._isPlaying = false;
            }

            if (type === 'set-params') {
                Object.assign(this._sweepParams, data);
            }
        };
    }

    _buildSweepBuffer(params) {
        const { startFreq, endFreq, duration, amplitude, fadeOutMs } = { ...this._sweepParams, ...params };

        this._sweepParams = { startFreq, endFreq, duration, amplitude, fadeOutMs };

        const fs = this._sampleRate;
        const totalSamples = Math.ceil(fs * duration);
        const fadeOutSamples = Math.ceil(fs * (fadeOutMs / 1000));

        this._sweepBuffer = new Float32Array(totalSamples);

        const f0 = startFreq;
        const f1 = endFreq;
        const T = duration;

        const lnF0 = Math.log(f0);
        const lnF1 = Math.log(f1);
        const lnF1DivF0 = lnF1 - lnF0;

        for (let i = 0; i < totalSamples; i++) {
            const t = i / fs;
            const instantaneousFreq = f0 * Math.exp((lnF1DivF0 / T) * t);
            const phaseIncrement = (2 * Math.PI * instantaneousFreq) / fs;

            if (i === 0) {
                this._phase = 0;
            } else {
                this._phase += phaseIncrement;
            }

            let sample = Math.sin(this._phase);

            let envelope = 1.0;

            const fadeInSamples = Math.ceil(fs * 0.015);
            if (i < fadeInSamples) {
                const fadeProgress = i / fadeInSamples;
                envelope *= 0.5 * (1 - Math.cos(Math.PI * fadeProgress));
            }

            if (i >= totalSamples - fadeOutSamples) {
                const fadeOutProgress = (i - (totalSamples - fadeOutSamples)) / fadeOutSamples;
                envelope *= Math.exp(-8 * fadeOutProgress);
            }

            this._sweepBuffer[i] = sample * envelope * amplitude;
        }

        this._sweepBufferIndex = 0;
        this._sweepActive = true;
        this._isPlaying = true;
        this._sweepStartTime = currentTime;
        this._sweepEndTime = this._sweepStartTime + duration + (fadeOutMs / 1000);
        this._fadeOutStartTime = this._sweepStartTime + T;
        this._isFadingOut = false;

        this.port.postMessage({
            type: 'sweep-started',
            duration: T,
            startFreq,
            endFreq,
            totalSamples,
            fadeOutMs
        });
    }

    _generateSweepSample(t) {
        const { startFreq, endFreq, duration, amplitude, fadeOutMs } = this._sweepParams;

        const f0 = startFreq;
        const f1 = endFreq;
        const T = duration;
        const fs = this._sampleRate;

        const lnF0 = Math.log(f0);
        const lnF1 = Math.log(f1);
        const lnF1DivF0 = lnF1 - lnF0;

        const instantaneousFreq = f0 * Math.exp((lnF1DivF0 / T) * t);

        this._playbackPhase += (2 * Math.PI * instantaneousFreq) / fs;

        let sample = Math.sin(this._playbackPhase);

        let envelope = 1.0;
        const fadeInSamples = Math.ceil(fs * 0.015);
        if (t * fs < fadeInSamples) {
            const fadeProgress = (t * fs) / fadeInSamples;
            envelope *= 0.5 * (1 - Math.cos(Math.PI * fadeProgress));
        }

        const fadeOutSamples = Math.ceil(fs * (fadeOutMs / 1000));
        const fadeOutStart = T - (fadeOutMs / 1000);
        if (t > fadeOutStart) {
            const fadeOutProgress = (t - fadeOutStart) / (fadeOutMs / 1000);
            envelope *= Math.exp(-8 * fadeOutProgress);
        }

        return sample * envelope * amplitude;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        if (!output || output.length === 0) return true;

        const outputChannel = output[0];
        const input = inputs[0];
        const inputChannel = input && input.length > 0 ? input[0] : null;

        const blockSize = outputChannel.length;

        if (this._sweepActive && this._isPlaying) {
            for (let i = 0; i < blockSize; i++) {
                const t = (currentTime - this._sweepStartTime) + (i / this._sampleRate);

                if (t >= this._sweepParams.duration + (this._sweepParams.fadeOutMs / 1000)) {
                    this._sweepActive = false;
                    this._isPlaying = false;
                    outputChannel[i] = 0;
                    continue;
                }

                let sweepSample;
                if (this._sweepBuffer) {
                    const bufIdx = this._sweepBufferIndex + i;
                    if (bufIdx < this._sweepBuffer.length) {
                        sweepSample = this._sweepBuffer[bufIdx];
                    } else {
                        sweepSample = 0;
                    }
                } else {
                    sweepSample = this._generateSweepSample(t);
                }

                outputChannel[i] = sweepSample;

                if (inputChannel) {
                    this._captureBuffer[this._captureWriteIdx] = inputChannel[i];
                } else {
                    this._captureBuffer[this._captureWriteIdx] = 0;
                }

                this._captureWriteIdx++;

                if (this._captureWriteIdx >= this._captureBuffer.length) {
                    this._captureWriteIdx = this._captureBuffer.length - 1;
                }
            }

            this._sweepBufferIndex += blockSize;

        } else {
            for (let i = 0; i < blockSize; i++) {
                outputChannel[i] = 0;
                if (inputChannel) {
                    this._captureBuffer[this._captureWriteIdx] = inputChannel[i];
                    this._captureWriteIdx++;
                    if (this._captureWriteIdx >= this._captureBuffer.length) {
                        this._captureWriteIdx = this._captureBuffer.length - 1;
                    }
                }
            }
        }

        return true;
    }

    getSweepBuffer() {
        return this._sweepBuffer;
    }

    getCapturedAudio() {
        return this._captureBuffer.subarray(0, this._captureWriteIdx);
    }

    reset() {
        this._sweepActive = false;
        this._isPlaying = false;
        this._sweepBufferIndex = 0;
        this._playbackPhase = 0;
        this._captureWriteIdx = 0;
        this._captureActive = false;
    }
}

registerProcessor('log-sweep-processor', LogSweepProcessor);