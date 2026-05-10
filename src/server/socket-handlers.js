const { z } = require('zod');
const { SoundcraftUI } = require('soundcraft-ui-connection');
const { createMixerActions } = require('./mixer-actions');
const db = require('./database');
const historyService = require('./history-service');
const aiPredictor = require('./ai-predictor');
const Logger = require('./logger');

// --- Esquemas de Validação ---
// ... (esquemas omitidos para brevidade, mantidos no arquivo)
const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const schemas = {
    connect: z.string().regex(ipRegex).or(z.enum(['offline', 'simulado', '127.0.0.1'])),
    masterLevel: z.object({
        level: z.union([z.number(), z.string()]).transform(v => Number(v)).pipe(z.number().min(0).max(1))
    }),
    eqCut: z.object({
        target: z.enum(['master', 'channel']),
        channel: z.number().min(1).max(24).optional(),
        hz: z.number().min(20).max(20000),
        gain: z.number().min(-24).max(12).optional(),
        q: z.number().min(0.1).max(10).optional(),
        band: z.number().min(1).max(4).optional()
    }),
    aiCommand: z.object({
        action: z.string(),
        hz: z.number().optional(),
        desc: z.string().optional()
    }),
    channelBasic: z.object({
        channel: z.number().min(1).max(24)
    }),
    channelHpf: z.object({
        channel: z.number().min(1).max(24),
        hz: z.number().min(20).max(1000)
    }),
    channelGate: z.object({
        channel: z.number().min(1).max(24),
        enabled: z.union([z.boolean(), z.number()]).transform(v => !!v),
        threshold: z.number().min(-80).max(0).optional()
    }),
    channelComp: z.object({
        channel: z.number().min(1).max(24),
        ratio: z.number().min(1).max(20).optional(),
        threshold: z.number().min(-60).max(0).optional()
    }),
    boolEnabled: z.object({
        enabled: z.union([z.boolean(), z.number()]).transform(v => !!v)
    }),
    oscillator: z.object({
        enabled: z.union([z.boolean(), z.number()]).transform(v => !!v),
        type: z.number().min(0).max(2).optional(),
        level: z.number().min(-100).max(0).optional()
    }),
    auxFx: z.object({
        channel: z.number().min(1).max(24),
        aux: z.number().min(1).max(10).optional(),
        fx: z.number().min(1).max(4).optional(),
        level: z.number().min(0).max(1)
    }),
    delay: z.object({
        target: z.enum(['master', 'aux']),
        id: z.number().min(1).max(10).optional(),
        ms: z.number().min(0).max(500)
    }),
    feedbackCut: z.object({
        hz: z.number().min(20).max(20000)
    })
};

function registerSocketHandlers(io, appDataDir = './logs') {
    const logger = new Logger(appDataDir);
    let activeConnections = 0;

    // Função auxiliar para throttle
    function createThrottle(ms) {
        let lastTime = 0;
        return (fn) => {
            return function(...args) {
                const now = Date.now();
                if (now - lastTime >= ms) {
                    fn.apply(this, args);
                    lastTime = now;
                }
            };
        };
    }
    
    io.on('connection', (socket) => {
        activeConnections++;
        let mixer = null;
        let historyStack = [];
        let redoStack = [];

        function addToHistory(cmd) {
            historyStack.push(cmd);
            if (historyStack.length > 50) historyStack.shift();
            redoStack = [];
        }
        
        // Cache de estado para simulação e presets
        let mixerState = {
            master: { level: 0, levelDb: -100, mute: 0 },
            inputs: Array(24).fill(0).map(() => ({
                level: 0, levelDb: -100, mute: 0, hpf: 100, gate: 0, comp: 0
            }))
        };

        const actions = createMixerActions(() => mixer);
        const throttleMasterLevel = createThrottle(50); // máx 20x por segundo

        logger.info(socket.id, 'CLIENT_CONNECTED', { activeConnections });

        socket.on('connect_mixer', async (ip) => {
            try {
                const validatedIp = schemas.connect.parse(ip);
                logger.info(socket.id, 'MIXER_CONNECT_ATTEMPT', { ip: validatedIp });
                
                if (validatedIp === 'offline' || validatedIp === 'simulado' || validatedIp === '127.0.0.1') {
                    logger.info(socket.id, 'MIXER_MODE_SIMULATED');
                    mixer = {
                        isSimulated: true,
                        conn: { sendMessage: (msg) => {
                            logger.info(socket.id, 'MIXER_CMD_RAW', { msg });
                            socket.emit('mixer_log', `CMD SIMULADO: ${msg}`);
                        }},
                        master: {
                            setFaderLevel: (v) => { 
                                mixerState.master.level = v; 
                                socket.emit('master_level', v); 
                            },
                            changeFaderLevelDB: (v) => { 
                                mixerState.master.levelDb += v; 
                                socket.emit('master_level_db', mixerState.master.levelDb); 
                                mixer.conn.sendMessage(`SETD^m.value^${v}dB (delta)`);
                            },
                            input: (ch) => ({
                                changeFaderLevelDB: (v) => { 
                                    const idx = ch - 1;
                                    if (mixerState.inputs[idx]) mixerState.inputs[idx].levelDb += v;
                                    mixer.conn.sendMessage(`SETD^i.${idx}.value^${v}dB (delta)`);
                                    socket.emit('mixer_log', `Volume Ch${ch} alterado em ${v}dB (Simulado)`);
                                }
                            }),
                            faderLevel$: { subscribe: () => {} },
                            faderLevelDB$: { subscribe: () => {} }
                        },
                        disconnect: () => { mixer = null; }
                    };
                    socket.emit('mixer_status', { connected: true, isSimulated: true, msg: 'Modo Simulado Ativo' });
                    return;
                }

                mixer = new SoundcraftUI(ip);
                await mixer.connect();

                logger.info(socket.id, 'MIXER_CONNECTED', { ip });
                socket.emit('mixer_status', { connected: true, msg: 'Conectado a Soundcraft Ui!' });

                mixer.master.faderLevel$.subscribe(level => {
                    mixerState.master.level = level;
                    socket.emit('master_level', level);
                });
                mixer.master.faderLevelDB$.subscribe(levelDb => {
                    mixerState.master.levelDb = levelDb;
                    socket.emit('master_level_db', levelDb);
                });
            } catch (error) {
                console.error('Erro ao conectar na mesa:', error.message);
                socket.emit('mixer_status', { connected: false, msg: `Erro de conexao: ${error.message}` });
            }
        });

        socket.on('disconnect_mixer', () => {
            if (mixer) {
                mixer.disconnect();
                mixer = null;
                console.log('Mesa desconectada a pedido do usuario.');
                socket.emit('mixer_status', { connected: false, msg: 'Desconectado.' });
            }
        });

        socket.on('set_master_level', (data) => {
            if (!mixer) {
                socket.emit('mixer_status', { connected: false, msg: 'Conecte-se a mesa primeiro!' });
                return;
            }
            
            try {
                const validated = schemas.masterLevel.parse(data);
                
                throttleMasterLevel(() => {
                    try {
                        mixer.master.setFaderLevel(validated.level);
                        logger.info(socket.id, 'SET_MASTER_LEVEL', { level: validated.level });
                        
                        if (mixer.isSimulated) {
                            mixer.conn.sendMessage(`SETD^m.value^${validated.level}`);
                        }
                        
                        socket.emit('mixer_status', { connected: true, msg: `Master ajustado para ${Math.round(validated.level * 100)}%` });
                    } catch (error) {
                        logger.error(socket.id, 'SET_MASTER_LEVEL_ASYNC_ERROR', { error: error.message });
                    }
                });
            } catch (error) {
                logger.error(socket.id, 'SET_MASTER_LEVEL_VALIDATION_ERROR', { error: error.message });
                socket.emit('mixer_status', { connected: true, msg: `Dados inválidos: ${error.message}` });
            }
        });

        socket.on('cut_feedback', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const validated = schemas.feedbackCut.parse(data);
                const msg = actions.applyEqCut('master', null, validated.hz, -6, 8, 4);
                socket.emit('feedback_cut_success', { hz: validated.hz, msg });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: `Falha ao cortar feedback: ${error.message}` });
            }
        });

        socket.on('execute_ai_command', (cmd) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const validated = schemas.aiCommand.parse(cmd);
                const result = actions.executeMixerCommand(validated);
                logger.info(socket.id, 'AI_COMMAND_EXECUTED', { action: validated.action, result });
                socket.emit('feedback_cut_success', { hz: validated.hz || 0, msg: `${validated.desc || 'Comando IA'}: ${result}` });
            } catch (error) {
                logger.error(socket.id, 'AI_COMMAND_ERROR', { error: error.message });
                socket.emit('mixer_status', { connected: true, msg: `Erro IA: ${error.message}` });
            }
        });

        socket.on('apply_channel_hpf', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const validated = schemas.channelHpf.parse(data);
                socket.emit('feedback_cut_success', { msg: actions.applyChannelHpf(validated.channel, validated.hz) });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('apply_channel_gate', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const validated = schemas.channelGate.parse(data);
                socket.emit('feedback_cut_success', { msg: actions.applyChannelGate(validated.channel, validated.enabled, validated.threshold) });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('apply_channel_compressor', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const validated = schemas.channelComp.parse(data);
                socket.emit('feedback_cut_success', { msg: actions.applyChannelCompressor(validated.channel, validated.ratio, validated.threshold) });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('apply_eq_cut', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const validated = schemas.eqCut.parse(data);
                socket.emit('feedback_cut_success', { msg: actions.applyEqCut(validated.target, validated.channel, validated.hz, validated.gain, validated.q, validated.band) });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('set_afs_enabled', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const validated = schemas.boolEnabled.parse(data);
                socket.emit('feedback_cut_success', { msg: actions.setAfs(validated.enabled) });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: `Erro AFS: ${error.message}` });
            }
        });

        socket.on('set_oscillator', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const validated = schemas.oscillator.parse(data);
                socket.emit('feedback_cut_success', { msg: actions.applyOscillator(validated.enabled, validated.type, validated.level) });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: `Erro oscilador: ${error.message}` });
            }
        });

        socket.on('set_aux_level', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const validated = schemas.auxFx.parse(data);
                const msg = actions.setAuxLevel(validated.channel, validated.aux, validated.level);
                socket.emit('feedback_cut_success', { msg });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('set_fx_level', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const validated = schemas.auxFx.parse(data);
                const msg = actions.setFxLevel(validated.channel, validated.fx, validated.level);
                socket.emit('feedback_cut_success', { msg });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('set_delay', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const validated = schemas.delay.parse(data);
                const msg = actions.setDelay(validated.target, validated.id, validated.ms);
                socket.emit('feedback_cut_success', { msg });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('run_clean_sound_preset', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const channel = Number(data.channel) || 1;
                const steps = [
                    actions.applyChannelHpf(channel, data.hpf || 100),
                    actions.applyChannelGate(channel, 1, data.gateThreshold || -52),
                    actions.applyChannelCompressor(channel, data.ratio || 2.5, data.compThreshold || -18),
                    actions.applyEqCut('channel', channel, data.mudHz || 250, data.mudGain || -3, 1.2, 2),
                    actions.applyEqCut('channel', channel, data.harshHz || 3200, data.harshGain || -2, 1.5, 3)
                ];
                addToHistory({ type: 'clean_preset', data });
                socket.emit('feedback_cut_success', { msg: `Preset de som limpo aplicado no canal ${channel}: ${steps.join(' ')}` });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        // --- Histórico e IA Preditiva ---
        socket.on('save_acoustic_snapshot', async (data) => {
            try {
                const doc = await historyService.saveSnapshot(data);
                socket.emit('snapshot_saved', doc);
            } catch (e) {
                console.error('Erro ao salvar snapshot:', e.message);
            }
        });

        socket.on('get_acoustic_history', async () => {
            try {
                const docs = await historyService.getComparison();
                const benchmark = await historyService.getBenchmark();
                socket.emit('acoustic_history_data', { history: docs, benchmark });
            } catch (e) {
                console.error('Erro ao buscar histórico:', e.message);
            }
        });

        socket.on('analyze_feedback_risk', async (data) => {
            try {
                const risk = await aiPredictor.predictRisk(data.hz, data.db, data.prevDb, data.gain || 0);
                socket.emit('feedback_risk_result', { hz: data.hz, risk });
                
                // Se o risco for altíssimo (> 0.9), podemos disparar um corte preventivo
                if (risk > 0.9) {
                    const msg = actions.applyEqCut('master', null, data.hz, -3, 10, 4);
                    socket.emit('feedback_cut_success', { hz: data.hz, msg: `[IA Preditiva] Corte preventivo de -3dB: ${msg}` });
                }
            } catch (e) {
                console.error('Erro na previsão de IA:', e.message);
            }
        });

        socket.on('train_feedback_event', async (data) => {
            try {
                await aiPredictor.trainOnEvent(data.hz, data.db, data.prevDb, data.gain || 0, data.isFeedback);
            } catch (e) {
                console.error('Erro no treinamento de IA:', e.message);
            }
        });

        // --- Gerenciamento de Presets ---
        socket.on('save_preset', (data) => {
            const preset = {
                name: data.name || `Preset ${new Date().toLocaleString()}`,
                timestamp: Date.now(),
                state: JSON.parse(JSON.stringify(mixerState))
            };
            db.presets.insert(preset, (err, doc) => {
                if (err) {
                    logger.error(socket.id, 'SAVE_PRESET_ERROR', { error: err.message });
                    socket.emit('mixer_status', { connected: true, msg: 'Erro ao salvar preset' });
                } else {
                    logger.info(socket.id, 'PRESET_SAVED', { name: preset.name });
                    socket.emit('preset_saved', doc);
                }
            });
        });

        socket.on('list_presets', () => {
            db.presets.find({}).sort({ timestamp: -1 }).exec((err, docs) => {
                if (!err) socket.emit('presets_list', docs);
            });
        });

        socket.on('load_preset', (id) => {
            if (!actions.ensureMixer(socket)) return;
            db.presets.findOne({ _id: id }, (err, doc) => {
                if (!err && doc) {
                    try {
                        logger.info(socket.id, 'LOAD_PRESET_START', { name: doc.name });
                        // Restaurar Master
                        if (doc.state.master) {
                            mixer.master.setFaderLevel(doc.state.master.level);
                        }
                        
                        // Restaurar Canais (Exemplo: Volumes)
                        if (doc.state.inputs && Array.isArray(doc.state.inputs)) {
                            doc.state.inputs.forEach((inputState, idx) => {
                                const ch = idx + 1;
                                const input = mixer.master.input(ch);
                                if (!input) return;

                                // Restauração robusta de parâmetros
                                if (typeof input.setFaderLevel === 'function') {
                                    input.setFaderLevel(inputState.level);
                                } else if (typeof input.changeFaderLevelDB === 'function') {
                                    // Fallback para dB se fader linear não existir
                                    const currentDb = inputState.levelDb || -100;
                                    input.changeFaderLevelDB(currentDb - (mixerState.inputs[idx]?.levelDb || -100));
                                }
                                
                                // Restaura Mute se disponível
                                if (typeof input.setMute === 'function') {
                                    input.setMute(inputState.mute);
                                }
                            });
                        }
                        
                        logger.info(socket.id, 'LOAD_PRESET_SUCCESS', { name: doc.name });
                        socket.emit('feedback_cut_success', { msg: `Preset "${doc.name}" carregado com sucesso!` });
                        socket.emit('mixer_log', `Preset "${doc.name}" aplicado.`);
                    } catch (e) {
                        logger.error(socket.id, 'LOAD_PRESET_ERROR', { name: doc.name, error: e.message });
                        socket.emit('mixer_status', { connected: true, msg: 'Erro ao aplicar preset: ' + e.message });
                    }
                }
            });
        });

        socket.on('undo_command', () => {
            const cmd = historyStack.pop();
            if (cmd) {
                redoStack.push(cmd);
                socket.emit('mixer_log', 'Undo: Comando revertido (Simulado/Visual)');
            }
        });

        socket.on('send_raw_message', (data) => {
            if (!mixer) return;
            try {
                if (mixer.conn && typeof mixer.conn.sendMessage === 'function') {
                    mixer.conn.sendMessage(data.message);
                    socket.emit('mixer_log', `RAW enviado: ${data.message}`);
                }
            } catch (error) {
                console.error('Erro ao enviar mensagem RAW:', error.message);
            }
        });

        socket.on('ping_mixer', () => {
            socket.emit('pong_mixer');
        });

        socket.on('disconnect', () => {
            activeConnections--;
            if (mixer) {
                try {
                    mixer.disconnect();
                } catch (e) {
                    console.error('Erro ao desconectar mixer no disconnect:', e);
                }
                mixer = null;
            }
            console.log(`[Socket] Frontend desconectado (${activeConnections} cliente(s) restante(s))`);
        });
    });
}

module.exports = { registerSocketHandlers };
