const { Easings, vuValueToDB } = require('soundcraft-ui-connection');
const mixerSingleton = require('./mixer-singleton');

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
        mixerSingleton.updateChannelState(channel, { hpf: frequency });
        
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
        mixerSingleton.updateChannelState(channel, { gate: enabled ? 1 : 0 });
        return `Gate ${enabled ? 'ativado' : 'desativado'} no canal ${channel}.`;
    }

    function applyChannelCompressor(channel, ratio = 2.5, threshold = -18) {
        const input = getMixer().input(channel);
        input.compressor().enable();
        input.compressor().setRatio(clamp(ratio, 1, 20));
        input.compressor().setThreshold(clamp(threshold, -60, 0));
        input.compressor().setAttack(25);
        input.compressor().setRelease(220);
        mixerSingleton.updateChannelState(channel, { comp: 1 });
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
        if (target === 'master') {
            mixerSingleton.updateMasterState({ eq: Object.assign({}, mixerSingleton.getMasterState().eq || {}, { [bandIndex]: { hz: frequency, gain: cutGain, q: qValue } }) });
        } else if (channel) {
            const current = mixerSingleton.getChannelState(channel) || {};
            mixerSingleton.updateChannelState(channel, { eq: Object.assign({}, current.eq || {}, { [bandIndex]: { hz: frequency, gain: cutGain, q: qValue } }) });
        }

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

    function cutFeedback(hz) {
        return applyEqCut('master', null, hz, -12, 8.0, 4);
    }

    function setAuxLevel(channel, aux, level) {
        const input = getMixer().input(channel);
        const faderVal = clamp(level, 0, 1);
        input.aux(aux).setFaderLevel(faderVal);
        mixerSingleton.updateAuxState(aux, { level: faderVal, channel });
        return `AUX ${aux} do canal ${channel} ajustado para ${Math.round(faderVal * 100)}%.`;
    }

    function setAuxPost(channel, aux, isPost) {
        getMixer().input(channel).aux(aux).setPost(isPost ? 1 : 0);
        return `AUX ${aux} do canal ${channel} configurado como ${isPost ? 'POST' : 'PRE'}-Fader.`;
    }

    function setAuxPostProc(channel, aux, isPostProc) {
        getMixer().input(channel).aux(aux).setPostProc(isPostProc ? 1 : 0);
        return `AUX ${aux} do canal ${channel} configurado como ${isPostProc ? 'POST' : 'PRE'}-PROC.`;
    }

    function setFxLevel(channel, fx, level) {
        const input = getMixer().input(channel);
        const faderVal = clamp(level, 0, 1);
        input.fx(fx).setFaderLevel(faderVal);
        return `FX ${fx} do canal ${channel} ajustado para ${Math.round(faderVal * 100)}%.`;
    }

    function setFxPost(channel, fx, isPost) {
        getMixer().input(channel).fx(fx).setPost(isPost ? 1 : 0);
        return `FX ${fx} do canal ${channel} configurado como ${isPost ? 'POST' : 'PRE'}-Fader.`;
    }

    function fadeMaster(level, time) {
        // ✅ Correção Auditoria: fadeTo aceita apenas 2 argumentos (valor e tempo)
        getMixer().master.fadeTo(clamp(level, 0, 1), time);
        return `Fade do Master para ${Math.round(level * 100)}% em ${time}ms iniciado.`;
    }

    function fadeChannel(channel, level, time) {
        // ✅ Correção Auditoria: fadeTo aceita apenas 2 argumentos
        getMixer().input(channel).fadeTo(clamp(level, 0, 1), time);
        return `Fade do canal ${channel} para ${Math.round(level * 100)}% em ${time}ms iniciado.`;
    }

    function setFxBpm(fx, bpm) {
        getMixer().fx(fx).setBpm(clamp(bpm, 20, 400));
        return `BPM do processador de efeito ${fx} ajustado para ${bpm}.`;
    }

    function setFxParam(fx, param, value) {
        getMixer().fx(fx).setParam(clamp(param, 1, 6), clamp(value, 0, 1));
        return `Parâmetro ${param} do processador de efeito ${fx} ajustado para ${Math.round(value * 100)}%.`;
    }

    function setHwGain(hwInput, gain) {
        // ✅ Correção Auditoria: hw() refere-se à ENTRADA FÍSICA (Hardware Input), não ao canal de software.
        // O valor 0..1 mapeia para o range total de ganho da mesa (-6 a +57dB)
        getMixer().hw(hwInput).setGain(clamp(gain, 0, 1));
        mixerSingleton.updateChannelState(hwInput, { gain: clamp(gain, 0, 1) });
        return `Ganho de Hardware (Entrada Física ${hwInput}) ajustado para ${Math.round(gain * 100)}%.`;
    }

    function setPhantom(hwInput, enabled) {
        const hw = getMixer().hw(hwInput);
        if (enabled) hw.phantomOn();
        else hw.phantomOff();
        mixerSingleton.updateChannelState(hwInput, { phantom: enabled ? 1 : 0 });
        return `Phantom Power (48V) da Entrada Física ${hwInput} ${enabled ? 'LIGADO ⚠️' : 'DESLIGADO'}.`;
    }

    function setChannelName(channel, name) {
        const input = getMixer().input(channel);
        const cleanName = name.substring(0, 20); // Máximo 20 caracteres conforme doc
        input.setName(cleanName);
        return `Nome do canal ${channel} alterado para "${cleanName}" e sincronizado com a mesa.`;
    }

    function setMonitorVolume(target, level) {
        const mixer = getMixer();
        const faderVal = clamp(level, 0, 1);
        if (target === 'solo') {
            mixer.volume.solo.setFaderLevel(faderVal);
        } else if (target === 'hp1') {
            mixer.volume.headphone(1).setFaderLevel(faderVal);
        } else if (target === 'hp2') {
            mixer.volume.headphone(2).setFaderLevel(faderVal);
        }
        return `Volume de monitoramento (${target}) ajustado para ${Math.round(faderVal * 100)}%.`;
    }

    function selectChannelSync(type, num, syncId = 'SYNC_ID') {
        const mixer = getMixer();
        if (type === 'master') {
            mixer.channelSync.selectChannel('master', syncId);
            return `Master selecionado nos clientes (SyncID: ${syncId}).`;
        }
        
        // Mapeamento de tipos simplificado para os códigos da biblioteca
        const typeMap = {
            'input': 'i', 'channel': 'i', 'ch': 'i',
            'line': 'l', 'player': 'p', 'fx': 'f',
            'sub': 's', 'subgroup': 's', 'aux': 'a', 'vca': 'v'
        };
        const shortType = typeMap[type.toLowerCase()] || type;
        mixer.channelSync.selectChannel(shortType, num, syncId);
        return `Canal ${type} ${num} selecionado nos clientes (SyncID: ${syncId}).`;
    }

    function playerControl(action, value = null) {
        const p = getMixer().player;
        switch (action) {
            case 'play': p.play(); break;
            case 'pause': p.pause(); break;
            case 'stop': p.stop(); break;
            case 'next': p.next(); break;
            case 'prev': p.prev(); break;
            case 'shuffle': p.setShuffle(value ? 1 : 0); break;
            case 'auto': p.setAuto(); break;
            case 'manual': p.setManual(); break;
            case 'load_playlist': p.loadPlaylist(value); break;
            default: return `Ação do player desconhecida: ${action}`;
        }
        return `Player: comando ${action} executado.`;
    }

    function recorderControl(action) {
        const r = getMixer().recorderDualTrack;
        switch (action) {
            case 'start': r.recordStart(); break;
            case 'stop': r.recordStop(); break;
            case 'toggle': r.recordToggle(); break;
            default: return `Ação do gravador desconhecida: ${action}`;
        }
        return `Gravador: comando ${action} executado.`;
    }

    function mtkControl(action) {
        const mtk = getMixer().recorderMultiTrack;
        switch (action) {
            case 'start': mtk.recordStart(); break;
            case 'stop': mtk.recordStop(); break;
            case 'play': mtk.play(); break;
            case 'pause': mtk.pause(); break;
            case 'soundcheck_on': mtk.activateSoundcheck(); break;
            case 'soundcheck_off': mtk.deactivateSoundcheck(); break;
            default: return `Ação MTK desconhecida: ${action}`;
        }
        return `Multitrack: comando ${action} executado.`;
    }

    function mtkSelectChannel(channel, selected) {
        const input = getMixer().input(channel);
        if (selected) input.multiTrackSelect();
        else input.multiTrackUnselect();
        return `Canal ${channel} ${selected ? 'ADICIONADO ao' : 'REMOVIDO do'} Multitrack.`;
    }

    function showControl(action, showName, targetName = null) {
        const s = getMixer().shows;
        switch (action) {
            case 'load_show': s.loadShow(showName); break;
            case 'load_snapshot': s.loadSnapshot(showName, targetName); break;
            case 'load_cue': s.loadCue(showName, targetName); break;
            case 'save_snapshot': s.saveSnapshot(showName, targetName); break;
            case 'update_snapshot': s.updateCurrentSnapshot(); break;
            default: return `Ação de Show desconhecida: ${action}`;
        }
        return `Show/Snapshot: comando ${action} executado (${showName}${targetName ? ' > ' + targetName : ''}).`;
    }

    function muteGroupControl(groupId, mute) {
        const mg = getMixer().muteGroup(groupId);
        if (mute) mg.mute();
        else mg.unmute();
        return `Mute Group ${groupId} ${mute ? 'MUTADO' : 'ATIVADO'}.`;
    }

    function clearMuteGroups() {
        getMixer().clearMuteGroups();
        return 'Todos os Mute Groups foram limpos.';
    }

    function automixControl(action, value = null) {
        const am = getMixer().automix;
        const groupKey = action.endsWith('_a') ? 'a' : 'b';
        const group = am.groups[groupKey];

        if (action.startsWith('enable')) group.enable();
        else if (action.startsWith('disable')) group.disable();
        else if (action === 'set_response') am.setResponseTimeMs(clamp(value, 20, 4000));
        
        return `Automix: comando ${action} executado.`;
    }

    function automixAssignChannel(channel, group, weight = 0.5) {
        const input = getMixer().input(channel);
        input.automixAssignGroup(group); // 'a', 'b', ou 'none'
        input.automixSetWeight(clamp(weight, 0, 1));
        return `Canal ${channel} atribuído ao Automix Grupo ${group.toUpperCase()} com peso ${Math.round(weight * 100)}%.`;
    }

    function getDeviceInfo() {
        const mixer = getMixer();
        const info = mixer.deviceInfo;
        return {
            model: info.model,
            firmware: 'Verificando...', // Firmware é via Observable, simplificamos para o retorno imediato
            capabilities: 'Consultando...'
        };
    }

    function sendRawCommand(msg) {
        const mixer = getMixer();
        if (mixer.isSimulated) {
            mixer.conn.sendMessage(msg);
            return `[SIM] Raw: ${msg} enviado.`;
        }
        mixer.conn.sendMessage(msg);
        return `Mensagem bruta enviada: ${msg}`;
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
        
        const typeStr = type === 0 ? 'sine' : (type === 1 ? 'pink' : 'white');
        osc.setType(typeStr);
        osc.setFaderLevel(clamp(level, -100, 0));
        return `Gerador de ruído (${typeStr}) ${enabled ? 'ligado' : 'desligado'}.`;
    }

    function setDelay(target, id, ms) {
        const mixer = getMixer();
        const delayValue = clamp(ms, 0, 500); // Master/Aux 500ms, Input 250ms
        
        if (target === 'master') {
            mixer.master.setDelayL(delayValue);
            mixer.master.setDelayR(delayValue);
        } else if (target === 'aux') {
            mixer.aux(id).setDelay(delayValue);
        } else if (target === 'channel' || target === 'input') {
            const chDelay = clamp(ms, 0, 250);
            mixer.input(id || 1).setDelay(chDelay);
        }
        return `Delay de ${ms}ms solicitado para ${target} ${id || ''}.`;
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
            case 'master_mute': {
                if (cmd.enabled) mixer.master.mute(); else mixer.master.unmute();
                return `Master ${cmd.enabled ? 'MUTADO' : 'DESMUTADO'}.`;
            }
            case 'set_channel_level':
            case 'channel_fader': {
                const ch = cmd.channel || cmd.ch || 1;
                mixer.input(ch).setFaderLevel(clamp(cmd.level || 0.7, 0, 1));
                return `Canal ${ch} ajustado para ${Math.round((cmd.level || 0.7) * 100)}%`;
            }
            case 'channel_mute': {
                const ch = cmd.channel || cmd.ch || 1;
                if (cmd.enabled) mixer.input(ch).mute();
                else mixer.input(ch).unmute();
                return `Canal ${ch} ${cmd.enabled ? 'MUTADO' : 'DESMUTADO'}.`;
            }
            case 'toggle_dim': {
                mixer.master.toggleDim();
                return 'Função DIM alternada no Master.';
            }
            case 'set_master_pan': {
                mixer.master.setPan(clamp(cmd.val || 0.5, 0, 1));
                return `Pan do Master ajustado para ${cmd.val}`;
            }
            case 'set_channel_pan': {
                const ch = cmd.channel || cmd.ch || 1;
                mixer.input(ch).setPan(clamp(cmd.val || 0.5, 0, 1));
                return `Pan do Canal ${ch} ajustado para ${cmd.val}`;
            }
            case 'toggle_solo': {
                const ch = cmd.channel || cmd.ch || 1;
                mixer.input(ch).toggleSolo();
                return `Solo do Canal ${ch} alternado.`;
            }
            case 'fade_master': return fadeMaster(cmd.level || 0, cmd.time || 2000);
            case 'fade_channel': return fadeChannel(cmd.channel || 1, cmd.level || 0, cmd.time || 2000);
            case 'set_oscillator': return applyOscillator(cmd.enabled !== 0, cmd.type, cmd.level);
            case 'set_aux_level': return setAuxLevel(cmd.channel || 1, cmd.aux || 1, cmd.level || 0);
            case 'set_aux_post': return setAuxPost(cmd.channel || 1, cmd.aux || 1, cmd.enabled !== 0);
            case 'set_aux_post_proc': return setAuxPostProc(cmd.channel || 1, cmd.aux || 1, cmd.enabled !== 0);
            case 'set_aux_pan': {
                const ch = cmd.channel || cmd.ch || 1;
                getMixer().input(ch).aux(cmd.aux || 1).setPan(clamp(cmd.val || 0.5, 0, 1));
                return `Pan do AUX ${cmd.aux} (Canal ${ch}) ajustado para ${cmd.val}`;
            }
            case 'set_channel_name': return setChannelName(cmd.channel || 1, cmd.name || '');
            case 'set_fx_level': return setFxLevel(cmd.channel || 1, cmd.fx || 1, cmd.level || 0);
            case 'set_fx_post': return setFxPost(cmd.channel || 1, cmd.fx || 1, cmd.enabled !== 0);
            case 'set_fx_bpm': return setFxBpm(cmd.fx || 1, cmd.val || 120);
            case 'set_fx_param': return setFxParam(cmd.fx || 1, cmd.param || 1, cmd.val || 0.5);
            case 'set_hw_gain': return setHwGain(cmd.input || cmd.channel || 1, cmd.val || 0.5);
            case 'set_phantom': return setPhantom(cmd.input || cmd.channel || 1, cmd.enabled !== 0);
            case 'set_phantom_power': return setPhantom(cmd.input || cmd.channel || 1, cmd.enabled !== 0);
            case 'set_monitor_volume': return setMonitorVolume(cmd.target || 'hp1', cmd.val || 0.5);
            case 'select_channel': return selectChannelSync(cmd.type || 'input', cmd.channel || cmd.ch || 1, cmd.syncId || 'SYNC_ID');
            case 'player_cmd': return playerControl(cmd.action_type, cmd.val);
            case 'recorder_cmd': return recorderControl(cmd.action_type);
            case 'mtk_cmd': return mtkControl(cmd.action_type);
            case 'mtk_select': return mtkSelectChannel(cmd.channel || cmd.ch || 1, cmd.enabled !== 0);
            case 'show_cmd': return showControl(cmd.action_type, cmd.show, cmd.target);
            case 'mute_group_cmd': return muteGroupControl(cmd.id || 'all', cmd.enabled !== 0);
            case 'clear_mute_groups': return clearMuteGroups();
            case 'automix_cmd': return automixControl(cmd.action_type, cmd.val);
            case 'automix_assign': return automixAssignChannel(cmd.channel || 1, cmd.group || 'none', cmd.weight || 0.5);
            case 'get_device_info': return getDeviceInfo();
            case 'send_raw': return sendRawCommand(cmd.message || cmd.msg);
            case 'send_raw_message': return sendRawCommand(cmd.message || cmd.msg);
            case 'run_clean_sound_preset': return runCleanSoundPreset(cmd.channel || 1, cmd);
            case 'set_delay': {
                const id = cmd.channel || cmd.ch || cmd.aux || cmd.id || 1;
                return setDelay(cmd.target || 'aux', id, cmd.ms || 0);
            }
            case 'set_room_profile': {
                return `Perfil acústico alterado para: ${cmd.profile}`;
            }
            case 'log': return `INFO: ${cmd.desc}`;
            default: throw new Error(`Acao nao suportada: ${cmd.action}`);
        }
    }

    return {
        applyChannelCompressor, applyChannelGate, applyChannelHpf, applyEqCut,
        applyOscillator, ensureMixer, executeMixerCommand, setAfs,
        setAuxLevel, setFxLevel, setDelay, runCleanSoundPreset,
        setPhantom, setChannelName, cutFeedback, automixAssignChannel
    };
}

module.exports = { createMixerActions };
