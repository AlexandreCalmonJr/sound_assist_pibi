/**
 * SoundMaster — MixerPanelUI
 * Responsável EXCLUSIVAMENTE pela manipulação do DOM do painel do mixer (lado direito).
 * Toda lógica de negócio vai para MixerService. Todo estado vai para AppStore.
 *
 * Este módulo:
 *  1. Registra listeners de eventos DOM (botões, sliders, inputs)
 *  2. Assina o AppStore para atualizar a UI quando o estado mudar
 *  3. NUNCA emite eventos Socket.IO diretamente
 */
(function () {
    'use strict';

    // -------------------------------------------------------------------------
    // Elementos do DOM
    // -------------------------------------------------------------------------
    const $ = function (id) { return document.getElementById(id); };

    const els = {
        btnConnect:       $('btn-connect-mixer'),
        btnDisconnect:    $('btn-disconnect-mixer'),
        btnSwitchIface:   $('btn-switch-interface'),
        btnShowLog:       $('btn-show-log'),
        ipInput:          $('mixer-ip'),
        iframe:           $('mixer-iframe'),
        placeholder:      $('mixer-placeholder'),
        statusBadge:      $('mixer-status-badge'),
        statusText:       $('mixer-current-status'),
        ipDisplay:        $('mixer-ip-display'),
        masterLevelText:  $('mixer-master-level'),
        masterDbLabel:    $('mixer-master-db'),
        masterSlider:     $('master-volume-slider'),
        masterDown:       $('btn-master-volume-down'),
        masterUp:         $('btn-master-volume-up'),
        logBox:           $('mixer-log'),
        suggestionsList:  $('ai-suggestions-list'),
        quickChannel:     $('quick-channel-number'),
        btnQuickHpf:      $('btn-quick-hpf'),
        btnQuickGate:     $('btn-quick-gate'),
        btnAfsOn:         $('btn-quick-afs-enable'),
        btnAfsOff:        $('btn-quick-afs-disable'),
        tabButtons:       document.querySelectorAll('.mixer-tab-btn'),
        tabSections:      document.querySelectorAll('.mixer-panel-section'),
        btnPinkNoiseMain: $('btn-pink-noise-main'),
        pinkNoiseStatus:  $('pink-noise-status'),
        btnUndo:          $('btn-undo'),
        btnRedo:          $('btn-redo'),
        btnSavePreset:    $('btn-save-preset'),
        presetNameInput:  $('preset-name'),
        presetsList:      $('presets-list')
    };

    // -------------------------------------------------------------------------
    // Helpers de renderização
    // -------------------------------------------------------------------------

    function _renderMixerStatus(connected, msg) {
        if (!els.statusBadge || !els.statusText || !els.btnConnect) return;

        els.statusBadge.classList.toggle('online', connected);
        els.statusBadge.classList.toggle('offline', !connected);
        els.statusBadge.innerText = connected ? 'Conectado' : 'Offline';
        els.statusText.innerText = msg || (connected ? 'Conectado' : 'Offline');
        els.btnConnect.innerText = connected ? 'Atualizar' : 'Conectar';
        els.btnConnect.style.background = connected ? 'var(--success)' : '';
        els.btnConnect.style.color      = connected ? '#000' : '';

        if (els.btnDisconnect) {
            els.btnDisconnect.style.display = 'inline-block';
        }
    }

    function _renderMasterLevel(level, db) {
        const pct = Math.round(_clamp01(level) * 100);
        if (els.masterSlider)    els.masterSlider.value = String(pct);
        if (els.masterLevelText) els.masterLevelText.innerText = pct + '%';
        if (els.masterDbLabel) {
            els.masterDbLabel.innerText = typeof db === 'number'
                ? '(' + db.toFixed(1) + ' dB)'
                : '(-∞ dB)';
        }
    }

    function _renderLog(logs) {
        if (!els.logBox || !Array.isArray(logs)) return;
        els.logBox.innerHTML = '';
        logs.slice().reverse().forEach(function (entry) {
            const div = document.createElement('div');
            div.className = 'mixer-log-entry';
            div.innerText = entry.time + ' — ' + entry.text;
            els.logBox.appendChild(div);
        });
    }

    function _renderAISuggestions(suggestions) {
        if (!els.suggestionsList) return;
        els.suggestionsList.innerHTML = '';

        if (!suggestions || suggestions.length === 0) {
            els.suggestionsList.innerHTML =
                '<div class="mixer-suggestion-item" style="color:var(--text-muted)">Nenhuma sugestão ainda.</div>';
            return;
        }

        suggestions.forEach(function (s) {
            const item = document.createElement('div');
            item.className = 'mixer-suggestion-item';

            const caption = document.createElement('span');
            caption.innerText = s.desc || 'Comando IA';

            const btn = document.createElement('button');
            btn.className = 'mixer-suggestion-btn';
            btn.innerText = 'Executar';
            btn.addEventListener('click', function () {
                MixerService.executeAICommand(s.command);
                btn.innerText = 'Executado ✓';
                btn.disabled = true;
            });

            item.appendChild(caption);
            item.appendChild(btn);
            els.suggestionsList.prepend(item);
        });
    }

    function _clamp01(v) { return Math.min(1, Math.max(0, Number(v) || 0)); }

    function _getQuickChannel() {
        const val = Number(els.quickChannel && els.quickChannel.value);
        if (!Number.isInteger(val) || val < 1 || val > 24) {
            alert('Informe um canal válido entre 1 e 24.');
            return null;
        }
        return val;
    }

    function _renderPresets(presets) {
        if (!els.presetsList) return;
        els.presetsList.innerHTML = '';
        if (!presets || presets.length === 0) {
            els.presetsList.innerHTML = '<div class="mixer-log-entry">Nenhum preset salvo.</div>';
            return;
        }
        presets.forEach(p => {
            const div = document.createElement('div');
            div.className = 'mixer-log-entry';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.innerHTML = `
                <span>${p.name} <small style="color:var(--text-muted)">(${new Date(p.timestamp).toLocaleTimeString()})</small></span>
                <button class="action-btn primary small" style="padding: 4px 8px;">Carregar</button>
            `;
            div.querySelector('button').onclick = () => MixerService.loadPreset(p._id);
            els.presetsList.appendChild(div);
        });
    }

    // -------------------------------------------------------------------------
    // Tabs do painel do mixer
    // -------------------------------------------------------------------------
    function _initTabs() {
        els.tabButtons.forEach(function (tab) {
            tab.addEventListener('click', function () {
                els.tabButtons.forEach(function (b) { b.classList.remove('active'); });
                els.tabSections.forEach(function (s) { s.classList.remove('active'); });
                tab.classList.add('active');
                const target = document.getElementById(tab.getAttribute('data-tab'));
                if (target) target.classList.add('active');
            });
        });
    }

    // -------------------------------------------------------------------------
    // Listeners de eventos DOM
    // -------------------------------------------------------------------------
    function _initEvents() {
        // Conexão
        els.btnConnect && els.btnConnect.addEventListener('click', function () {
            const ip = els.ipInput ? els.ipInput.value.trim() : '';
            if (!ip) { alert('Insira o IP da mesa Soundcraft Ui.'); return; }

            // Abre iframe
            if (els.placeholder) els.placeholder.style.display = 'none';
            if (els.iframe) {
                els.iframe.style.display = 'block';
                els.iframe.src = ip.startsWith('http') ? ip : 'http://' + ip;
            }
            if (els.ipDisplay) els.ipDisplay.innerText = ip;

            // Navega para aba de interface
            const ifaceTab = document.querySelector('[data-tab="mixer-interface"]');
            if (ifaceTab) ifaceTab.click();

            MixerService.connect(ip);
        });

        els.btnDisconnect && els.btnDisconnect.addEventListener('click', function () {
            MixerService.disconnect();
        });

        // Navegação rápida
        els.btnSwitchIface && els.btnSwitchIface.addEventListener('click', function () {
            const tab = document.querySelector('[data-tab="mixer-interface"]');
            if (tab) tab.click();
        });

        els.btnShowLog && els.btnShowLog.addEventListener('click', function () {
            const tab = document.querySelector('[data-tab="mixer-connection"]');
            if (tab) tab.click();
        });

        // Slider master — atualiza UI durante arraste, envia ao soltar
        els.masterSlider && els.masterSlider.addEventListener('input', function () {
            const level = Number(els.masterSlider.value) / 100;
            _renderMasterLevel(level, AppStore.getState().masterDb);
        });

        els.masterSlider && els.masterSlider.addEventListener('change', function () {
            MixerService.setMasterLevel(Number(els.masterSlider.value) / 100);
        });

        // Botões +1% / -1%
        els.masterDown && els.masterDown.addEventListener('click', function () {
            MixerService.adjustMasterLevel(-1);
        });
        els.masterUp && els.masterUp.addEventListener('click', function () {
            MixerService.adjustMasterLevel(1);
        });

        // Ações rápidas de canal
        els.btnQuickHpf && els.btnQuickHpf.addEventListener('click', function () {
            const ch = _getQuickChannel(); if (ch) MixerService.applyHpf(ch, 100);
        });

        els.btnQuickGate && els.btnQuickGate.addEventListener('click', function () {
            const ch = _getQuickChannel(); if (ch) MixerService.applyGate(ch);
        });

        els.btnAfsOn && els.btnAfsOn.addEventListener('click', function () {
            MixerService.setAfs(true);
        });

        els.btnAfsOff && els.btnAfsOff.addEventListener('click', function () {
            MixerService.setAfs(false);
        });

        // Ruído Rosa
        let isPinkActive = false;
        els.btnPinkNoiseMain && els.btnPinkNoiseMain.addEventListener('click', function () {
            isPinkActive = !isPinkActive;
            MixerService.setOscillator(isPinkActive);
            els.btnPinkNoiseMain.classList.toggle('active', isPinkActive);
            if (els.pinkNoiseStatus) {
                els.pinkNoiseStatus.innerText = isPinkActive ? 'LIGADO' : 'Desligado';
                els.pinkNoiseStatus.style.color = isPinkActive ? 'var(--accent-primary)' : 'var(--text-muted)';
            }
        });

        // Undo / Redo
        els.btnUndo && els.btnUndo.addEventListener('click', () => MixerService.undo());

        // Presets
        els.btnSavePreset && els.btnSavePreset.addEventListener('click', () => {
            const name = els.presetNameInput?.value.trim();
            if (!name) { alert('Dê um nome ao preset!'); return; }
            MixerService.savePreset(name);
            if (els.presetNameInput) els.presetNameInput.value = '';
        });

        const presetsTab = document.querySelector('[data-tab="mixer-presets"]');
        presetsTab?.addEventListener('click', () => MixerService.listPresets());

        // Esconde botão desconectar inicialmente
        if (els.btnDisconnect) els.btnDisconnect.style.display = 'none';
    }

    // -------------------------------------------------------------------------
    // Subscriptions no AppStore
    // -------------------------------------------------------------------------
    function _initSubscriptions() {
        AppStore.subscribe('mixerConnected', function (connected) {
            _renderMixerStatus(connected, AppStore.getState().mixerStatusMsg);
        });

        AppStore.subscribe('mixerStatusMsg', function (msg) {
            _renderMixerStatus(AppStore.getState().mixerConnected, msg);
        });

        AppStore.subscribe('masterLevel', function (level) {
            _renderMasterLevel(level, AppStore.getState().masterDb);
        });

        AppStore.subscribe('masterDb', function (db) {
            _renderMasterLevel(AppStore.getState().masterLevel, db);
        });

        AppStore.subscribe('mixerLog', function (logs) {
            _renderLog(logs);
        });

        AppStore.subscribe('aiSuggestions', function (suggestions) {
            _renderAISuggestions(suggestions);
        });

        SocketService.on('presets_list', (presets) => _renderPresets(presets));
        SocketService.on('preset_saved', () => MixerService.listPresets());
    }

    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------
    function init() {
        _initTabs();
        _initEvents();
        _initSubscriptions();
    }

    window.SoundMasterMixerPanel = { init };
})();
