const aes67 = require('./aes67-service');
const ai = require('./ai-predictor');

class MultiChannelAnalyzer {
    constructor() {
        this.channelStats = Array(32).fill(0).map(() => ({
            rms: -100,
            peak: -100,
            lastFrequencies: new Float32Array(128) // Buffer reduzido para análise rápida
        }));
    }

    init(io) {
        this.io = io;
        aes67.on('multi-channel-audio', (data) => this.processAudio(data));
        console.log('[Analyzer] Analisador Multi-Canal (AES67) vinculado à IA.');
    }

    processAudio({ buffer, channels, bitDepth }) {
        const bytesPerSample = bitDepth / 8;
        const totalSamples = buffer.length / bytesPerSample;
        const samplesPerChannel = totalSamples / channels;

        for (let ch = 0; ch < channels; ch++) {
            let sumSq = 0;
            let peak = 0;

            for (let s = 0; s < samplesPerChannel; s++) {
                // Extração de amostra PCM 24-bit (Little Endian)
                const offset = (s * channels + ch) * bytesPerSample;
                if (offset + 2 >= buffer.length) break;

                // Converte 3 bytes para inteiro 32-bit assinado
                let val = (buffer[offset] << 8) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 24);
                let sample = val / 2147483647.0; // Normaliza para -1.0 a 1.0

                sumSq += sample * sample;
                if (Math.abs(sample) > peak) peak = Math.abs(sample);
            }

            const rms = 20 * Math.log10(Math.sqrt(sumSq / samplesPerChannel) || 0.000001);
            const peakDb = 20 * Math.log10(peak || 0.000001);

            // Atualiza estatísticas do canal
            this.channelStats[ch].rms = rms;
            this.channelStats[ch].peak = peakDb;

            // Se o canal estiver ativo (> -40dB), a IA analisa o risco
            if (peakDb > -40) {
                this.runAiDiagnosis(ch, peakDb);
            }
        }

        // Emite níveis para o frontend (opcional, para visualização de meters)
        // this.io.emit('multi_meter_update', this.channelStats.map(s => s.peak));
    }

    async runAiDiagnosis(channelIdx, peakDb) {
        // Mapeamento intuitivo
        const labels = [
            ...Array(24).fill(0).map((_, i) => `Canal ${i+1}`),
            'Aux 1', 'Aux 2', 'Aux 3', 'Aux 4', 'Aux 5', 'Aux 6', 'FX 1', 'FX 2'
        ];

        const label = labels[channelIdx] || `Bus ${channelIdx + 1}`;
        
        // Exemplo: Simulação de detecção de feedback via análise de transientes
        // Em um sistema real, aqui passaríamos a FFT do canal para o aiPredictor
        const risk = await ai.predictRisk(1000, peakDb, peakDb - 2, 50); // Valores dummy para exemplo
        
        if (risk > 0.85) {
            this.io.emit('mixer_log', `⚠️ [IA] Risco de Feedback detectado no ${label} (${Math.round(risk * 100)}%)`);
        }
    }
}

module.exports = new MultiChannelAnalyzer();
