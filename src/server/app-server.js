const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const Datastore = require('@seald-io/nedb');
const localtunnel = require('localtunnel');

const { registerMappingsRoutes } = require('./mappings-routes');
const { registerSocketHandlers } = require('./socket-handlers');

function createAppServer({ app, rootDir, localIp, port }) {
    const expressApp = express();
    const server = http.createServer(expressApp);

    expressApp.use(cors());
    expressApp.use(express.static(path.join(rootDir, 'frontend')));
    expressApp.use(express.json());

    let tunnelUrl = null;

    expressApp.get('/api/config', (req, res) => {
        res.json({ localIp, port, tunnelUrl });
    });

    // Inicia o túnel HTTPS (importante para microfone no iOS/Android)
    async function startTunnel(retryCount = 0) {
        try {
            // Tenta um subdomínio mais pessoal para evitar conflitos
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
                console.log('Túnel fechado. Tentando reconectar...');
                tunnelUrl = null;
                setTimeout(() => startTunnel(0), 5000);
            });
            
            tunnel.on('error', (err) => {
                console.error('Erro no túnel:', err.message);
                tunnelUrl = null;
                setTimeout(() => startTunnel(retryCount + 1), 5000);
            });

        } catch (err) {
            console.error('Falha ao criar túnel seguro:', err.message);
            // Se falhou (503), tenta novamente com um contador de retentativa
            setTimeout(() => startTunnel(retryCount + 1), 10000);
        }
    }
    startTunnel();

    const dbPath = path.join(app.getPath('userData'), 'mappings.db');
    const db = new Datastore({ filename: dbPath, autoload: true });
    registerMappingsRoutes(expressApp, db);

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

    return server;
}

module.exports = { createAppServer };
