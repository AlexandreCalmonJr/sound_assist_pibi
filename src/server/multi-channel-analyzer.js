const aes67 = require('./aes67-service');
const ai = require('./ai-predictor');

class MultiChannelAnalyzer {
    constructor() {
        this.channelStats = Array(32).fill(0).map(() => ({
            rms: -100,
            peak: -100,
            spectralPeakHz: 0
        }));
    }

    init(io) {
        this.io = io;
        this.lastProcessTime = 0;
        this.processInterval = 100; // Analisar apenas a cada 100ms
        
        aes67.on('multi-channel-audio', (data) => {
            if (!aes67.isStreaming) return; // Só processa se o stream estiver realmente ativo

            const now = Date.now();
            if (now - this.lastProcessTime > this.processInterval) {
                this.processAudio(data);
                this.lastProcessTime = now;
            }
        });
        console.log('[Analyzer] Analisador Multi-Canal (AES67) em espera.');
    }

    processAudio({ buffer, channels, bitDepth, sampleRate = 48000 }) {
        const bytesPerSample = bitDepth / 8;
        const totalSamples = buffer.length / bytesPerSample;
        const samplesPerChannel = totalSamples / channels;

        for (let ch = 0; ch < channels; ch++) {
            let sumSq = 0;
            let peak = 0;
            let zeroCrossings = 0;
            let lastSample = 0;

            for (let s = 0; s < samplesPerChannel; s++) {
                // Extração de amostra PCM 24-bit (Little Endian)
                const offset = (s * channels + ch) * bytesPerSample;
                if (offset + 2 >= buffer.length) break;

                // Converte 3 bytes para inteiro 32-bit assinado
                let val = (buffer[offset] << 8) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 24);
                let sample = val / 2147483647.0; // Normaliza para -1.0 a 1.0

                sumSq += sample * sample;
                if (Math.abs(sample) > peak) peak = Math.abs(sample);
                if ((sample >= 0 && lastSample < 0) || (sample < 0 && lastSample >= 0)) {
                    zeroCrossings++;
                }
                lastSample = sample;
            }

            const rms = 20 * Math.log10(Math.sqrt(sumSq / samplesPerChannel) || 0.000001);
            const peakDb = 20 * Math.log10(peak || 0.000001);
            const spectralPeakHz = Math.max(20, Math.round((zeroCrossings * sampleRate) / (2 * Math.max(samplesPerChannel, 1))));

            // Atualiza estatísticas do canal
            this.channelStats[ch].rms = rms;
            this.channelStats[ch].peak = peakDb;
            this.channelStats[ch].spectralPeakHz = spectralPeakHz;

            // Se o canal estiver ativo (> -40dB), a IA analisa o risco
            if (peakDb > -40) {
                this.runAiDiagnosis(ch, peakDb, spectralPeakHz);
            }
        }

        // Emite níveis para o frontend (visualização de meters em 10Hz)
        if (this.io) {
            this.io.emit('multi_meter_update', this.channelStats.map(s => Math.round(s.peak)));
        }
    }

    async runAiDiagnosis(channelIdx, peakDb, spectralPeakHz) {
        // Mapeamento intuitivo
        const labels = [
            ...Array(24).fill(0).map((_, i) => `Canal ${i+1}`),
            'Aux 1', 'Aux 2', 'Aux 3', 'Aux 4', 'Aux 5', 'Aux 6', 'FX 1', 'FX 2'
        ];

        const label = labels[channelIdx] || `Bus ${channelIdx + 1}`;
        
        const risk = await ai.predictRisk(spectralPeakHz, peakDb, peakDb - 2, 50);
        
        if (risk > 0.85) {
            this.io.emit('mixer_log', `⚠️ [IA] Risco de Feedback detectado no ${label} em ${spectralPeakHz}Hz (${Math.round(risk * 100)}%)`);
        }
    }
}

module.exports = new MultiChannelAnalyzer();
