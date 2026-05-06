const dgram = require('dgram');
const { EventEmitter } = require('events');

/**
 * AES67 Receptor Simplificado
 * Ouve pacotes RTP na porta padrão (ou configurada)
 */
class AES67Receiver extends EventEmitter {
    constructor(port = 5004) {
        super();
        this.port = port;
        this.server = dgram.createSocket('udp4');
        this.isStreaming = false;
    }

    start() {
        this.server.on('error', (err) => {
            console.error(`[AES67] Erro: ${err.stack}`);
            this.server.close();
        });

        this.server.on('message', (msg, rinfo) => {
            // RTP Header (12 bytes)
            const payload = msg.slice(12);
            
            /**
             * Na Ui24R via AES67, o áudio costuma ser L24 (3 bytes por amostra)
             * e os canais são intercalados: [Ch1, Ch2, Ch3... ChN, Ch1, Ch2...]
             */
            this.emit('multi-channel-audio', {
                buffer: payload,
                channels: 32, // Captura o mapa completo (Inputs + Bus)
                bitDepth: 24,
                sampleRate: 48000
            });
        });

        this.server.on('listening', () => {
            const address = this.server.address();
            console.log(`[AES67] Receptor Ativo em ${address.address}:${address.port}`);
        });

        try {
            this.server.bind(this.port);
            this.isStreaming = true;
        } catch (e) {
            console.error('[AES67] Falha ao iniciar receptor:', e.message);
        }
    }

    stop() {
        if (this.isStreaming) {
            this.server.close();
            this.isStreaming = false;
            console.log('[AES67] Receptor parado.');
        }
    }
}

module.exports = new AES67Receiver();
