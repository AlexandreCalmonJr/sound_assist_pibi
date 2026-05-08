/**
 * SoundMaster — AIService
 * Gerencia toda comunicação com o servidor Python de IA (ai_server.py).
 * Inclui timeout, retry e enriquecimento da mensagem com canal alvo.
 *
 * USO:
 *   const result = await AIService.ask('voz abafada', 3);
 *   // result: { text: string, command: Object|null }
 */
(function () {
    'use strict';

    const AI_URL = '/api/ai';
    const TIMEOUT_MS = 8000;

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _buildMessage(text, channel) {
        const ch = Number(channel);
        const validChannel = Number.isInteger(ch) && ch >= 1 && ch <= 24 ? ch : 1;
        // Enriquece a mensagem com o canal se ainda não estiver presente
        const hasChannel = /canal\s*\d+/i.test(text) || /ch\s*\d+/i.test(text);
        return hasChannel ? text : text + ' canal ' + validChannel;
    }

    // -------------------------------------------------------------------------
    // API principal
    // -------------------------------------------------------------------------

    /**
     * Envia uma mensagem para a IA e retorna a resposta.
     * @param {string} text     - Mensagem do usuário
     * @param {number} channel  - Canal alvo (1–24)
     * @param {Object} [analysis] - Dados acústicos adicionais para auxiliar a IA
     * @returns {Promise<{ text: string, command: Object|null }>}
     */
    async function ask(text, channel, analysis) {
        const message = _buildMessage(text.trim(), channel);

        AppStore.setState({ aiStatus: 'loading' });

        const controller = new AbortController();
        const timeoutId = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);

        try {
            const response = await fetch(AI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, analysis }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            const data = await response.json();
            AppStore.setState({ aiStatus: 'online' });

            // Registrar sugestão no store se houver comando
            if (data.command) {
                AppStore.addAISuggestion({ desc: data.command.desc, command: data.command });
                AppStore.addLog('Sugestão IA: ' + data.command.desc);
            }

            return {
                text: data.text || 'IA não retornou resposta.',
                command: data.command || null
            };

        } catch (err) {
            clearTimeout(timeoutId);
            AppStore.setState({ aiStatus: 'offline' });

            if (err.name === 'AbortError') {
                AppStore.addLog('⚠️ IA: timeout após ' + (TIMEOUT_MS / 1000) + 's.');
                return {
                    text: 'A IA demorou demais para responder. Verifique se o servidor Python está ativo.',
                    command: null
                };
            }

            AppStore.addLog('⚠️ IA offline: ' + err.message);
            return {
                text: 'Não foi possível conectar à IA local. Inicie o app pelo servidor local (npm start).',
                command: null
            };
        }
    }

    /**
     * Verifica se o servidor Python está respondendo.
     * @returns {Promise<boolean>}
     */
    async function ping() {
        const controller = new AbortController();
        const timeoutId = setTimeout(function () { controller.abort(); }, 2000);
        try {
            const response = await fetch('/api/ai/health', {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                AppStore.setState({ aiStatus: 'online' });
                return true;
            }
            throw new Error('Offline');
        } catch (_) {
            clearTimeout(timeoutId);
            AppStore.setState({ aiStatus: 'offline' });
            return false;
        }
    }

    /**
     * Envia dimensões para cálculo acústico avançado no Python (Eyring RT60).
     */
    async function calculateAcoustics(volume, surfaceArea, alpha) {
        try {
            const response = await fetch('/api/acoustic_analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ volume, surface_area: surfaceArea, alpha })
            });
            if (!response.ok) throw new Error('Falha no cálculo');
            return await response.json();
        } catch (err) {
            console.error('[AIService] Erro no cálculo acústico:', err);
            return null;
        }
    }

    window.AIService = { ask, ping, calculateAcoustics };
})();
