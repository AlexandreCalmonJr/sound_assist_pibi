/**
 * SoundMaster — MixerPagesUI
 * Gerencia a interatividade das páginas do submenu Mixer (Canais, Aux, FX, Presets).
 */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    // -------------------------------------------------------------------------
    // Canais de Entrada (Mixer Input)
    // -------------------------------------------------------------------------
    async function initMixerInput() {
        const container = $('mixer-channels-container');
        const targetSelect = $('mixer-target-select');
        if (!container) return;

        // Carrega nomes do DB
        const savedNames = await MixerService.loadNames();
        const chNames = savedNames.channels || {};

        let currentTarget = targetSelect ? targetSelect.value : 'master';

        if (targetSelect) {
            targetSelect.onchange = (e) => {
                currentTarget = e.target.value;
                AppStore.addLog(`Console alterado para mixagem de: ${currentTarget.toUpperCase()}`);
            };
        }

        container.innerHTML = '';
        for (let i = 1; i <= 24; i++) {
            const chName = chNames[i] || `CANAL ${i}`;
            const chDiv = document.createElement('div');
            chDiv.className = 'w-24 flex flex-col gap-4 flex-shrink-0';
            chDiv.innerHTML = `
                <div class="flex-1 bg-black/40 rounded-2xl p-3 flex flex-col items-center gap-4 border border-white/5 group hover:border-cyan-500/30 transition-all">
                    <span class="text-[10px] font-black text-slate-500 uppercase">Ch ${i.toString().padStart(2, '0')}</span>
                    <!-- Meter -->
                    <div class="flex-1 w-2 bg-slate-800 rounded-full relative overflow-hidden">
                        <div id="meter-ch-${i}" class="absolute bottom-0 w-full bg-cyan-500 h-[0%] transition-all duration-200"></div>
                    </div>
                    <!-- Gain Fader Container -->
                    <div class="w-6 h-20 relative flex items-center justify-center bg-black/20 rounded-xl border border-white/5 overflow-hidden">
                         <input type="range" id="gain-ch-${i}" min="0" max="100" value="75" 
                                class="fader-vertical text-cyan-500" orient="vertical">
                    </div>
                    <!-- Nome Editável -->
                    <input type="text" id="name-ch-${i}" value="${chName}" 
                           class="bg-transparent text-[9px] font-bold text-white text-center w-full focus:outline-none focus:bg-white/5 rounded p-1 border-b border-transparent focus:border-cyan-500/50">
                </div>
                <button id="mute-ch-${i}" class="py-2 bg-slate-800 text-slate-500 text-[10px] font-black rounded-lg border border-white/5 transition-all">MUTE</button>
            `;
            container.appendChild(chDiv);

            // Listeners
            $(`mute-ch-${i}`).onclick = () => {
                const isMuted = AppStore.getState()[`mute_ch_${i}`];
                MixerService.sendRaw(`SETD|c|${i - 1}|mute|${isMuted ? 0 : 1}`);
                AppStore.setState({ [`mute_ch_${i}`]: !isMuted });
                updateMuteUI(i, !isMuted);
            };

            $(`gain-ch-${i}`).oninput = (e) => {
                const val = e.target.value / 100;
                if (currentTarget === 'master') {
                    MixerService.sendRaw(`SETD|c|${i - 1}|mix|${val}`);
                } else if (currentTarget.startsWith('aux')) {
                    const auxIdx = parseInt(currentTarget.replace('aux', ''));
                    MixerService.setAuxLevel(i, auxIdx, val);
                }
            };

            // Salvar nome ao sair do foco
            $(`name-ch-${i}`).onblur = (e) => {
                const newNames = AppStore.getState().mixerNames || { channels: {}, aux: {} };
                newNames.channels[i] = e.target.value;
                MixerService.saveNames(newNames);
            };
        }
    }

    function updateMuteUI(ch, isMuted) {
        const btn = $(`mute-ch-${ch}`);
        if (!btn) return;
        if (isMuted) {
            btn.classList.replace('bg-slate-800', 'bg-red-900/40');
            btn.classList.replace('text-slate-500', 'text-red-500');
            btn.classList.add('border-red-500/20');
        } else {
            btn.classList.replace('bg-red-900/40', 'bg-slate-800');
            btn.classList.replace('text-red-500', 'text-slate-500');
            btn.classList.remove('border-red-500/20');
        }
    }

    // -------------------------------------------------------------------------
    // Auxiliares (Mixer Aux)
    // -------------------------------------------------------------------------
    async function initMixerAux() {
        const container = $('mixer-aux-container');
        if (!container) return;

        const savedNames = await MixerService.loadNames();
        const auxNamesMap = savedNames.aux || {};

        container.innerHTML = '';
        const defaultNames = ['Pastor', 'Líder', 'Vocal 1', 'Vocal 2', 'Piano', 'Bateria', 'Guit 1', 'Guit 2', 'Side L', 'Side R'];

        for (let i = 1; i <= 10; i++) {
            const auxName = auxNamesMap[i] || defaultNames[i - 1] || `AUX ${i}`;
            const auxCard = document.createElement('div');
            auxCard.className = 'bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4';
            auxCard.innerHTML = `
                <div class="flex items-center justify-between">
                    <input type="text" id="name-aux-${i}" value="${auxName}" 
                           class="bg-transparent text-xs font-black uppercase tracking-widest text-slate-500 focus:outline-none focus:text-white transition-colors">
                    <span class="px-2 py-1 bg-green-900/40 text-green-400 text-[9px] font-bold rounded border border-green-500/20">POST-FADER</span>
                </div>
                
                <div class="h-20 bg-black/40 rounded-xl p-4 flex flex-col gap-4 items-center">
                    <div class="flex flex-col gap-2 h-full items-center">
                        <span class="text-[9px] text-slate-500 uppercase font-black">Nível Envio</span>
                        <div class="flex-1 w-12 flex justify-center">
                            <input type="range" id="aux-level-${i}" min="0" max="100" value="70" 
                                   class="fader-vertical text-purple-500" orient="vertical">
                        </div>
                    <div class="flex flex-col gap-1 w-full">
                        <span class="text-[9px] text-slate-500 uppercase font-black">Delay</span>
                        <input type="range" id="aux-delay-${i}" min="0" max="500" value="0" class="w-full accent-cyan-500 cursor-pointer">
                    </div>
                </div>
 
                <div class="flex gap-2">
                    <button id="btn-aux-mute-${i}" class="flex-1 py-2 bg-slate-800 text-slate-500 text-[10px] font-black rounded-lg border border-white/5">MUTE AUX</button>
                </div>
            `;
            container.appendChild(auxCard);

            $(`aux-level-${i}`).oninput = (e) => {
                const val = e.target.value / 100;
                MixerService.sendRaw(`SETD|a|${i - 1}|mix|${val}`);
            };

            $(`aux-delay-${i}`).oninput = (e) => {
                const ms = e.target.value;
                MixerService.setDelay(i, ms);
            };

            $(`name-aux-${i}`).onblur = (e) => {
                const newNames = AppStore.getState().mixerNames || { channels: {}, aux: {} };
                newNames.aux[i] = e.target.value;
                MixerService.saveNames(newNames);
            };
        }
    }

    // -------------------------------------------------------------------------
    // Efeitos (Mixer FX)
    // -------------------------------------------------------------------------
    function initMixerFx() {
        const container = $('mixer-fx-container');
        if (!container) return;

        container.innerHTML = '';
        const fxTypes = ['HALL REVERB', 'ROOM REVERB', 'DIGITAL DELAY', 'CHORUS'];

        for (let i = 1; i <= 4; i++) {
            const fxCard = document.createElement('div');
            fxCard.className = 'bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-6';
            fxCard.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-black text-indigo-400 uppercase tracking-widest">FX ${i}</span>
                    <span class="text-[9px] font-bold text-slate-500">${fxTypes[i - 1]}</span>
                </div>
                
                <div class="h-64 w-16 bg-black/40 rounded-2xl mx-auto relative flex items-center justify-center border border-white/5 overflow-hidden">
                    <input type="range" id="fx-level-${i}" min="0" max="100" value="50" 
                           class="fader-vertical text-indigo-500" orient="vertical">
                </div>
 
                <div class="text-center">
                    <span id="fx-val-${i}" class="text-xl font-black text-white">50</span>
                    <span class="text-[10px] text-slate-500 ml-1">%</span>
                </div>
            `;
            container.appendChild(fxCard);

            $(`fx-level-${i}`).oninput = (e) => {
                const val = e.target.value;
                $(`fx-val-${i}`).innerText = val;
                MixerService.sendRaw(`SETD|f|${i - 1}|mix|${val / 100}`);
            };
        }
    }

    // -------------------------------------------------------------------------
    // Presets de Voz (Voice Presets)
    // -------------------------------------------------------------------------
    function initVoicePresets() {
        const select = $('voice-preset-channel');
        if (!select) return;

        // Popula canais 1-24
        select.innerHTML = '';
        for (let i = 1; i <= 24; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.className = 'bg-slate-900';
            opt.innerText = `Canal ${i.toString().padStart(2, '0')}`;
            select.appendChild(opt);
        }

        // Configura botões
        const btnApply = document.querySelectorAll('.bg-rose-600, .bg-cyan-600');
        btnApply.forEach(btn => {
            btn.onclick = () => {
                const ch = select.value;
                const type = btn.closest('.bg-slate-900\\/60, .bg-cyan-900\\/20').querySelector('h3').innerText;

                let opts = {};
                if (type.includes('Barítono')) opts = { hpf: 120, low: -2 };
                if (type.includes('Soprano')) opts = { hpf: 150, high: 2 };
                if (type.includes('Pregador')) opts = { compressor: 'aggressive', afs: true };

                MixerService.runCleanSoundPreset(ch, opts);
                AppStore.addLog(`IA: Aplicando preset [${type}] ao canal ${ch}`);

                const originalText = btn.innerText;
                btn.innerText = 'APLICADO ✓';
                btn.classList.add('bg-green-600');
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.classList.remove('bg-green-600');
                }, 2000);
            };
        });
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------
    document.addEventListener('page-loaded', (e) => {
        const pageId = e.detail.pageId;
        console.log(`[MixerPages] Página carregada: ${pageId}`);

        if (pageId === 'mixer-input') initMixerInput();
        if (pageId === 'mixer-aux') initMixerAux();
        if (pageId === 'mixer-fx') initMixerFx();
        if (pageId === 'voice-presets') initVoicePresets();
    });

})();
