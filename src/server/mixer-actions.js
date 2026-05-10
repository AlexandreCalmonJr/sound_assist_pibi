function createMixerActions(getMixer) {
    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, Number(value)));
    }

    function ensureMixer(socket) {
        const mixer = getMixer();
        if (!mixer || (!mixer.conn && !mixer.isSimulated)) {
            if (socket) socket.emit('mixer_status', { connected: false, msg: 'Conecte-se a mesa primeiro!' });
            return false;
        }
        return true;
    }

    function applyChannelHpf(channel, hz) {
        const mixer = getMixer();
        const input = mixer.input(channel);
        const frequency = clamp(hz || 100, 20, 400);
        
        input.eq().setHpfFreq(frequency);
        // Slope is often not directly exposed as a simple setter in all versions, 
        // using raw as fallback if method not found, but trying high-level first.
        if (input.eq().setHpfSlope) {
            input.eq().setHpfSlope(2);
        } else {
            mixer.conn.sendMessage(`SETD^i.${channel-1}.eq.hpf.slope^2`);
        }
        
        return `HPF ${frequency}Hz aplicado no canal ${channel}.`;
    }

    function applyChannelGate(channel, enabled, threshold = -52) {
        const input = getMixer().input(channel);
        if (enabled) {
            input.gate().enable();
        } else {
            input.gate().disable();
        }
        input.gate().setThreshold(clamp(threshold, -80, 0));
        return `Gate ${enabled ? 'ativado' : 'desativado'} no canal ${channel}.`;
    }

    function applyChannelCompressor(channel, ratio = 2.5, threshold = -18) {
        const input = getMixer().input(channel);
        input.compressor().enable();
        input.compressor().setRatio(clamp(ratio, 1, 20));
        input.compressor().setThreshold(clamp(threshold, -60, 0));
        input.compressor().setAttack(25);
        input.compressor().setRelease(220);
        return `Compressor leve aplicado no canal ${channel}.`;
    }

    function applyEqCut(target, channel, hz, gain = -3, q = 1.4, band = 2) {
        const mixer = getMixer();
        const frequency = clamp(hz || 250, 20, 20000);
        const cutGain = clamp(gain, -12, 6);
        const qValue = clamp(q, 0.2, 10);
        const bandIndex = clamp(band, 1, 4);

        const eq = target === 'master' ? mixer.master.eq() : mixer.input(channel).eq();
        
        eq.band(bandIndex).setFreq(frequency);
        eq.band(bandIndex).setGain(cutGain);
        eq.band(bandIndex).setQ(qValue);
        // EQ type 0 is usually Bell/Parametric
        if (eq.band(bandIndex).setType) eq.band(bandIndex).setType(0);

        const label = target === 'master' ? 'Master' : `canal ${channel || 1}`;
        return `EQ aplicado no ${label}: ${frequency}Hz, ${cutGain}dB, Q ${qValue}.`;
    }

    function setAfs(enabled) {
        const mixer = getMixer();
        // AFS is usually on the master or global hw
        if (enabled) mixer.master.afs().enable();
        else mixer.master.afs().disable();
        return `AFS2 ${enabled ? 'ativado' : 'desativado'} globalmente.`;
    }

    function setAuxLevel(channel, aux, level) {
        const input = getMixer().input(channel);
        const faderVal = clamp(level, 0, 1);
        input.aux(aux).setFaderLevel(faderVal);
        return `AUX ${aux} do canal ${channel} ajustado para ${Math.round(faderVal * 100)}%.`;
    }

    function setFxLevel(channel, fx, level) {
        const input = getMixer().input(channel);
        const faderVal = clamp(level, 0, 1);
        input.fx(fx).setFaderLevel(faderVal);
        return `FX ${fx} do canal ${channel} ajustado para ${Math.round(faderVal * 100)}%.`;
    }

    function runCleanSoundPreset(channel, opts = {}) {
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
        const mixer = getMixer();
        const osc = mixer.hw().oscillator();
        if (enabled) osc.enable();
        else osc.disable();
        osc.setType(type === 0 ? 'sine' : (type === 1 ? 'pink' : 'white'));
        osc.setFaderLevel(clamp(level, -100, 0));
        return `Gerador de ruído ${enabled ? 'ligado' : 'desligado'}.`;
    }

    function setDelay(target, id, ms) {
        const mixer = getMixer();
        const delayValue = clamp(ms, 0, 500);
        if (target === 'master') {
            mixer.master.setDelay(delayValue);
        } else if (target === 'aux') {
            mixer.aux(id).setDelay(delayValue);
        }
        return `Delay de ${delayValue}ms aplicado no ${target} ${id || ''}.`;
    }

    function executeMixerCommand(cmd) {
        const mixer = getMixer();
        if (!cmd || !cmd.action) throw new Error('Comando invalido.');

        switch (cmd.action) {
            case 'volume_up':
            case 'volume_down': {
                const delta = Number(cmd.val) || (cmd.action === 'volume_up' ? 1 : -1);
                const target = cmd.target === 'master' ? mixer.master : mixer.input(cmd.ch || cmd.channel || 1);
                target.changeFaderLevelDB(delta);
                return `${cmd.target} ajustado em ${delta}dB.`;
            }
            case 'eq_cut': return applyEqCut(cmd.target, cmd.channel, cmd.hz, cmd.gain, cmd.q, cmd.band);
            case 'apply_channel_hpf': return applyChannelHpf(cmd.channel || 1, cmd.hz || 100);
            case 'apply_channel_gate': return applyChannelGate(cmd.channel || 1, cmd.enabled !== 0, cmd.threshold);
            case 'apply_channel_compressor': return applyChannelCompressor(cmd.channel || 1, cmd.ratio, cmd.threshold);
            case 'set_afs_enabled': return setAfs(cmd.enabled !== 0);
            case 'mute_master':
                if (cmd.enabled) mixer.master.mute(); else mixer.master.unmute();
                return `Mute do master ${cmd.enabled ? 'ativado' : 'desativado'}.`;
            case 'run_master_ideal_curve': {
                const steps = [
                    applyEqCut('master', null, 60, 3, 1.0, 1),
                    applyEqCut('master', null, 400, -2, 1.2, 2),
                    applyEqCut('master', null, 3000, 1, 1.0, 3)
                ];
                return `Curva ideal aplicada no Master: ${steps.join(' ')}`;
            }
            case 'set_master_level': {
                mixer.master.setFaderLevel(clamp(cmd.level || 0.7, 0, 1));
                return `Master ajustado para ${Math.round((cmd.level || 0.7) * 100)}%`;
            }
            case 'set_channel_level': {
                const ch = cmd.channel || cmd.ch || 1;
                mixer.input(ch).setFaderLevel(clamp(cmd.level || 0.7, 0, 1));
                return `Canal ${ch} ajustado para ${Math.round((cmd.level || 0.7) * 100)}%`;
            }
            case 'set_oscillator': return applyOscillator(cmd.enabled !== 0, cmd.type, cmd.level);
            case 'set_aux_level': return setAuxLevel(cmd.channel || 1, cmd.aux || 1, cmd.level || 0);
            case 'set_fx_level': return setFxLevel(cmd.channel || 1, cmd.fx || 1, cmd.level || 0);
            case 'run_clean_sound_preset': return runCleanSoundPreset(cmd.channel || 1, cmd);
            case 'set_delay': return setDelay(cmd.target || 'aux', cmd.aux || 1, cmd.ms || 0);
            case 'log': return `INFO: ${cmd.desc}`;
            default: throw new Error(`Acao nao suportada: ${cmd.action}`);
        }
    }

    return {
        applyChannelCompressor, applyChannelGate, applyChannelHpf, applyEqCut,
        applyOscillator, ensureMixer, executeMixerCommand, setAfs,
        setAuxLevel, setFxLevel, setDelay, runCleanSoundPreset
    };
}

module.exports = { createMixerActions };
