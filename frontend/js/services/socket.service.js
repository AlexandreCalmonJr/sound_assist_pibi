/**
 * SoundMaster — SocketService
 * Singleton que inicializa o Socket.IO e repassa todos os eventos
 * para o AppStore. Nenhum outro módulo deve criar ou referenciar `socket` diretamente.
 *
 * USO:
 *   SocketService.init();                          // chamar uma vez em app.js
 *   SocketService.emit('set_master_level', data);  // enviar evento
 *   SocketService.isConnected();                   // verificar estado
 */
(function () {
    'use strict';

    let _socket = null;

    // -------------------------------------------------------------------------
    // Inicialização
    // -------------------------------------------------------------------------
    function init() {
        if (typeof io === 'undefined') {
            console.warn('[SocketService] socket.io não disponível. Rodando sem servidor?');
            return;
        }

        _socket = io();

        // --- Eventos de conexão WebSocket ---
        _socket.on('connect', function () {
            AppStore.addLog('Conectado ao servidor WebSocket.');
        });

        _socket.on('disconnect', function () {
            AppStore.addLog('Desconectado do servidor WebSocket.');
            AppStore.setState({ mixerConnected: false, mixerStatusMsg: 'Servidor offline' });
        });

        // --- Eventos do Mixer ---
        _socket.on('mixer_status', function (data) {
            AppStore.setState({
                mixerConnected: !!data.connected,
                mixerStatusMsg: data.msg || (data.connected ? 'Conectado' : 'Offline')
            });
            if (data.msg) AppStore.addLog(data.msg);
        });

        _socket.on('master_level', function (level) {
            AppStore.setState({ masterLevel: level });
        });

        _socket.on('master_level_db', function (db) {
            AppStore.setState({ masterDb: db });
        });

        _socket.on('vu_data', function (data) {
            AppStore.setState({ vuData: data });
        });

        _socket.on('recorder_status', function (data) {
            AppStore.setState({ 
                recording: !!data.recording,
                mtkRecording: !!data.mtkRecording 
            });
        });

        _socket.on('device_info', function (info) {
            AppStore.setState({ deviceInfo: info });
        });

        _socket.on('automix_state', function (data) {
            AppStore.setState({ automix: Object.assign({}, AppStore.getState().automix || {}, { [data.group]: data.enabled }) });
        });

        _socket.on('automix_response_time', function (data) {
            AppStore.setState({ automixResponseTime: data.ms });
        });

        _socket.on('player_status', function (data) {
            AppStore.setState({ playerState: data.state });
        });

        _socket.on('player_track', function (data) {
            AppStore.setState({ playerTrack: data.track });
        });

        _socket.on('show_status', function (data) {
            AppStore.setState({ currentShow: data.show });
        });

        _socket.on('snapshot_status', function (data) {
            AppStore.setState({ currentSnapshot: data.snapshot });
        });

        _socket.on('cue_status', function (data) {
            AppStore.setState({ currentCue: data.cue });
        });

        _socket.on('channel_name_update', function (data) {
            const names = Object.assign({}, AppStore.getState().mixerNames || { channels: {}, aux: {} });
            names.channels[data.channel] = data.name;
            AppStore.setState({ mixerNames: names });
        });

        _socket.on('mute_group_state', function (data) {
            const mg = Object.assign({}, AppStore.getState().muteGroups || {}, { [data.groupId]: data.enabled });
            AppStore.setState({ muteGroups: mg });
        });

        _socket.on('channel_selected_external', function (selection) {
            AppStore.addLog(`Canal selecionado externamente: ${selection.type} ${selection.number}`);
        });

        _socket.on('feedback_cut_success', function (data) {
            if (data && data.msg) AppStore.addLog(data.msg);
        });

        // --- Limpar estado ao fechar janela ---
        window.addEventListener('beforeunload', function () {
            if (_socket) _socket.disconnect();
        });
    }

    // -------------------------------------------------------------------------
    // Emissão de eventos (com guarda de conexão)
    // -------------------------------------------------------------------------

    /**
     * Emite um evento para o servidor. Retorna false se não conectado.
     * @param {string} event
     * @param {*} data
     * @returns {boolean}
     */
    function emit(event, data) {
        if (!_socket) {
            console.warn('[SocketService] Socket não inicializado. Chame SocketService.init() primeiro.');
            return false;
        }
        _socket.emit(event, data);
        return true;
    }

    /**
     * @returns {boolean}
     */
    function isConnected() {
        return _socket !== null && _socket.connected;
    }

    /**
     * @returns {Object|null}
     */
    function raw() {
        return _socket;
    }

    /**
     * Registra um listener para eventos do socket.
     * @param {string} event
     * @param {Function} callback
     */
    function on(event, callback) {
        if (!_socket) {
            console.warn('[SocketService] Socket não inicializado para .on()');
            return;
        }
        _socket.on(event, callback);
    }

    window.SocketService = { init, emit, isConnected, raw, on };
})();
