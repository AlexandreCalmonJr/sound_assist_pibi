(function () {
    function initEqGuide() {
        const eqSelect = document.getElementById('eq-instrument-select');
        const eqDisplay = document.getElementById('eq-data-display');
        if (!eqSelect || !eqDisplay || typeof eqData === 'undefined') return;

        function updateEqDisplay() {
            const data = eqData[eqSelect.value];
            if (!data) return;

            eqDisplay.innerHTML = `
                <div style="font-size: 2rem; margin-bottom: 10px;">${data.icon}</div>
                <h3 style="margin-bottom: 15px; color: var(--accent-primary);">${data.title}</h3>
                <div style="margin-bottom: 10px;"><strong>HPF (Corte de Graves):</strong> <span style="color: var(--text-muted)">${data.hpf}</span></div>
                <div style="margin-bottom: 10px;"><strong>Área Crítica (Mud):</strong> <span style="color: var(--warning)">${data.mud}</span></div>
                <div style="margin-bottom: 10px;"><strong>Presença/Clareza:</strong> <span style="color: var(--success)">${data.presence}</span></div>
                <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--border); font-size: 0.9rem;">
                    <em>Dica: ${data.tips}</em>
                </div>
            `;
        }

        const btnSync = document.getElementById('btn-sync-eq-ai');
        if (btnSync) {
            btnSync.onclick = () => {
                const instrument = eqSelect.options[eqSelect.selectedIndex].text;
                const channelInput = document.getElementById('ai-target-channel');
                const channel = channelInput ? channelInput.value : 1;
                
                if (window.AIService) {
                    AIService.ask(`Equalizar ${instrument} no canal ${channel}`, channel);
                }
            };
        }

        eqSelect.addEventListener('change', updateEqDisplay);
        updateEqDisplay();
    }

    function initRt60Calculator() {
        const btnCalc = document.getElementById('btn-calc-rt60');
        const rtResult = document.getElementById('rt60-result');
        if (!btnCalc || !rtResult) return;

        btnCalc.addEventListener('click', () => {
            const length = parseFloat(document.getElementById('rt-length').value);
            const width = parseFloat(document.getElementById('rt-width').value);
            const height = parseFloat(document.getElementById('rt-height').value);
            const delayDist = parseFloat(document.getElementById('rt-delay-dist').value) || 0;
            const absorptionCoef = parseFloat(document.getElementById('rt-absorption').value);

            if (!length || !width || !height) {
                alert('Por favor, preencha as dimensões da igreja.');
                return;
            }

            const volume = length * width * height;
            const surfaceArea = (2 * length * width) + (2 * length * height) + (2 * width * height);
            const totalAbsorption = surfaceArea * absorptionCoef;
            const rt60 = totalAbsorption > 0 ? 0.161 * (volume / totalAbsorption) : 0;
            const delayMs = delayDist > 0 ? (delayDist / 343) * 1000 : 0;

            let statusClass = 'safe';
            let statusText = 'Ideal para fala / Palavra';
            let suggestions = 'A acústica está seca e favorece a pregação. Pode faltar um pouco de calor na música, mas é o cenário mais seguro.';

            if (rt60 >= 1.6) {
                statusClass = 'danger';
                statusText = 'Reverberação Excessiva';
                suggestions = 'O som pode embolar e refletir nos vidros. Reduza o volume geral, controle graves e feche cortinas acústicas.';
            } else if (rt60 >= 1.0) {
                statusClass = 'warning';
                statusText = 'Aceitável para culto contemporâneo';
                suggestions = 'Bom balanço para louvor, mas a fala exige cuidado com volume, médios e articulação.';
            }

            const delayHtml = delayDist > 0 ? `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border);">
                    <h4 style="margin-bottom: 5px; color: var(--accent-primary);">Ajuste de Delay</h4>
                    <p style="font-size: 0.9rem;">Configure o delay de saída na Ui24R para as caixas auxiliares em:</p>
                    <p style="font-size: 1.2rem; font-weight: bold; color: var(--warning); margin-top: 5px;">${delayMs.toFixed(1)} ms</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px;">Isso alinha o PA principal com o fundo e reduz eco percebido.</p>
                </div>
            ` : '';

            rtResult.style.display = 'block';
            rtResult.className = `card alert-card mt-15 ${statusClass}`;
            rtResult.innerHTML = `
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px;">
                    <span>Volume: ${Math.round(volume)}m³</span>
                    <span>Área: ${Math.round(surfaceArea)}m²</span>
                </div>
                <h3>RT60 Estimado: ${rt60.toFixed(2)} seg</h3>
                <p style="color: var(--${statusClass === 'safe' ? 'success' : statusClass === 'warning' ? 'warning' : 'danger'}); font-weight: bold; margin: 10px 0;">${statusText}</p>
                <p style="font-size: 0.9rem">${suggestions}</p>
                ${delayHtml}
            `;

            // Atualizar Mapa Visual
            const mappingContainer = document.getElementById('mapping-container');
            if (mappingContainer) {
                mappingContainer.style.display = 'block';
                if (window.SoundMasterMapping) {
                    SoundMasterMapping.updateDimensions(width, length);
                }
            }
        });
    }

    function init() {
        initEqGuide();
        initRt60Calculator();
    }

    window.SoundMasterChurchTools = { init };

    // Ouvir eventos do roteador
    document.addEventListener('page-loaded', (e) => {
        if (e.detail.pageId === 'eq') {
            initEqGuide();
        } else if (e.detail.pageId === 'rt60') {
            initRt60Calculator();
        }
    });
})();
