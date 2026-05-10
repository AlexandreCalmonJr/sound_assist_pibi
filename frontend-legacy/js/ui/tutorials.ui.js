/**
 * SoundMaster — TutorialsUI
 * Gerencia a interatividade da página de Centro de Treinamento.
 */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    // -------------------------------------------------------------------------
    // Checklist de Soundcheck
    // -------------------------------------------------------------------------
    const CHECKLIST_ITEMS = [
        "Verificar voltagem da rede e aterramento",
        "Ligar periféricos (Mesa, Receptores sem fio)",
        "Ligar as caixas acústicas (PA por último)",
        "Verificar pilhas de todos os microfones",
        "Testar canais individuais (Gain/HPF)",
        "Ajustar mix de monitores para os músicos",
        "Verificar feedback no master (AFS2)",
        "Salvar cena inicial do culto"
    ];

    function initChecklist() {
        const container = $('soundcheck-list');
        if (!container) return;

        const saved = JSON.parse(localStorage.getItem('sm_soundcheck_state') || '{}');

        container.innerHTML = '';
        CHECKLIST_ITEMS.forEach((item, index) => {
            const id = `check-${index}`;
            const div = document.createElement('div');
            div.className = 'flex items-center gap-3 p-3 bg-black/20 rounded-xl hover:bg-black/40 transition-all cursor-pointer border border-transparent hover:border-white/5';
            div.innerHTML = `
                <input type="checkbox" id="${id}" ${saved[id] ? 'checked' : ''} class="accent-amber-500 w-4 h-4">
                <label for="${id}" class="text-[11px] font-bold text-slate-300 cursor-pointer flex-1">${item}</label>
            `;
            
            div.onclick = (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const cb = div.querySelector('input');
                    cb.checked = !cb.checked;
                    saveCheckState(id, cb.checked);
                }
            };
            
            div.querySelector('input').onchange = (e) => {
                saveCheckState(id, e.target.checked);
            };

            container.appendChild(div);
        });

        $('reset-checklist').onclick = () => {
            localStorage.removeItem('sm_soundcheck_state');
            initChecklist();
        };
    }

    function saveCheckState(id, state) {
        const saved = JSON.parse(localStorage.getItem('sm_soundcheck_state') || '{}');
        saved[id] = state;
        localStorage.setItem('sm_soundcheck_state', JSON.stringify(saved));
    }

    // -------------------------------------------------------------------------
    // Calculadora de Delay
    // -------------------------------------------------------------------------
    function initDelayCalc() {
        const range = $('delay-meters-range');
        const display = $('delay-meters-val');
        const result = $('delay-ms-result');

        if (!range) return;

        range.oninput = (e) => {
            const meters = parseFloat(e.target.value);
            display.innerText = `${meters}m`;
            
            // Velocidade do som aprox. 343.2 m/s a 20°C
            const ms = (meters / 343.2) * 1000;
            result.innerText = ms.toFixed(1);
        };
    }

    // -------------------------------------------------------------------------
    // Guia de EQ (Dados do data.js)
    // -------------------------------------------------------------------------
    function initEqGuide() {
        const select = $('eq-guide-select');
        const result = $('eq-guide-result');
        if (!select || !window.eqData) return;

        select.innerHTML = '<option value="">Selecione um instrumento...</option>';
        Object.keys(window.eqData).forEach(key => {
            const item = window.eqData[key];
            const opt = document.createElement('option');
            opt.value = key;
            opt.innerText = `${item.icon} ${item.title}`;
            opt.className = 'bg-slate-900';
            select.appendChild(opt);
        });

        select.onchange = (e) => {
            const key = e.target.value;
            if (!key) {
                result.innerHTML = '<p class="text-[10px] text-slate-600 italic">Selecione para ver as dicas técnicas...</p>';
                return;
            }

            const data = window.eqData[key];
            result.innerHTML = `
                <div class="space-y-3 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div class="flex items-center gap-2">
                        <span class="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded font-black">HPF</span>
                        <span class="text-[10px] text-white font-bold">${data.hpf}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs px-2 py-0.5 bg-red-500/20 text-red-500 rounded font-black">CORTAR</span>
                        <span class="text-[10px] text-white font-bold">${data.mud}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-500 rounded font-black">BRILHO</span>
                        <span class="text-[10px] text-white font-bold">${data.presence}</span>
                    </div>
                    <p class="text-[10px] text-slate-400 italic pt-2 border-t border-white/5 leading-tight">${data.tips}</p>
                </div>
            `;
        };
    }

    // -------------------------------------------------------------------------
    // Stepper RT60
    // -------------------------------------------------------------------------
    const RT60_STEPS = [
        { title: "1. Silêncio Total", desc: "Certifique-se de que não há ruído de ar condicionado ou pessoas falando na nave." },
        { title: "2. Disparar Pulso", desc: "Use o botão 'Disparar Pulso'. O sistema enviará um sinal de ruído rosa por 1 segundo." },
        { title: "3. Capturar Decaimento", desc: "O microfone ouvirá como o som 'morre' na sala por até 5 segundos." },
        { title: "4. Analisar Resultado", desc: "Verifique o tempo (segundos) em cada banda (125Hz, 500Hz, 1kHz, 4kHz)." }
    ];

    let currentRt60Step = 0;

    function initStepper() {
        const nextBtn = $('next-step');
        const prevBtn = $('prev-step');
        const content = $('step-content');
        const line = $('step-line');
        const dots = document.querySelectorAll('.step-dot');

        if (!nextBtn || !content) return;

        function updateUI() {
            const step = RT60_STEPS[currentRt60Step];
            content.innerHTML = `
                <h5 class="text-white font-bold mb-2 animate-in fade-in slide-in-from-top-2 duration-300">${step.title}</h5>
                <p class="text-[11px] text-slate-400 animate-in fade-in duration-500">${step.desc}</p>
            `;

            line.style.width = `${(currentRt60Step / (RT60_STEPS.length - 1)) * 100}%`;
            
            dots.forEach((dot, idx) => {
                if (idx <= currentRt60Step) {
                    dot.classList.add('bg-amber-500', 'border-amber-500');
                    dot.classList.remove('bg-slate-800', 'border-white/10', 'text-slate-500');
                    dot.classList.add('text-white');
                } else {
                    dot.classList.remove('bg-amber-500', 'border-amber-500', 'text-white');
                    dot.classList.add('bg-slate-800', 'border-white/10', 'text-slate-500');
                }
            });

            prevBtn.disabled = currentRt60Step === 0;
            prevBtn.style.opacity = currentRt60Step === 0 ? '0.5' : '1';
            prevBtn.style.cursor = currentRt60Step === 0 ? 'not-allowed' : 'pointer';

            nextBtn.innerText = currentRt60Step === RT60_STEPS.length - 1 ? 'RECOMEÇAR' : 'PRÓXIMO';
        }

        nextBtn.onclick = () => {
            if (currentRt60Step < RT60_STEPS.length - 1) {
                currentRt60Step++;
            } else {
                currentRt60Step = 0;
            }
            updateUI();
        };

        prevBtn.onclick = () => {
            if (currentRt60Step > 0) {
                currentRt60Step--;
                updateUI();
            }
        };

        updateUI();
    }

    // -------------------------------------------------------------------------
    // Glossário Técnico
    // -------------------------------------------------------------------------
    const GLOSSARY = [
        { term: "RT60", def: "Tempo necessário para o som decair 60dB após parar a fonte." },
        { term: "FFT", def: "Fast Fourier Transform. Converte o sinal de tempo para frequência." },
        { term: "AFS2", def: "Anti-Feedback Suppression. Filtros automáticos de microfonia." },
        { term: "SPL", def: "Sound Pressure Level. Medida da intensidade sonora em dB." },
        { term: "HPF", def: "High-Pass Filter. Corta graves abaixo de certa frequência." },
        { term: "Waterfall", def: "Gráfico 3D que mostra tempo, frequência e amplitude." },
        { term: "dB (Decibel)", def: "Unidade logarítmica usada para medir níveis de áudio." },
        { term: "Delay (ms)", def: "Atraso temporal em milissegundos para alinhar caixas." }
    ];

    function initGlossary() {
        const container = $('glossary-container');
        if (!container) return;

        container.innerHTML = '';
        GLOSSARY.forEach(item => {
            const div = document.createElement('div');
            div.className = 'p-3 bg-black/20 rounded-xl border border-white/5 hover:border-amber-500/30 transition-all cursor-help group';
            div.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-black text-white uppercase">${item.term}</span>
                    <span class="text-[9px] text-slate-500 group-hover:text-amber-500 transition-colors">Ver Definição</span>
                </div>
                <p class="hidden text-[10px] text-slate-400 mt-2 leading-tight animate-in fade-in slide-in-from-top-1">${item.def}</p>
            `;
            
            div.onclick = () => {
                const p = div.querySelector('p');
                const span = div.querySelector('.group-hover\\:text-amber-500');
                if (p.classList.contains('hidden')) {
                    p.classList.remove('hidden');
                    span.innerText = 'Fechar';
                } else {
                    p.classList.add('hidden');
                    span.innerText = 'Ver Definição';
                }
            };

            container.appendChild(div);
        });
    }

    // -------------------------------------------------------------------------
    // Navegação de Abas
    // -------------------------------------------------------------------------
    function initTabs() {
        const btnTutorials = $('btn-tab-tutorials');
        const btnTools = $('btn-tab-tools');
        const viewTutorials = $('view-tutorials');
        const viewTools = $('view-tools');

        if (!btnTutorials || !btnTools) return;

        btnTutorials.onclick = () => {
            // Estilo Botão Tutorials (Ativo)
            btnTutorials.classList.add('bg-amber-600', 'text-white', 'shadow-lg', 'shadow-amber-600/20');
            btnTutorials.classList.remove('text-slate-400');
            
            // Estilo Botão Tools (Inativo)
            btnTools.classList.remove('bg-amber-600', 'text-white', 'shadow-lg', 'shadow-amber-600/20');
            btnTools.classList.add('text-slate-400');

            // Visibilidade
            viewTutorials.classList.remove('hidden');
            viewTools.classList.add('hidden');
        };

        btnTools.onclick = () => {
            // Estilo Botão Tools (Ativo)
            btnTools.classList.add('bg-amber-600', 'text-white', 'shadow-lg', 'shadow-amber-600/20');
            btnTools.classList.remove('text-slate-400');
            
            // Estilo Botão Tutorials (Inativo)
            btnTutorials.classList.remove('bg-amber-600', 'text-white', 'shadow-lg', 'shadow-amber-600/20');
            btnTutorials.classList.add('text-slate-400');

            // Visibilidade
            viewTools.classList.remove('hidden');
            viewTutorials.classList.add('hidden');
            
            // Re-inicializa ferramentas se necessário (checklist render)
            initChecklist();
        };
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------
    document.addEventListener('page-loaded', (e) => {
        if (e.detail.pageId === 'tutorials') {
            console.log('[TutorialsUI] Inicializando ferramentas e abas...');
            initTabs();
            initChecklist();
            initDelayCalc();
            initEqGuide();
            initStepper();
            initGlossary();
        }
    });

})();
