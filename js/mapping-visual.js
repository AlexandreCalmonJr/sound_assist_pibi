/**
 * SoundMaster — MappingVisual
 * Gerencia o mapa 2D do salão e o registro de pontos de análise acústica.
 */
(function () {
    'use strict';

    let canvas, ctx;
    let churchWidth = 10, churchLength = 20;
    let measurements = []; // { x, y, db, hz, status }

    function init() {
        canvas = document.getElementById('mapping-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        canvas.addEventListener('click', _handleCanvasClick);
        
        const btnClear = document.getElementById('btn-clear-mapping');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                measurements = [];
                _drawMap();
            });
        }
    }

    function updateDimensions(w, l) {
        churchWidth = w;
        churchLength = l;
        _drawMap();
    }

    function _drawMap() {
        if (!ctx) return;
        
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Calcular escala mantendo proporção
        const padding = 40;
        const availableW = w - padding * 2;
        const availableH = h - padding * 2;
        
        const scale = Math.min(availableW / churchWidth, availableH / churchLength);
        
        const drawW = churchWidth * scale;
        const drawL = churchLength * scale;
        const offsetX = (w - drawW) / 2;
        const offsetY = (h - drawL) / 2;

        // Desenha contorno do salão
        ctx.strokeStyle = 'var(--accent-primary)';
        ctx.lineWidth = 2;
        ctx.strokeRect(offsetX, offsetY, drawW, drawL);
        
        // Grid leve
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let i = 1; i < churchWidth; i++) {
            let x = offsetX + (i * scale);
            ctx.beginPath(); ctx.moveTo(x, offsetY); ctx.lineTo(x, offsetY + drawL); ctx.stroke();
        }
        for (let i = 1; i < churchLength; i++) {
            let y = offsetY + (i * scale);
            ctx.beginPath(); ctx.moveTo(offsetX, y); ctx.lineTo(offsetX + drawW, y); ctx.stroke();
        }

        // Palco (assumindo que o palco está no topo/frente)
        ctx.fillStyle = 'rgba(0, 255, 204, 0.1)';
        ctx.fillRect(offsetX, offsetY, drawW, drawL * 0.15);
        ctx.fillStyle = 'var(--accent-primary)';
        ctx.font = '10px Inter';
        ctx.fillText('PALCO / ALTAR', offsetX + 10, offsetY + 15);

        // Desenha pontos de medição
        measurements.forEach(m => {
            const px = offsetX + (m.x * scale);
            const py = offsetY + (m.y * scale);
            
            ctx.beginPath();
            ctx.arc(px, py, 8, 0, Math.PI * 2);
            ctx.fillStyle = m.status === 'danger' ? '#e74c3c' : (m.status === 'warning' ? '#f1c40f' : '#2ecc71');
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(`${m.hz}Hz`, px, py + 20);
        });
    }

    function _handleCanvasClick(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Inverter escala para metros
        const padding = 40;
        const scale = Math.min((canvas.width - padding * 2) / churchWidth, (canvas.height - padding * 2) / churchLength);
        const offsetX = (canvas.width - (churchWidth * scale)) / 2;
        const offsetY = (canvas.height - (churchLength * scale)) / 2;

        const meterX = (mouseX - offsetX) / scale;
        const meterY = (mouseY - offsetY) / scale;

        if (meterX < 0 || meterX > churchWidth || meterY < 0 || meterY > churchLength) return;

        // Capturar análise atual se existir
        if (window.SoundMasterAnalyzer && window.SoundMasterAnalyzer.hasAnalysis()) {
            const analysis = window.SoundMasterAnalyzer.getLastAnalysis();
            const peakHz = analysis.details.peakHz;
            const peakDb = parseFloat(analysis.details.peakDb);
            
            let status = 'safe';
            if (peakDb > -25) status = 'danger';
            else if (peakDb > -40) status = 'warning';

            measurements.push({ x: meterX, y: meterY, hz: peakHz, db: peakDb, status: status });
            _drawMap();
            
            // Enviar para IA com contexto de localização
            if (window.AIService) {
                const locDesc = `Ponto de medição no mapa: x=${meterX.toFixed(1)}m, y=${meterY.toFixed(1)}m. `;
                AIService.ask(locDesc + ' analise o som ambiente', 1, {
                    peakHz: peakHz,
                    peakDb: peakDb,
                    location: { x: meterX, y: meterY }
                });
            }
        } else {
            alert('Ative o microfone primeiro para capturar som neste ponto.');
        }
    }

    window.SoundMasterMapping = { init, updateDimensions };
})();
