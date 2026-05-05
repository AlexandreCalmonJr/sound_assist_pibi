function createMixerActions(getMixer) {
    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, Number(value)));
    }

    function getInputIndex(channel) {
        const parsed = Number(channel);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24) {
            throw new Error('Canal invalido. Use um numero entre 1 e 24.');
        }
        return parsed - 1;
    }

    function ensureMixer(socket) {
        const mixer = getMixer();
        if (!mixer || !mixer.conn) {
            socket.emit('mixer_status', { connected: false, msg: 'Conecte-se a mesa primeiro!' });
            return false;
        }
        return true;
    }

    function sendUi(path, value) {
        const mixer = getMixer();
        mixer.conn.sendMessage(`SETD^${path}^${value}`);
    }

    function applyChannelHpf(channel, hz) {
        const input = getInputIndex(channel);
        const frequency = clamp(hz || 100, 20, 400);
        sendUi(`i.${input}.eq.hpf.freq`, frequency);
        sendUi(`i.${input}.eq.hpf.slope`, 2);
        return `HPF ${frequency}Hz aplicado no canal ${channel}.`;
    }

    function applyChannelGate(channel, enabled, threshold = -52) {
        const input = getInputIndex(channel);
        sendUi(`i.${input}.gate.enabled`, enabled ? 1 : 0);
        sendUi(`i.${input}.gate.thresh`, clamp(threshold, -80, 0));
        return `Gate ${enabled ? 'ativado' : 'desativado'} no canal ${channel}.`;
    }

    function applyChannelCompressor(channel, ratio = 2.5, threshold = -18) {
        const input = getInputIndex(channel);
        sendUi(`i.${input}.dyn.enabled`, 1);
        sendUi(`i.${input}.dyn.ratio`, clamp(ratio, 1, 20));
        sendUi(`i.${input}.dyn.thresh`, clamp(threshold, -60, 0));
        sendUi(`i.${input}.dyn.attack`, 25);
        sendUi(`i.${input}.dyn.release`, 220);
        return `Compressor leve aplicado no canal ${channel}.`;
    }

    function applyEqCut(target, channel, hz, gain = -3, q = 1.4, band = 2) {
        const frequency = clamp(hz || 250, 20, 20000);
        const cutGain = clamp(gain, -12, 6);
        const qValue = clamp(q, 0.2, 10);
        const bandIndex = clamp(band, 1, 4);
        const prefix = target === 'master' ? 'm.eq' : `i.${getInputIndex(channel || 1)}.eq`;

        sendUi(`${prefix}.b${bandIndex}.freq`, frequency);
        sendUi(`${prefix}.b${bandIndex}.gain`, cutGain);
        sendUi(`${prefix}.b${bandIndex}.q`, qValue);
        sendUi(`${prefix}.b${bandIndex}.type`, 0);

        const label = target === 'master' ? 'Master' : `canal ${channel || 1}`;
        return `EQ aplicado no ${label}: ${frequency}Hz, ${cutGain}dB, Q ${qValue}.`;
    }

    function setAfs(enabled) {
        sendUi('afs.enabled', enabled ? 1 : 0);
        return `AFS2 ${enabled ? 'ativado' : 'desativado'} globalmente.`;
    }

    function setAuxLevel(channel, aux, level) {
        const input = getInputIndex(channel);
        const auxIdx = Number(aux) - 1;
        if (auxIdx < 0 || auxIdx > 9) throw new Error('AUX invalido (1-10).');
        const faderVal = clamp(level, 0, 1);
        sendUi(`i.${input}.aux.${auxIdx}.value`, faderVal);
        return `AUX ${aux} do canal ${channel} ajustado para ${Math.round(faderVal * 100)}%.`;
    }

    function setFxLevel(channel, fx, level) {
        const input = getInputIndex(channel);
        const fxIdx = Number(fx) - 1;
        if (fxIdx < 0 || fxIdx > 3) throw new Error('FX invalido (1-4).');
        const faderVal = clamp(level, 0, 1);
        sendUi(`i.${input}.fx.${fxIdx}.value`, faderVal);
        return `FX ${fx} do canal ${channel} ajustado para ${Math.round(faderVal * 100)}%.`;
    }

    function runCleanSoundPreset(channel, opts = {}) {
        const ch = getInputIndex(channel);
        const steps = [
            applyChannelHpf(channel, opts.hpf || 100),
            applyChannelGate(channel, 1, opts.gateThreshold || -52),
            applyChannelCompressor(channel, opts.ratio || 2.5, opts.compThreshold || -18),
            applyEqCut('channel', channel, opts.mudHz || 250, opts.mudGain || -3, 1.2, 2),
            applyEqCut('channel', channel, opts.harshHz || 3200, opts.harshGain || -2, 1.5, 3)
        ];
        return `Preset de som limpo aplicado no canal ${channel}: ${steps.join(' ')}`;
    }

    function applyOscillator(enabled, type = 1, level = -20) {
        // type 1 = pink noise
        sendUi('hw.osc.enabled', enabled ? 1 : 0);
        sendUi('hw.osc.type', type);
        sendUi('hw.osc.level', clamp(level, -100, 0));
        return `Gerador de ruído ${enabled ? 'ligado' : 'desligado'}.`;
    }

    function executeMixerCommand(cmd) {
        const mixer = getMixer();
        if (!cmd || !cmd.action) {
            throw new Error('Comando invalido.');
        }

        if (cmd.action === 'volume_up' || cmd.action === 'volume_down') {
            const delta = Number(cmd.val) || (cmd.action === 'volume_up' ? 1 : -1);
            if (cmd.target === 'master') {
                mixer.master.changeFaderLevelDB(delta);
                return `Master ajustado em ${delta}dB.`;
            }
            if (cmd.target === 'channel') {
                const channel = Number(cmd.ch || cmd.channel || 1);
                mixer.master.input(channel).changeFaderLevelDB(delta);
                return `Canal ${channel} ajustado em ${delta}dB.`;
            }
        }

        if (cmd.action === 'eq_cut') {
            return applyEqCut(cmd.target, cmd.channel, cmd.hz, cmd.gain, cmd.q, cmd.band);
        }
        if (cmd.action === 'apply_channel_hpf') {
            return applyChannelHpf(cmd.channel || 1, cmd.hz || 100);
        }
        if (cmd.action === 'apply_channel_gate') {
            return applyChannelGate(cmd.channel || 1, cmd.enabled !== 0, cmd.threshold);
        }
        if (cmd.action === 'apply_channel_compressor') {
            return applyChannelCompressor(cmd.channel || 1, cmd.ratio, cmd.threshold);
        }
        if (cmd.action === 'set_afs_enabled') {
            return setAfs(cmd.enabled !== 0);
        }
        if (cmd.action === 'mute_master') {
            sendUi('m.mute', cmd.enabled ? 1 : 0);
            return `Mute do master ${cmd.enabled ? 'ativado' : 'desativado'}.`;
        }
        if (cmd.action === 'run_master_ideal_curve') {
            const steps = [
                applyEqCut('master', null, 60, 3, 1.0, 1),
                applyEqCut('master', null, 400, -2, 1.2, 2),
                applyEqCut('master', null, 3000, 1, 1.0, 3)
            ];
            return `Curva ideal aplicada no Master: ${steps.join(' ')}`;
        }
        if (cmd.action === 'set_oscillator') {
            return applyOscillator(cmd.enabled !== 0, cmd.type, cmd.level);
        }

        if (cmd.action === 'set_aux_level') {
            return setAuxLevel(cmd.channel || 1, cmd.aux || 1, cmd.level || 0);
        }
        if (cmd.action === 'set_fx_level') {
            return setFxLevel(cmd.channel || 1, cmd.fx || 1, cmd.level || 0);
        }
        if (cmd.action === 'run_clean_sound_preset') {
            return runCleanSoundPreset(cmd.channel || 1, cmd);
        }

        throw new Error(`Acao nao suportada: ${cmd.action}`);
    }

    return {
        applyChannelCompressor,
        applyChannelGate,
        applyChannelHpf,
        applyEqCut,
        applyOscillator,
        ensureMixer,
        executeMixerCommand,
        setAfs,
        setAuxLevel,
        setFxLevel,
        runCleanSoundPreset
    };
}

module.exports = { createMixerActions };
