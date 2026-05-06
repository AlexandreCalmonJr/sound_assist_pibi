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
            // RTP Header tem 12 bytes. O payload é o PCM.
            // Para AES67 puro, o payload geralmente é L24 (24-bit PCM) ou L16.
            const payload = msg.slice(12);
            
            this.emit('audio-data', {
                buffer: payload,
                from: rinfo.address,
                timestamp: Date.now()
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
