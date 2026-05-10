/**
 * SoundMaster — AppStore
 * Estado global reativo com observer pattern.
 * Substitui a passagem de callbacks entre módulos (appendMixerLog, appendAISuggestion, etc.)
 *
 * USO:
 *   AppStore.subscribe('mixerConnected', (val) => { ... });
 *   AppStore.setState({ mixerConnected: true });
 *   const { masterLevel } = AppStore.getState();
 */
(function () {
    'use strict';

    // -------------------------------------------------------------------------
    // Estado inicial
    // -------------------------------------------------------------------------
    const _state = {
        // Mixer
        mixerConnected: false,
        mixerIp: '10.10.1.1',
        mixerStatusMsg: 'Offline',
        masterLevel: 0,       // 0.0 – 1.0
        masterDb: null,       // número ou null
        masterMute: false,
        vuData: {},           // dados de VU em tempo real por canal
        recording: false,     // estado do gravador 2-track
        mtkRecording: false,  // estado do multitrack
        deviceInfo: {
            model: 'Unknown',
            firmware: 'N/A',
            caps: {}
        },

        // IA
        aiStatus: 'offline',  // 'online' | 'offline' | 'loading'
        aiSuggestions: [],    // [{ desc, command }]

        // Analyzer
        micActive: false,
        feedbackHz: null,     // Hz do pico detectado ou null

        // Logs
        mixerLog: [],         // [{ time, text }]
    };

    // -------------------------------------------------------------------------
    // Listeners por chave
    // -------------------------------------------------------------------------
    const _listeners = {};

    // -------------------------------------------------------------------------
    // API pública
    // -------------------------------------------------------------------------

    /**
     * Assinar mudanças em uma chave específica do estado.
     * @param {string} key  - Chave do estado (ex: 'mixerConnected')
     * @param {Function} fn - Callback chamado com o novo valor
     * @returns {Function}  - Função de unsubscribe
     */
    function subscribe(key, fn) {
        if (!_listeners[key]) _listeners[key] = [];
        _listeners[key].push(fn);
        return function unsubscribe() {
            _listeners[key] = _listeners[key].filter(f => f !== fn);
        };
    }

    /**
     * Atualizar uma ou mais chaves do estado e notificar subscribers.
     * @param {Object} patch - Objeto parcial com as mudanças
     */
    function setState(patch) {
        Object.assign(_state, patch);
        Object.keys(patch).forEach(function (key) {
            if (_listeners[key]) {
                _listeners[key].forEach(function (fn) {
                    try { fn(_state[key], _state); } catch (e) {
                        console.error('[AppStore] Erro no subscriber de "' + key + '":', e);
                    }
                });
            }
        });
    }

    /**
     * Retorna uma cópia rasa do estado atual.
     * @returns {Object}
     */
    function getState() {
        return Object.assign({}, _state);
    }

    /**
     * Atalho: adicionar entrada ao log do mixer (max 50 entradas).
     * @param {string} text
     */
    function addLog(text) {
        const entry = {
            time: new Date().toLocaleTimeString('pt-BR'),
            text: String(text)
        };
        const logs = _state.mixerLog.concat(entry).slice(-50);
        setState({ mixerLog: logs });
    }

    /**
     * Atalho: adicionar sugestão de IA (mantém as 10 mais recentes).
     * @param {{ desc: string, command: Object }} suggestion
     */
    function addAISuggestion(suggestion) {
        const list = [suggestion].concat(_state.aiSuggestions).slice(0, 10);
        setState({ aiSuggestions: list });
    }

    window.AppStore = { subscribe, setState, getState, addLog, addAISuggestion };
})();
