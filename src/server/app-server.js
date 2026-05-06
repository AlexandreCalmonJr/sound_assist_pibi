const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const localtunnel = require('localtunnel');

const db = require('./database');
const { registerMappingsRoutes } = require('./mappings-routes');
const { registerSocketHandlers } = require('./socket-handlers');

function createAppServer({ app, rootDir, localIp, port, dbDir }) {
    const expressApp = express();
    const server = http.createServer(expressApp);

    expressApp.use(cors());
    expressApp.use(express.static(path.join(rootDir, 'frontend')));
    expressApp.use(express.json());

    let tunnelUrl = null;

    expressApp.get('/api/config', (req, res) => {
        res.json({ localIp, port, tunnelUrl });
    });

    expressApp.post('/api/tunnel/toggle', async (req, res) => {
        if (tunnelUrl) {
            // No localtunnel as-is, we'd need to keep the tunnel instance to close it
            // For now, let's just implement a simple start/stop logic
            res.json({ success: false, message: 'Re-inicie o app para fechar o túnel ou aguarde implementação de close' });
        } else {
            startTunnel();
            res.json({ success: true, message: 'Iniciando túnel...' });
        }
    });

    // Inicia o túnel HTTPS (importante para microfone no iOS/Android)
    const MAX_TUNNEL_RETRIES = 10;

    async function startTunnel(retryCount = 0) {
        if (retryCount >= MAX_TUNNEL_RETRIES) {
            console.warn(`[Tunnel] Desistindo após ${MAX_TUNNEL_RETRIES} tentativas. Acesso remoto indisponível.`);
            return;
        }

        try {
            const sub = retryCount < 3 ? 'soundmaster-pibi' : `soundmaster-pro-${Math.random().toString(36).substring(2, 6)}`;
            
            const tunnel = await localtunnel({ 
                port: port,
                subdomain: sub 
            });

            tunnelUrl = tunnel.url;
            console.log('====================================');
            console.log(`Túnel Seguro Ativo (HTTPS) [Tentativa ${retryCount + 1}]:`);
            console.log(tunnelUrl);
            console.log('====================================');

            tunnel.on('close', () => {
                console.log('[Tunnel] Fechado. Reconectando em 5s...');
                tunnelUrl = null;
                setTimeout(() => startTunnel(0), 5000);
            });
            
            tunnel.on('error', (err) => {
                console.error('[Tunnel] Erro:', err.message);
                tunnelUrl = null;
                const delay = Math.min(5000 * Math.pow(2, retryCount), 60000);
                setTimeout(() => startTunnel(retryCount + 1), delay);
            });

        } catch (err) {
            console.error(`[Tunnel] Falha (tentativa ${retryCount + 1}/${MAX_TUNNEL_RETRIES}):`, err.message);
            const delay = Math.min(5000 * Math.pow(2, retryCount), 60000);
            setTimeout(() => startTunnel(retryCount + 1), delay);
        }
    }
    // startTunnel(); // Comentado para não pesar o app no início

    // Inicializa banco centralizado (presets + mappings no mesmo diretório)
    db.initDatabase(dbDir);
    registerMappingsRoutes(expressApp, db.mappings);

    // Proxy para IA (permite acesso mobile)
    expressApp.post('/api/ai', async (req, res) => {
        try {
            const aiRes = await fetch('http://127.0.0.1:3002/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body)
            });
            const data = await aiRes.json();
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'IA offline' });
        }
    });

    const io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    registerSocketHandlers(io);

    return { server, io };
}

module.exports = { createAppServer };
