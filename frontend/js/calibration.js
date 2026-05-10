(function() {
    let calibrationData = []; // [{hz: 10, offset: 1.2}, ...]
    let splOffset = 0;
    let useAWeighting = true; // Padrão para SPL profissional

    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const text = await file.text();
        parseCalFile(text);
        
        const status = document.getElementById('cal-status');
        if(status) {
            status.innerText = 'Microfone Calibrado ✅';
            status.className = 'text-green-400 font-bold';
        }
        
        // Persistência via API (NeDB) em vez de localStorage
        fetch('/api/calibration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ calibrationData, splOffset })
        })
        .then(res => { if (!res.ok) throw new Error('Erro no servidor'); })
        .catch(err => {
            console.error('[Calibration] Erro ao salvar:', err);
            alert('Erro ao salvar calibração no servidor. Verifique a conexão.');
        });
        
        alert('Arquivo de calibração carregado com sucesso!');
    }

    function parseCalFile(text) {
        calibrationData = [];
        const lines = text.split('\n');
        for(let line of lines) {
            line = line.trim();
            if(!line || line.startsWith('*') || line.startsWith('"')) continue;
            
            // Aceita espaço, tabulação ou vírgula
            const parts = line.split(/[\s,;'\t]+/);
            if(parts.length >= 2) {
                const hz = parseFloat(parts[0]);
                const offset = parseFloat(parts[1]); 
                if(!isNaN(hz) && !isNaN(offset)) {
                    calibrationData.push({hz, offset});
                }
            }
        }
        console.log(`[Calibration] Loaded ${calibrationData.length} correction points.`);
    }

    // Otimização: Cache de offset por Bin do FFT para não recalcular a cada frame
    let offsetCache = null;
    let lastBinCount = 0;

    function buildOffsetCache(binCount, sampleRate) {
        offsetCache = new Float32Array(binCount);
        const nyquist = sampleRate / 2;
        const hzPerBin = nyquist / binCount;

        for(let i=0; i < binCount; i++) {
            const hz = i * hzPerBin;
            
            // 1. Calcular Ponderação A (dBA)
            // Fórmula: Ra(f) = (12194^2 * f^4) / ((f^2 + 20.6^2) * sqrt((f^2 + 107.7^2) * (f^2 + 737.9^2)) * (f^2 + 12194^2))
            // A(f) = 20 * log10(Ra(f)) + 2.0
            let aWeight = 0;
            if (useAWeighting && hz > 0) {
                const f2 = hz * hz;
                const f4 = f2 * f2;
                const rA = (148693636 * f4) / 
                           ((f2 + 424.36) * Math.sqrt((f2 + 11599.29) * (f2 + 544496.41)) * (f2 + 148693636));
                aWeight = 20 * Math.log10(rA) + 2.0;
            }

            if(calibrationData.length === 0) {
                offsetCache[i] = aWeight;
                continue;
            }

            // ✅ Correção Auditoria: Interpolação Linear entre os pontos do arquivo .cal
            // Ordenar pontos por frequência caso não estejam
            const sorted = [...calibrationData].sort((a, b) => a.hz - b.hz);
            
            if (hz <= sorted[0].hz) {
                offsetCache[i] = sorted[0].offset;
            } else if (hz >= sorted[sorted.length - 1].hz) {
                offsetCache[i] = sorted[sorted.length - 1].offset;
            } else {
                for (let j = 0; j < sorted.length - 1; j++) {
                    if (hz >= sorted[j].hz && hz <= sorted[j + 1].hz) {
                        const t = (hz - sorted[j].hz) / (sorted[j + 1].hz - sorted[j].hz);
                        offsetCache[i] = (sorted[j].offset + t * (sorted[j + 1].offset - sorted[j].offset)) + aWeight;
                        break;
                    }
                }
            }
        }
    }

    function applyCalibration(freqDataArray, sampleRate) {
        if(calibrationData.length === 0 && splOffset === 0) return;
        
        const binCount = freqDataArray.length;
        if(lastBinCount !== binCount || !offsetCache) {
            buildOffsetCache(binCount, sampleRate);
            lastBinCount = binCount;
        }

        for(let i=0; i<binCount; i++) {
            // Aplica correção por frequência (EQ do Mic) + Offset de Referência SPL
            freqDataArray[i] += offsetCache[i] + splOffset;
        }
    }

    function calibrateSPL(currentRawDb) {
        // Calibrador externo gera tom de 1kHz a 94dB SPL
        // A diferença entre o lido e o 94 é o nosso offset global.
        splOffset = 94 - currentRawDb;
        const disp = document.getElementById('spl-offset-display');
        if(disp) disp.innerText = `${splOffset.toFixed(1)} dB`;
        
        fetch('/api/calibration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ calibrationData, splOffset })
        })
        .then(res => { if (!res.ok) throw new Error('Erro no servidor'); })
        .catch(err => console.error('[Calibration] Erro ao salvar SPL:', err));
        
        alert(`Offset global ajustado para ${splOffset.toFixed(1)} dB`);
    }

    function clearCalibration() {
        calibrationData = [];
        splOffset = 0;
        offsetCache = null;
        lastBinCount = 0;
        
        fetch('/api/calibration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ calibrationData: [], splOffset: 0 })
        }).catch(err => console.error('[Calibration] Erro ao limpar:', err));
        
        const status = document.getElementById('cal-status');
        if(status) {
            status.innerText = 'Sem calibração (Microfone Genérico)';
            status.className = 'text-amber-400 font-bold';
        }
        const disp = document.getElementById('spl-offset-display');
        if(disp) disp.innerText = `0.0 dB`;
        
        const input = document.getElementById('cal-file-input');
        if (input) input.value = '';
        
        alert('Calibração removida. Microfone voltou ao estado genérico (Flat).');
    }

    window.AcousticCalibration = {
        applyCalibration,
        calibrateSPL,
        clearCalibration,
        getCurrentSplOffset: () => splOffset
    };

    document.addEventListener('page-loaded', (e) => {
        if (e.detail.pageId === 'analyzer') {
            const input = document.getElementById('cal-file-input');
            if(input) input.addEventListener('change', handleFileUpload);
            
            const btnClear = document.getElementById('btn-clear-calibration');
            if(btnClear) btnClear.addEventListener('click', clearCalibration);
            
            // Recupera do servidor
            fetch('/api/calibration')
                .then(res => res.json())
                .then(data => {
                    if (data.calibrationData && data.calibrationData.length > 0) {
                        calibrationData = data.calibrationData;
                        const status = document.getElementById('cal-status');
                        if(status) {
                            status.innerText = 'Microfone Calibrado (Recuperado do DB) ✅';
                            status.className = 'text-green-400 font-bold';
                        }
                    }
                    if (data.splOffset) {
                        splOffset = data.splOffset;
                        const disp = document.getElementById('spl-offset-display');
                        if(disp) disp.innerText = `${splOffset.toFixed(1)} dB`;
                    }
                })
                .catch(err => console.warn('[Calibration] Falha ao recuperar do servidor:', err));
            
            // Listener para o botão de Calibrar SPL
            const btnSpl = document.getElementById('btn-calibrate-spl');
            if(btnSpl) {
                btnSpl.addEventListener('click', () => {
                    // Para simplificar, pega o valor RMS atual calculado no analyzer.js
                    // window.currentGlobalRMS é atualizado pelo analyzer
                    if (window.currentGlobalRMS) {
                        const rawDb = 20 * Math.log10(window.currentGlobalRMS + 1e-6);
                        calibrateSPL(rawDb);
                    } else {
                        alert('Ative o microfone e toque um tom de teste de 94dB antes de calibrar.');
                    }
                });
            }
        }
    });

})();
