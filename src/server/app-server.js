const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mixerSingleton = require('./mixer-singleton');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const db = require('./database');
const { registerMappingsRoutes } = require('./mappings-routes');
const { registerSocketHandlers } = require('./socket-handlers');
const { getPool } = require('./worker-pool');
const mixerGit = require('./mixer-git');

function createAppServer({ app, rootDir, localIp, port, dbDir }) {
    const expressApp = express();
    const server = http.createServer(expressApp);

    const ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        `http://${localIp}:3000`,
        `http://${localIp}:3001`,
        process.env.FRONTEND_URL || "http://localhost:3000"
    ];

    expressApp.use(cors({
        origin: ALLOWED_ORIGINS,
        credentials: true
    }));

    // Rate Limiting para a API
    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 100, // limite de 100 requisições por IP
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Muitas requisições vindo deste IP, tente novamente após 15 minutos' }
    });
    expressApp.use('/api/', apiLimiter);

    expressApp.use(express.static(path.join(rootDir, 'frontend')));
    expressApp.use(express.json());

    // Inicializa banco centralizado IMEDIATAMENTE (presets + mappings no mesmo diretório)
    db.initDatabase(dbDir);
    mixerGit.init(dbDir);
    registerMappingsRoutes(expressApp, db.mappings);

    // ── Mixer Git REST API ───────────────────────────────────────────────────
    expressApp.get('/api/git/commits', async (req, res) => {
        try { res.json(await mixerGit.list(parseInt(req.query.limit) || 50)); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    expressApp.get('/api/git/commits/:id', async (req, res) => {
        try {
            const c = await mixerGit.getById(req.params.id);
            if (!c) return res.status(404).json({ error: 'Commit não encontrado' });
            res.json(c);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    expressApp.post('/api/git/commits', async (req, res) => {
        try {
            const { label, auto } = req.body || {};
            const state = mixerSingleton.getStateTree();
            const commit = await mixerGit.commit(label || 'Commit manual', !!auto, state);
            res.json(commit);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    expressApp.delete('/api/git/commits/:id', async (req, res) => {
        try { res.json(await mixerGit.deleteById(req.params.id)); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    expressApp.get('/api/git/diff/:idA/:idB', async (req, res) => {
        try { res.json(await mixerGit.diffById(req.params.idA, req.params.idB)); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    expressApp.get('/api/git/diff/:id', async (req, res) => {
        try {
            const current = mixerSingleton.getStateTree();
            res.json(await mixerGit.diffWithCurrent(req.params.id, current));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    expressApp.post('/api/git/rollback/:id', async (req, res) => {
        try {
            const { scope } = req.body || {};
            const current   = mixerSingleton.getStateTree();
            const commands  = await mixerGit.buildRollbackCommands(req.params.id, current, scope || []);
            // Emite cada comando via Socket.IO para a mesa
            const io = mixerSingleton.getIo();
            if (io) commands.forEach(cmd => io.emit(cmd.event, cmd.data));
            res.json({ commands: commands.length, applied: commands });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    expressApp.get('/api/config', (req, res) => {
        res.json({ localIp, port });
    });

    // Rotas de Calibração (NeDB)
    expressApp.get('/api/calibration', (req, res) => {
        db.settings.findOne({ type: 'calibration' }, (err, doc) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(doc || { calibrationData: [], splOffset: 0 });
        });
    });

    expressApp.post('/api/calibration', (req, res) => {
        const { calibrationData, splOffset } = req.body;
        db.settings.update(
            { type: 'calibration' },
            { $set: { calibrationData, splOffset, timestamp: Date.now() } },
            { upsert: true },
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            }
        );
    });

    // Proxy para IA (permite acesso mobile)
    expressApp.post('/api/ai', async (req, res) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
            // ✅ Injeção de Contexto do Mixer para a IA (Problema 8)
            const payload = req.body;
            const targetCh = payload.channel || (payload.analysis && payload.analysis.channel);
            const targetAux = payload.aux;
            
            payload.mixer_context = Object.assign({
                master: mixerSingleton.getMasterState(),
                channel: targetCh ? mixerSingleton.getChannelState(targetCh) : null,
                aux: targetAux ? mixerSingleton.getAuxState(targetAux) : null,
                timestamp: Date.now()
            }, payload.mixer_context || {});

            const aiRes = await fetch('http://127.0.0.1:3002/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-API-Key': process.env.AI_API_KEY || ''
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeout);
            const data = await aiRes.json();
            res.json(data);
        } catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                res.status(504).json({ error: 'IA demorou demais para responder (timeout)' });
            } else {
                res.status(500).json({ error: 'IA offline' });
            }
        }
    });

    expressApp.get('/api/ai/health', async (req, res) => {
        try {
            const aiRes = await fetch('http://127.0.0.1:3002/');
            const data = await aiRes.json();
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'IA offline' });
        }
    });



    expressApp.post('/api/acoustic_analysis', async (req, res) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
            const aiRes = await fetch('http://127.0.0.1:3002/acoustic_analysis', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-API-Key': process.env.AI_API_KEY || ''
                },
                body: JSON.stringify(req.body),
                signal: controller.signal
            });
            clearTimeout(timeout);
            const data = await aiRes.json();
            res.json(data);
        } catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                res.status(504).json({ error: 'Motor de Acústica demorou demais (timeout)' });
            } else {
                res.status(500).json({ error: 'Motor de Acústica offline' });
            }
        }
    });

    // Diagnóstico Preditivo de Hardware (proxy → Python AI Engine)
    expressApp.post('/api/hardware_diagnosis', async (req, res) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        try {
            const aiRes = await fetch('http://127.0.0.1:3002/hardware_diagnosis', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.AI_API_KEY || '' },
                body:    JSON.stringify(req.body),
                signal:  controller.signal
            });
            clearTimeout(timeout);
            res.json(await aiRes.json());
        } catch (error) {
            clearTimeout(timeout);
            res.status(error.name === 'AbortError' ? 504 : 500)
               .json({ error: error.name === 'AbortError' ? 'Timeout no diagnóstico' : 'Motor Python offline' });
        }
    });

    // Mapeamento de nomes de canais e auxiliares
    expressApp.get('/api/mixer/names', async (req, res) => {
        try {
            db.settings.findOne({ type: 'mixer_names' }, (err, doc) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(doc ? doc.names : { channels: {}, aux: {} });
            });
        } catch (error) {
            res.status(500).json({ error: 'Falha ao ler nomes' });
        }
    });

    expressApp.post('/api/mixer/names', async (req, res) => {
        try {
            const names = req.body; // { channels: {...}, aux: {...} }
            db.settings.update({ type: 'mixer_names' }, { $set: { names: names } }, { upsert: true }, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        } catch (error) {
            res.status(500).json({ error: 'Falha ao salvar nomes' });
        }
    });

    const io = new Server(server, {
        cors: {
            origin: ALLOWED_ORIGINS,
            methods: ['GET', 'POST'],
            credentials: true
        },
        maxHttpBufferSize: 1e6,
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // ── Tópico 25/29: injeta io no singleton e inicia monitors ─────────────
    mixerSingleton.setIo(io);
    mixerSingleton.startEventLoopMonitor((msg) => console.warn(msg));
    // Inicia Worker Pool (aquece os workers na inicialização)
    getPool();

    // Middleware de Autenticação para Socket.IO
    io.use((socket, next) => {
        next();
    });

    registerSocketHandlers(io, dbDir);

    return { server, io };
}

module.exports = { createAppServer };
