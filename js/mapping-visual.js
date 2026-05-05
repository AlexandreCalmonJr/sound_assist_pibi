/**
 * SoundMaster — MappingVisual
 * Gerencia o mapa 2D do salão e o registro de pontos de análise acústica.
 */
(function () {
    'use strict';

    let canvas, ctx;
    let churchWidth = 10, churchLength = 20;
    let measurements = []; // { x, y, db, hz, status }
    let floorPlanImage = null;

    function init() {
        canvas = document.getElementById('mapping-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        // Ajustar resolução interna do canvas para evitar borrões
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = (rect.width * (churchLength / churchWidth)) * dpr;
        if (canvas.height > 600) canvas.height = 600; // Limite de segurança

        canvas.addEventListener('click', _handleCanvasClick);
        
        document.getElementById('btn-clear-mapping')?.addEventListener('click', () => {
            measurements = [];
            _drawMap();
        });

        document.getElementById('btn-export-mapping')?.addEventListener('click', _exportMap);
        
        const btnImport = document.getElementById('btn-import-floorplan');
        const inputFloorPlan = document.getElementById('input-floorplan');
        
        btnImport?.addEventListener('click', () => inputFloorPlan.click());
        inputFloorPlan?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        floorPlanImage = img;
                        _drawMap();
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        _drawMap();
    }

    function updateDimensions(w, l) {
        churchWidth = w;
        churchLength = l;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.height = (rect.width * (churchLength / churchWidth)) * dpr;
        _drawMap();
    }

    function _drawHeatmap(offsetX, offsetY, drawW, drawL, scale) {
        if (measurements.length < 1) return;

        ctx.save();
        // Criar um efeito de "glow" para o heatmap
        ctx.globalCompositeOperation = 'screen';
        
        measurements.forEach(m => {
            const px = offsetX + (m.x * scale);
            const py = offsetY + (m.y * scale);
            const radius = 80 * (scale / 20); // Escala o raio do heatmap

            const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
            
            if (m.status === 'danger') {
                gradient.addColorStop(0, 'rgba(231, 76, 60, 0.6)');
                gradient.addColorStop(1, 'rgba(231, 76, 60, 0)');
            } else if (m.status === 'warning') {
                gradient.addColorStop(0, 'rgba(241, 196, 15, 0.4)');
                gradient.addColorStop(1, 'rgba(241, 196, 15, 0)');
            } else {
                gradient.addColorStop(0, 'rgba(46, 204, 113, 0.3)');
                gradient.addColorStop(1, 'rgba(46, 204, 113, 0)');
            }

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();
    }

    function _drawMap() {
        if (!ctx) return;
        
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const padding = 40;
        const availableW = w - padding * 2;
        const availableH = h - padding * 2;
        const scale = Math.min(availableW / churchWidth, availableH / churchLength);
        const drawW = churchWidth * scale;
        const drawL = churchLength * scale;
        const offsetX = (w - drawW) / 2;
        const offsetY = (h - drawL) / 2;

        // 1. Desenha Planta Baixa (Fundo)
        if (floorPlanImage) {
            ctx.globalAlpha = 0.4;
            ctx.drawImage(floorPlanImage, offsetX, offsetY, drawW, drawL);
            ctx.globalAlpha = 1.0;
        }

        // 2. Desenha Heatmap (Interpolação)
        _drawHeatmap(offsetX, offsetY, drawW, drawL, scale);

        // 3. Desenha Contorno e Grid
        ctx.strokeStyle = 'rgba(0, 207, 213, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(offsetX, offsetY, drawW, drawL);
        
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

        // 4. Palco
        ctx.fillStyle = 'rgba(0, 207, 213, 0.1)';
        ctx.fillRect(offsetX, offsetY, drawW, drawL * 0.15);
        ctx.fillStyle = '#00cfd5';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('ALTAR / PALCO', offsetX + 15, offsetY + 25);

        // 5. Pontos de medição
        measurements.forEach(m => {
            const px = offsetX + (m.x * scale);
            const py = offsetY + (m.y * scale);
            
            // Glow externo do ponto
            ctx.shadowBlur = 15;
            ctx.shadowColor = m.status === 'danger' ? '#e74c3c' : (m.status === 'warning' ? '#f1c40f' : '#2ecc71');
            
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = ctx.shadowColor;
            ctx.fill();
            
            ctx.shadowBlur = 0; // Reset shadow
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Label de frequência
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.fillText(`${m.hz}Hz`, px, py + 22);
            ctx.font = '9px Inter';
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(`${m.db}dB`, px, py + 34);
        });
    }

    function _exportMap() {
        if (measurements.length === 0) {
            alert('Adicione alguns pontos de medição antes de exportar.');
            return;
        }
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Mapa_Acustico_${new Date().toLocaleDateString()}.png`;
        link.href = dataUrl;
        link.click();
    }

    function _handleCanvasClick(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);

        const padding = 40;
        const scale = Math.min((canvas.width - padding * 2) / churchWidth, (canvas.height - padding * 2) / churchLength);
        const offsetX = (canvas.width - (churchWidth * scale)) / 2;
        const offsetY = (canvas.height - (churchLength * scale)) / 2;

        const meterX = (mouseX - offsetX) / scale;
        const meterY = (mouseY - offsetY) / scale;

        if (meterX < 0 || meterX > churchWidth || meterY < 0 || meterY > churchLength) return;

        if (window.SoundMasterAnalyzer && window.SoundMasterAnalyzer.hasAnalysis()) {
            const analysis = window.SoundMasterAnalyzer.getLastAnalysis();
            const peakHz = analysis.details.peakHz;
            const peakDb = parseFloat(analysis.details.peakDb);
            
            let status = 'safe';
            if (peakDb > -20) status = 'danger';
            else if (peakDb > -35) status = 'warning';

            measurements.push({ x: meterX, y: meterY, hz: peakHz, db: peakDb, status: status });
            _drawMap();
            
            if (window.AIService) {
                const locDesc = `Ponto registrado no mapa em x=${meterX.toFixed(1)}m, y=${meterY.toFixed(1)}m. `;
                AIService.ask(locDesc + ' Analise este ponto específico.', 1, {
                    peakHz: peakHz,
                    peakDb: peakDb,
                    location: { x: meterX.toFixed(2), y: meterY.toFixed(2) }
                });
            }
        } else {
            alert('O microfone deve estar ativo para capturar dados neste ponto.');
        }
    }

    window.SoundMasterMapping = { init, updateDimensions };

    document.addEventListener('page-loaded', (e) => {
        if (e.detail.pageId === 'rt60') {
            setTimeout(init, 100); // Delay para garantir que o DOM renderizou
        }
    });
})();
