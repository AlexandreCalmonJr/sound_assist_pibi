/**
 * SoundMaster — MixerService
 * Centraliza todas as operações de controle da mesa Soundcraft Ui.
 * Usa SocketService para emitir eventos e AppStore para atualizar estado.
 *
 * USO:
 *   MixerService.connect('10.10.1.1');
 *   MixerService.setMasterLevel(0.75);
 *   MixerService.applyHpf(3, 100);
 */
(function () {
    'use strict';

    // -------------------------------------------------------------------------
    // Helpers internos
    // -------------------------------------------------------------------------

    function _clamp(value, min, max) {
        return Math.min(max, Math.max(min, Number(value)));
    }

    function _validateChannel(channel) {
        const ch = Number(channel);
        if (!Number.isInteger(ch) || ch < 1 || ch > 24) {
            throw new Error('Canal inválido: use um número entre 1 e 24.');
        }
        return ch;
    }

    /**
     * Emite um evento para o servidor e registra no log.
     * @param {string} event
     * @param {Object} data
     * @param {string} logMsg
     */
    function _emit(event, data, logMsg) {
        if (!SocketService.isConnected()) {
            AppStore.addLog('⚠️ Conecte-se à mesa antes de usar este recurso.');
            return false;
        }
        SocketService.emit(event, data);
        if (logMsg) AppStore.addLog(logMsg);
        return true;
    }

    // -------------------------------------------------------------------------
    // Conexão
    // -------------------------------------------------------------------------

    /**
     * Conecta ao mixer no IP fornecido.
     * @param {string} ip
     */
    function connect(ip) {
        if (!ip || !ip.trim()) {
            AppStore.addLog('⚠️ Insira um IP válido para conectar.');
            return;
        }
        const cleanIp = ip.trim();
        AppStore.setState({ mixerIp: cleanIp, mixerStatusMsg: 'Conectando...' });
        AppStore.addLog('Tentando conectar em ' + cleanIp + '...');
        SocketService.emit('connect_mixer', cleanIp);
    }

    /**
     * Desconecta do mixer atual.
     */
    function disconnect() {
        AppStore.addLog('Solicitando desconexão do mixer...');
        SocketService.emit('disconnect_mixer');
    }

    // -------------------------------------------------------------------------
    // Master
    // -------------------------------------------------------------------------

    /**
     * Define o nível do master (0.0 – 1.0).
     * Usa throttle com requestAnimationFrame para não sobrecarregar o servidor.
     * @param {number} level
     */
    let _pendingMasterEmit = false;
    let _pendingMasterLevel = null;

    function setMasterLevel(level) {
        const clamped = _clamp(level, 0, 1);
        _pendingMasterLevel = clamped;

        // Atualiza UI imediatamente (otimista)
        AppStore.setState({ masterLevel: clamped });

        if (_pendingMasterEmit) return;
        _pendingMasterEmit = true;

        requestAnimationFrame(function () {
            if (_pendingMasterLevel !== null) {
                SocketService.emit('set_master_level', { level: _pendingMasterLevel });
                _pendingMasterLevel = null;
            }
            _pendingMasterEmit = false;
        });
    }

    /**
     * Ajusta o master em delta percentual (-100 a +100).
     * @param {number} deltaPercent
     */
    function adjustMasterLevel(deltaPercent) {
        const current = AppStore.getState().masterLevel;
        const next = _clamp(current + deltaPercent / 100, 0, 1);
        setMasterLevel(next);
    }

    // -------------------------------------------------------------------------
    // Ações de canal
    // -------------------------------------------------------------------------

    /**
     * @param {number} channel  1–24
     * @param {number} [hz=100] Frequência de corte em Hz
     */
    function applyHpf(channel, hz) {
        const ch = _validateChannel(channel);
        const freq = _clamp(hz || 100, 20, 400);
        return _emit('apply_channel_hpf', { channel: ch, hz: freq },
            'HPF ' + freq + 'Hz solicitado no canal ' + ch + '.');
    }

    /**
     * @param {number} channel
     * @param {number} [threshold=-52]
     */
    function applyGate(channel, threshold) {
        const ch = _validateChannel(channel);
        const thresh = _clamp(threshold !== undefined ? threshold : -52, -80, 0);
        return _emit('apply_channel_gate', { channel: ch, enabled: 1, threshold: thresh },
            'Gate leve solicitado no canal ' + ch + '.');
    }

    /**
     * @param {number} channel
     * @param {number} [ratio=2.5]
     * @param {number} [threshold=-18]
     */
    function applyCompressor(channel, ratio, threshold) {
        const ch = _validateChannel(channel);
        return _emit('apply_channel_compressor', {
            channel: ch,
            ratio: _clamp(ratio || 2.5, 1, 20),
            threshold: _clamp(threshold !== undefined ? threshold : -18, -60, 0)
        }, 'Compressor leve solicitado no canal ' + ch + '.');
    }

    /**
     * @param {'channel'|'master'} target
     * @param {number|null} channel  - necessário se target === 'channel'
     * @param {number} hz
     * @param {number} [gain=-3]
     * @param {number} [q=1.4]
     * @param {number} [band=2]
     */
    function applyEqCut(target, channel, hz, gain, q, band) {
        const payload = {
            target: target,
            channel: target === 'channel' ? _validateChannel(channel) : null,
            hz: _clamp(hz, 20, 20000),
            gain: _clamp(gain !== undefined ? gain : -3, -12, 6),
            q: _clamp(q !== undefined ? q : 1.4, 0.2, 10),
            band: _clamp(band !== undefined ? band : 2, 1, 4)
        };
        const label = target === 'master' ? 'Master' : 'canal ' + payload.channel;
        return _emit('apply_eq_cut', payload,
            'EQ ' + payload.hz + 'Hz (' + payload.gain + 'dB) solicitado no ' + label + '.');
    }

    /**
     * @param {boolean} enabled
     */
    function setAfs(enabled) {
        return _emit('set_afs_enabled', { enabled: enabled ? 1 : 0 },
            'AFS2 ' + (enabled ? 'ativado' : 'desativado') + ' globalmente.');
    }

    /**
     * @param {number} channel
     * @param {Object} [opts] - Parâmetros opcionais do preset
     */
    function runCleanSoundPreset(channel, opts) {
        const ch = _validateChannel(channel);
        return _emit('run_clean_sound_preset', Object.assign({ channel: ch }, opts || {}),
            'Preset de som limpo solicitado no canal ' + ch + '.');
    }

    /**
     * Corta frequência de feedback no master (usado pelo detector).
     * @param {number} hz
     */
    function cutFeedback(hz) {
        return _emit('cut_feedback', { hz: Math.round(hz) },
            'Corte de feedback solicitado em ' + Math.round(hz) + ' Hz.');
    }

    /**
     * Executa um comando vindo da IA (objeto com action, desc, etc.).
     * @param {Object} command
     */
    function executeAICommand(command) {
        if (!command || !command.action) {
            AppStore.addLog('⚠️ Comando IA inválido recebido.');
            return false;
        }
        return _emit('execute_ai_command', command,
            'Executando comando IA: ' + (command.desc || command.action));
    }

    /**
     * Liga/Desliga o gerador de ruído rosa.
     * @param {boolean} enabled 
     * @param {number} [level=-20] 
     */
    function setOscillator(enabled, level) {
        return _emit('set_oscillator', { enabled: enabled ? 1 : 0, type: 1, level: level || -20 },
            'Gerador de ruído rosa ' + (enabled ? 'ativado' : 'desativado') + '.');
    }

    // -------------------------------------------------------------------------
    // Presets e Undo
    // -------------------------------------------------------------------------

    function savePreset(name) {
        return _emit('save_preset', { name: name }, 'Salvando preset: ' + name);
    }

    function listPresets() {
        SocketService.emit('list_presets');
    }

    function loadPreset(id) {
        return _emit('load_preset', id, 'Carregando preset...');
    }

    function undo() {
        return _emit('undo_command', {}, 'Desfazer última ação solicitada.');
    }

    /**
     * Envia uma mensagem RAW diretamente para a mesa.
     * @param {string} message 
     */
    function sendRaw(message) {
        return _emit('send_raw_message', { message: message }, 'Comando RAW enviado: ' + message);
    }

    // -------------------------------------------------------------------------
    // Exportação
    // -------------------------------------------------------------------------
    window.MixerService = {
        connect,
        disconnect,
        setMasterLevel,
        adjustMasterLevel,
        applyHpf,
        applyGate,
        applyCompressor,
        applyEqCut,
        setAfs,
        runCleanSoundPreset,
        cutFeedback,
        executeAICommand,
        setOscillator,
        savePreset,
        listPresets,
        loadPreset,
        undo,
        sendRaw
    };
})();
