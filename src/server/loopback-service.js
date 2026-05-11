const aes67 = require('./aes67-service');

/**
 * LoopbackService - Extrai o sinal de referência da mesa via AES67
 * e o transmite via WebSockets para o frontend.
 */
class LoopbackService {
    constructor() {
        this.io = null;
        this.referenceChannel = 30; // Canal 31 (Índice 30) - Geralmente Main L na Ui24R
        this.sampleBuffer = [];
        this.maxBufferSize = 2048; // Tamanho do bloco para envio via socket
    }

    init(io) {
        this.io = io;
        
        // Inicia o receptor AES67 se ainda não estiver ativo
        if (!aes67.isStreaming) {
            aes67.start();
        }

        aes67.on('multi-channel-audio', (data) => {
            this.processAudio(data);
        });

        console.log(`[Loopback] Extraindo canal de referência ${this.referenceChannel + 1} via AES67.`);
    }

    processAudio({ buffer, channels, bitDepth }) {
        const bytesPerSample = bitDepth / 8; // 3 bytes para 24-bit
        const totalSamples = buffer.length / (channels * bytesPerSample);
        
        const extractedSamples = new Float32Array(totalSamples);

        for (let s = 0; s < totalSamples; s++) {
            // Calcula offset para o canal de referência no buffer intercalado
            const offset = (s * channels + this.referenceChannel) * bytesPerSample;
            
            if (offset + 2 >= buffer.length) break;

            // Converte 3 bytes PCM (24-bit BE ou LE - Soundcraft costuma usar BE no RTP)
            // No aes67-service.js atual, a extração parece ser Big Endian (ou manual)
            // Vamos usar a mesma lógica do multi-channel-analyzer.js (Little Endian lá)
            // NOTA: AES67 padrão é Big Endian (Network Order)
            let val = (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2];
            
            // Ajusta sinal para 24-bit assinado
            if (val & 0x800000) val |= 0xFF000000;
            
            extractedSamples[s] = val / 8388607.0; // Normaliza 24-bit para -1.0 a 1.0
        }

        // Acumula e envia quando atingir o tamanho do bloco
        this.sampleBuffer.push(...extractedSamples);

        if (this.sampleBuffer.length >= this.maxBufferSize) {
            if (this.io) {
                // Envia apenas os samples brutos para o frontend
                this.io.emit('reference_audio_stream', {
                    samples: this.sampleBuffer.slice(0, this.maxBufferSize)
                });
            }
            this.sampleBuffer = this.sampleBuffer.slice(this.maxBufferSize);
        }
    }
}

module.exports = new LoopbackService();
