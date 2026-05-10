const { SoundcraftUI } = require('soundcraft-ui-connection');
const { createMixerActions } = require('./mixer-actions');
const db = require('./database');
const historyService = require('./history-service');
const aiPredictor = require('./ai-predictor');

function registerSocketHandlers(io) {
    let mixer = null;
    let historyStack = [];
    let redoStack = [];
    let activeConnections = 0;
    
    // Cache de estado para simulação e presets
    let mixerState = {
        master: { level: 0, levelDb: -100, mute: 0 },
        inputs: Array(24).fill(0).map(() => ({
            level: 0, levelDb: -100, mute: 0, hpf: 100, gate: 0, comp: 0
        }))
    };

    const actions = createMixerActions(() => mixer);

    function addToHistory(cmd) {
        historyStack.push(cmd);
        if (historyStack.length > 50) historyStack.shift();
        redoStack = [];
    }

    io.on('connection', (socket) => {
        activeConnections++;
        console.log(`[Socket] Frontend conectado (${activeConnections} cliente(s) ativo(s))`);

        if (activeConnections > 1) {
            console.warn('[Socket] ⚠️ Múltiplos clientes conectados — ações na mesa são compartilhadas!');
            socket.emit('mixer_status', { connected: !!mixer, msg: '⚠️ Outro cliente já está conectado. Ações serão compartilhadas.' });
        }

        socket.on('connect_mixer', async (ip) => {
            try {
                if (ip === 'offline' || ip === 'simulado' || ip === '127.0.0.1') {
                    console.log('Iniciando MODO SIMULADO (Offline)...');
                    mixer = {
                        isSimulated: true,
                        conn: { sendMessage: (msg) => {
                            console.log('[MIXER SIMULADO]', msg);
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

                console.log(`Tentando conectar a Soundcraft Ui no IP: ${ip}...`);
                mixer = new SoundcraftUI(ip);
                await mixer.connect();

                console.log('Conectado com sucesso a Mesa!');
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

        let masterDebounceTimeout = null;
        socket.on('set_master_level', (data) => {
            if (!mixer) {
                socket.emit('mixer_status', { connected: false, msg: 'Conecte-se a mesa primeiro!' });
                return;
            }
            
            // Debounce para não sobrecarregar a mesa em movimentos rápidos
            if (masterDebounceTimeout) clearTimeout(masterDebounceTimeout);
            
            masterDebounceTimeout = setTimeout(() => {
                try {
                    const targetValue = Number(data.level);
                    mixer.master.setFaderLevel(targetValue);
                    
                    // Se for simulado, logamos o comando bruto manualmente aqui para manter consistência
                    if (mixer.isSimulated) {
                        mixer.conn.sendMessage(`SETD^m.value^${targetValue}`);
                    }
                    
                    socket.emit('mixer_status', { connected: true, msg: `Master ajustado para ${Math.round(targetValue * 100)}%` });
                } catch (error) {
                    console.error('Erro ao ajustar master:', error.message);
                    socket.emit('mixer_status', { connected: true, msg: `Falha ao ajustar Master: ${error.message}` });
                }
            }, 50); // 50ms de debounce é suficiente para suavizar sem perder percepção de tempo real
        });

        socket.on('cut_feedback', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const msg = actions.applyEqCut('master', null, data.hz, -6, 8, 4);
                socket.emit('feedback_cut_success', { hz: data.hz, msg });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: `Falha ao cortar feedback: ${error.message}` });
            }
        });

        socket.on('execute_ai_command', (cmd) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const result = actions.executeMixerCommand(cmd);
                socket.emit('feedback_cut_success', { hz: cmd.hz || 0, msg: `${cmd.desc || 'Comando IA'}: ${result}` });
            } catch (error) {
                console.error('Erro ao executar comando IA:', error.message);
                socket.emit('mixer_status', { connected: true, msg: `Erro IA: ${error.message}` });
            }
        });

        socket.on('apply_channel_hpf', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                socket.emit('feedback_cut_success', { msg: actions.applyChannelHpf(data.channel, data.hz) });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('apply_channel_gate', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                socket.emit('feedback_cut_success', { msg: actions.applyChannelGate(data.channel, data.enabled, data.threshold) });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('apply_channel_compressor', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                socket.emit('feedback_cut_success', { msg: actions.applyChannelCompressor(data.channel, data.ratio, data.threshold) });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('apply_eq_cut', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                socket.emit('feedback_cut_success', { msg: actions.applyEqCut(data.target, data.channel, data.hz, data.gain, data.q, data.band) });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('set_afs_enabled', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                socket.emit('feedback_cut_success', { msg: actions.setAfs(data.enabled) });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: `Erro AFS: ${error.message}` });
            }
        });

        socket.on('set_oscillator', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                socket.emit('feedback_cut_success', { msg: actions.applyOscillator(data.enabled, data.type, data.level) });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: `Erro oscilador: ${error.message}` });
            }
        });

        socket.on('set_aux_level', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const msg = actions.setAuxLevel(data.channel, data.aux, data.level);
                socket.emit('feedback_cut_success', { msg });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('set_fx_level', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const msg = actions.setFxLevel(data.channel, data.fx, data.level);
                socket.emit('feedback_cut_success', { msg });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('set_delay', (data) => {
            if (!actions.ensureMixer(socket)) return;
            try {
                const msg = actions.setDelay(data.target, data.id, data.ms);
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
                if (err) socket.emit('mixer_status', { connected: true, msg: 'Erro ao salvar preset' });
                else socket.emit('preset_saved', doc);
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
                        
                        socket.emit('feedback_cut_success', { msg: `Preset "${doc.name}" carregado com sucesso!` });
                        socket.emit('mixer_log', `Preset "${doc.name}" aplicado.`);
                    } catch (e) {
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
            console.log(`[Socket] Frontend desconectado (${activeConnections} cliente(s) restante(s))`);
        });
    });
}

module.exports = { registerSocketHandlers };
