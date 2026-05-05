/**
 * SoundMaster — AIChatUI
 * Gerencia EXCLUSIVAMENTE o DOM do módulo "Assistente IA".
 * Toda comunicação com a IA vai para AIService.
 * Toda execução de comandos vai para MixerService.
 * Todo estado compartilhado vai para AppStore.
 */
(function () {
    'use strict';

    // -------------------------------------------------------------------------
    // Elementos do DOM
    // -------------------------------------------------------------------------
    const $ = function (id) { return document.getElementById(id); };

    let els = {};
    function _getEls() {
        return {
            chatMessages:    $('chat-messages'),
            chatInput:       $('chat-input'),
            btnSend:         $('btn-chat-send'),
            btnClear:        $('btn-clear-chat'),
            chatStatus:      $('chat-status'),
            aiTargetChannel: $('ai-target-channel'),
            btnSendAnalysis: $('btn-ai-send-analysis'),
            btnSendPinkReport: $('btn-ai-send-pink-report'),
            promptButtons:   document.querySelectorAll('.sound-ai-prompt'),
            btnCleanChannel: $('btn-ai-clean-channel'),
            btnHpf:          $('btn-ai-hpf'),
            btnGate:         $('btn-ai-gate'),
            btnCompressor:   $('btn-ai-compressor'),
            btnEqMud:        $('btn-ai-eq-mud'),
            btnEqHarsh:      $('btn-ai-eq-harsh'),
            btnAfsOn:        $('btn-ai-afs-on'),
            btnAfsOff:       $('btn-ai-afs-off'),
        };
    }

    // -------------------------------------------------------------------------
    // Helpers de renderização
    // -------------------------------------------------------------------------

    function _renderAIStatus(status) {
        if (!els.chatStatus) return;
        const map = {
            online:  { text: 'Online',        color: 'var(--success)' },
            offline: { text: 'Offline',        color: 'var(--danger)'  },
            loading: { text: 'Processando...', color: 'var(--warning)' },
        };
        const s = map[status] || map.offline;
        els.chatStatus.innerText = s.text;
        els.chatStatus.style.color = s.color;
    }

    /**
     * Adiciona uma bolha de chat ao container.
     * @param {string} text
     * @param {boolean} isUser
     * @param {Object|null} command  - se presente, adiciona botão "Executar"
     */
    function _appendBubble(text, isUser, command, id) {
        if (!els.chatMessages) return;

        const bubble = document.createElement('div');
        if (id) bubble.id = id;
        bubble.className = 'chat-bubble ' + (isUser ? 'chat-user' : 'chat-assistant');
        bubble.innerText = text;

        if (command && !isUser) {
            const actions = document.createElement('div');
            actions.className = 'chat-actions';

            const btnExec = document.createElement('button');
            btnExec.className = 'action-btn primary';
            btnExec.innerText = 'Executar: ' + (command.desc || command.action);

            btnExec.addEventListener('click', function () {
                const ok = MixerService.executeAICommand(command);
                if (ok) {
                    btnExec.innerText = 'Executado ✓';
                    btnExec.disabled = true;
                    btnExec.style.background = 'var(--success)';
                } else {
                    btnExec.innerText = '⚠️ Conecte-se à mesa primeiro';
                }
            });

            actions.appendChild(btnExec);
            bubble.appendChild(actions);
        }

        els.chatMessages.appendChild(bubble);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    }

    function _clearChat() {
        if (!els.chatMessages) return;
        els.chatMessages.innerHTML = '';
        _appendBubble('Pronto para novas instruções. Explique o problema de som.', false, null);
    }

    function _getTargetChannel() {
        const val = Number(els.aiTargetChannel && els.aiTargetChannel.value);
        if (!Number.isInteger(val) || val < 1 || val > 24) {
            alert('Informe um canal alvo entre 1 e 24.');
            return null;
        }
        return val;
    }

    function _getCurrentAnalysis() {
        if (!window.SoundMasterAnalyzer || !window.SoundMasterAnalyzer.hasAnalysis()) {
            alert('Ative o analisador e aguarde alguns segundos antes de enviar a análise.');
            return null;
        }
        return window.SoundMasterAnalyzer.getLastAnalysis();
    }

    async function _sendAcousticAnalysis(usePinkReport) {
        const channel = _getTargetChannel();
        if (!channel) return;

        const analysis = _getCurrentAnalysis();
        if (!analysis) return;
        if (usePinkReport && !analysis.pinkReport) {
            alert('Não há relatório de ruído rosa. Faça a medição rosa antes de enviar.');
            return;
        }

        const message = usePinkReport ? 'Relatório de ruído rosa do salão' : 'Análise acústica do salão';
        _appendBubble(message, true, null);

        const payload = {
            summary: analysis.text,
            bands: analysis.details?.bands || {},
            peakHz: analysis.details?.peakHz,
            peakDb: analysis.details?.peakDb,
            rmsDb: analysis.details?.rmsDb,
        };
        if (analysis.pinkReport) {
            payload.pinkReport = analysis.pinkReport;
        }

        // Feedback visual de carregamento
        const loadingId = 'ai-loading-' + Date.now();
        _appendBubble('Analisando dados acústicos...', false, null, loadingId);

        try {
            const result = await AIService.ask(message, channel, payload);
            const loadingBubble = document.getElementById(loadingId);
            if (loadingBubble) loadingBubble.remove();
            
            _appendBubble(result.text, false, result.command);
        } catch (err) {
            const loadingBubble = document.getElementById(loadingId);
            if (loadingBubble) loadingBubble.innerText = 'Erro ao processar análise: ' + err.message;
        }
    }

    // -------------------------------------------------------------------------
    // Envio de mensagem para IA
    // -------------------------------------------------------------------------
    async function _sendMessage(text) {
        console.log('[AIChatUI] Iniciando _sendMessage:', text);
        if (!text || !text.trim()) return;

        const channel = _getTargetChannel();
        console.log('[AIChatUI] Canal alvo:', channel);
        if (!channel) return;

        _appendBubble(text.trim(), true, null);
        if (els.chatInput) els.chatInput.value = '';

        const loadingId = 'msg-loading-' + Date.now();
        _appendBubble('...', false, null, loadingId);

        try {
            const result = await AIService.ask(text.trim(), channel);
            const loadingBubble = document.getElementById(loadingId);
            if (loadingBubble) loadingBubble.remove();
            
            _appendBubble(result.text, false, result.command);
        } catch (err) {
            const loadingBubble = document.getElementById(loadingId);
            if (loadingBubble) loadingBubble.innerText = 'Erro na conexão com IA.';
        }
    }

    // -------------------------------------------------------------------------
    // Eventos DOM
    // -------------------------------------------------------------------------
    function _initEvents() {
        console.log('[AIChatUI] Vinculando eventos...');
        
        // Teste de clique agressivo
        if (els.btnSend) {
            els.btnSend.onclick = function() {
                console.log('[AIChatUI] Clique detectado via onclick');
                const text = els.chatInput && els.chatInput.value.trim();
                if (text) _sendMessage(text);
                else alert('O campo de texto está vazio!');
            };
        } else {
            console.error('[AIChatUI] Botão btnSend não encontrado no DOM.');
        }

        // Envio via Enter
        els.chatInput && els.chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && els.chatInput.value.trim()) {
                _sendMessage(els.chatInput.value.trim());
            }
        });

        // Limpar chat
        els.btnClear && els.btnClear.addEventListener('click', _clearChat);

        // Prompts rápidos
        els.promptButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                const text = btn.dataset.prompt || btn.innerText;
                if (els.chatInput) els.chatInput.value = text;
                _sendMessage(text);
            });
        });

        // Enviar análise acústica ao chat IA
        els.btnSendAnalysis && els.btnSendAnalysis.addEventListener('click', function () {
            _sendAcousticAnalysis(false);
        });
        els.btnSendPinkReport && els.btnSendPinkReport.addEventListener('click', function () {
            _sendAcousticAnalysis(true);
        });

        // Ações rápidas — MixerService direto, sem passar pela IA
        function _quickAction(btn, fn) {
            btn && btn.addEventListener('click', function () {
                const ch = _getTargetChannel();
                if (ch !== null) fn(ch);
            });
        }

        function _quickGlobal(btn, fn) {
            btn && btn.addEventListener('click', fn);
        }

        _quickAction(els.btnCleanChannel, function (ch) { MixerService.runCleanSoundPreset(ch); });
        _quickAction(els.btnHpf,          function (ch) { MixerService.applyHpf(ch, 100);       });
        _quickAction(els.btnGate,         function (ch) { MixerService.applyGate(ch);            });
        _quickAction(els.btnCompressor,   function (ch) { MixerService.applyCompressor(ch);      });
        _quickAction(els.btnEqMud,        function (ch) { MixerService.applyEqCut('channel', ch, 250, -3, 1.1, 2); });
        _quickAction(els.btnEqHarsh,      function (ch) { MixerService.applyEqCut('channel', ch, 3200, -2.5, 1.5, 3); });

        _quickGlobal(els.btnAfsOn,  function () { MixerService.setAfs(true);  });
        _quickGlobal(els.btnAfsOff, function () { MixerService.setAfs(false); });
    }

    // -------------------------------------------------------------------------
    // Subscriptions no AppStore
    // -------------------------------------------------------------------------
    function _initSubscriptions() {
        AppStore.subscribe('aiStatus', _renderAIStatus);
    }

    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------
    async function init() {
        console.log('[AIChatUI] Inicializando...');
        els = _getEls();
        
        if (!els.btnSend) {
            console.error('[AIChatUI] Erro: Botão de envio não encontrado no DOM.');
        }

        _initEvents();
        _initSubscriptions();

        // Mensagem de boas-vindas
        _appendBubble(
            'Olá! Sou o SoundMaster IA. Conte o problema do som e eu sugiro ajustes práticos.',
            false,
            null
        );

        // Verifica se a IA está acessível ao iniciar
        await AIService.ping();
    }

    window.SoundMasterAIChat = { 
        init,
        sendAnalysis: _sendAcousticAnalysis
    };
})();
