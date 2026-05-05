const { SoundcraftUI } = require('soundcraft-ui-connection');
const { createMixerActions } = require('./mixer-actions');

function registerSocketHandlers(io) {
    let mixer = null;
    const actions = createMixerActions(() => mixer);

    io.on('connection', (socket) => {
        console.log('Frontend conectado via Socket.io');

        socket.on('connect_mixer', async (ip) => {
            try {
                console.log(`Tentando conectar a Soundcraft Ui no IP: ${ip}...`);
                mixer = new SoundcraftUI(ip);
                await mixer.connect();

                console.log('Conectado com sucesso a Mesa!');
                socket.emit('mixer_status', { connected: true, msg: 'Conectado a Soundcraft Ui!' });

                mixer.master.faderLevel$.subscribe(level => socket.emit('master_level', level));
                mixer.master.faderLevelDB$.subscribe(levelDb => socket.emit('master_level_db', levelDb));
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
                const targetValue = Number(data.level);
                mixer.master.setFaderLevel(targetValue);
                socket.emit('mixer_status', { connected: true, msg: `Master ajustado para ${Math.round(targetValue * 100)}%` });
            } catch (error) {
                console.error('Erro ao ajustar master:', error.message);
                socket.emit('mixer_status', { connected: true, msg: `Falha ao ajustar Master: ${error.message}` });
            }
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
            socket.emit('feedback_cut_success', { msg: actions.setAfs(data.enabled) });
        });

        socket.on('set_oscillator', (data) => {
            if (!actions.ensureMixer(socket)) return;
            socket.emit('feedback_cut_success', { msg: actions.applyOscillator(data.enabled, data.type, data.level) });
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
                socket.emit('feedback_cut_success', { msg: `Preset de som limpo aplicado no canal ${channel}: ${steps.join(' ')}` });
            } catch (error) {
                socket.emit('mixer_status', { connected: true, msg: error.message });
            }
        });

        socket.on('disconnect', () => {
            console.log('Frontend desconectado.');
        });
    });
}

module.exports = { registerSocketHandlers };
