(function() {
    let points = [];
    let bgImageSrc = null;
    let persistedHeatmapId = null;

    function initHeatmap() {
        const upload = document.getElementById('heatmap-image-upload');
        const btnUpload = document.getElementById('btn-heatmap-upload');
        const container = document.getElementById('heatmap-container');
        const btnClear = document.getElementById('btn-clear-heatmap');
        
        if(btnUpload && upload) btnUpload.onclick = () => upload.click();
        if(upload) upload.addEventListener('change', handleImageUpload);
        if(container) container.onclick = handleContainerClick;
        if(btnClear) btnClear.onclick = clearHeatmap;
        
        const savedImg = localStorage.getItem('heatmap_bg');
        if(savedImg) {
            bgImageSrc = savedImg;
            showImage();
        }
        const savedPoints = localStorage.getItem('heatmap_points');
        if(savedPoints) {
            points = JSON.parse(savedPoints);
            // Dá um tempo pro DOM renderizar o tamanho do container
            setTimeout(() => {
                renderHeatmap();
                renderPins();
            }, 300);
        }
        const savedHeatmapId = localStorage.getItem('heatmap_snapshot_id');
        if (savedHeatmapId) {
            persistedHeatmapId = savedHeatmapId;
        }

        // ✅ Novo: Sincronização em tempo real via Socket
        if (window.SocketService) {
            window.SocketService.on('heatmap_updated', (data) => {
                if (data.snapshot && data.snapshot.points) points = data.snapshot.points;
                else if (data.points) points = data.points;
                if (data.bgImageSrc) {
                    bgImageSrc = data.bgImageSrc;
                    showImage();
                }
                if (data.snapshot && data.snapshot.bgImageSrc) {
                    bgImageSrc = data.snapshot.bgImageSrc;
                    showImage();
                }
                if (data._id) {
                    persistedHeatmapId = data._id;
                    localStorage.setItem('heatmap_snapshot_id', persistedHeatmapId);
                }
                renderHeatmap();
                renderPins();
            });
        }
    }

    function _getMeasurementMetadata(db) {
        const analyzer = window.SoundMasterAnalyzer;
        const analysis = analyzer && analyzer.hasAnalysis && analyzer.hasAnalysis() ? analyzer.getLastAnalysis() : null;
        const rt60 = analyzer && analyzer.getLastRt60 ? analyzer.getLastRt60() : null;
        return {
            schema_version: '1.1',
            type: 'heatmap',
            measurementType: 'spl-heatmap',
            summary: analysis ? analysis.text : 'Ponto SPL do mapa de calor',
            peakHz: analysis?.details?.peakHz ?? null,
            peakDb: analysis?.details?.peakDb ?? null,
            rms: analysis?.details?.rmsDb ?? null,
            spl: db,
            spectrum_db: analysis?.details?.spectrum_v11 || {},
            rt60: rt60?.rt60 ? Number(rt60.rt60) : null,
            rt60_multiband: rt60?.multiband || null
        };
    }

    function _persistHeatmap() {
        if (window.SocketService) {
            window.SocketService.emit('save_heatmap_snapshot', {
                _id: persistedHeatmapId,
                bgImageSrc,
                points,
                snapshot: {
                    bgImageSrc,
                    points,
                    ..._getMeasurementMetadata(points.length ? points[points.length - 1].db : null)
                }
            });
        }
    }

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if(!file) return;
        
        // Alerta sobre limite do localStorage (~5MB total, reservamos 2MB para a imagem)
        if (file.size > 2 * 1024 * 1024) {
            alert('Aviso: Imagens maiores que 2MB podem não ser salvas permanentemente devido ao limite do navegador. O mapa funcionará, mas você precisará carregar a imagem novamente ao reiniciar.');
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            bgImageSrc = ev.target.result;
            try {
                localStorage.setItem('heatmap_bg', bgImageSrc);
                _persistHeatmap();
            } catch(e) {
                console.warn('Imagem muito grande para o localStorage. Mantendo em memória temporária.');
            }
            showImage();
        };
        reader.readAsDataURL(file);
    }

    function showImage() {
        const img = document.getElementById('heatmap-bg');
        const placeholder = document.getElementById('heatmap-placeholder');
        if(img && bgImageSrc) {
            img.src = bgImageSrc;
            img.classList.remove('hidden');
            if(placeholder) placeholder.classList.add('hidden');
        }
    }

    function clearHeatmap() {
        if(confirm('Tem certeza que deseja apagar todos os pontos de medição?')) {
            points = [];
            localStorage.removeItem('heatmap_points');
            _persistHeatmap();
            renderHeatmap();
            renderPins();
            document.getElementById('heatmap-last-val').innerText = '-- dB';
        }
    }

    function handleContainerClick(e) {
        if(e.target.classList.contains('heatmap-pin')) return;

        const container = document.getElementById('heatmap-container');
        const rect = container.getBoundingClientRect();
        
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        let db = 75; 
        if (window.currentGlobalRMS) {
            // Conversão simplificada para dB SPL usando o offset calibrado
            let rawDb = 20 * Math.log10(window.currentGlobalRMS + 1e-6);
            if (window.AcousticCalibration) {
                rawDb += window.AcousticCalibration.getCurrentSplOffset();
            }
            db = rawDb;
        } else {
            alert('Ative o microfone na aba Visual para gravar leituras reais!');
            return;
        }

        document.getElementById('heatmap-last-val').innerText = `${db.toFixed(1)} dB`;

        const point = {
            x,
            y,
            db,
            position: { x, y },
            timestamp: new Date().toISOString(),
            ..._getMeasurementMetadata(db)
        };
        points.push(point);
        localStorage.setItem('heatmap_points', JSON.stringify(points));
        if (window.SoundMasterAnalyzer && typeof window.SoundMasterAnalyzer.setMeasurementPosition === 'function') {
            window.SoundMasterAnalyzer.setMeasurementPosition({ x, y });
        }
        _persistHeatmap();

        renderHeatmap();
        renderPins();
    }

    function getColorForDb(db) {
        const minDb = 75;
        const maxDb = 105;
        let percent = (db - minDb) / (maxDb - minDb);
        percent = Math.max(0, Math.min(1, percent));
        
        let r, g, b;
        if (percent < 0.5) {
            let p2 = percent * 2;
            r = 0;
            g = Math.round(p2 * 255);
            b = Math.round((1 - p2) * 255);
        } else {
            let p2 = (percent - 0.5) * 2;
            r = Math.round(p2 * 255);
            g = Math.round((1 - p2) * 255);
            b = 0;
        }
        return `rgba(${r}, ${g}, ${b}, 0.65)`;
    }

    function renderPins() {
        const layer = document.getElementById('heatmap-pins-layer');
        if(!layer) return;
        layer.innerHTML = '';
        
        points.forEach((p, i) => {
            const pin = document.createElement('div');
            pin.className = 'heatmap-pin absolute w-6 h-6 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[9px] font-black text-white';
            pin.style.left = `${p.x * 100}%`;
            pin.style.top = `${p.y * 100}%`;
            pin.style.backgroundColor = getColorForDb(p.db).replace('0.65', '1');
            pin.style.textShadow = '0px 1px 2px rgba(0,0,0,0.8)';
            pin.innerText = Math.round(p.db);
            layer.appendChild(pin);
        });
    }

    function renderHeatmap() {
        const canvas = document.getElementById('heatmap-canvas');
        const container = document.getElementById('heatmap-container');
        if(!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Se não tem pontos, não pinta nada
        if (points.length === 0) return;

        // Desenha gradientes radiais para cada ponto
        points.forEach(p => {
            const cx = p.x * canvas.width;
            const cy = p.y * canvas.height;
            const radius = Math.max(canvas.width, canvas.height) * 0.3; // 30% da tela de influência

            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            const color = getColorForDb(p.db);
            const rgbMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
            
            if (rgbMatch) {
                const rgbStr = `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]},`;
                gradient.addColorStop(0, `${rgbStr} 0.8)`);
                gradient.addColorStop(0.5, `${rgbStr} 0.4)`);
                gradient.addColorStop(1, `${rgbStr} 0)`);
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }



    document.addEventListener('page-loaded', (e) => {
        console.log(`[Heatmap] Page loaded: ${e.detail.pageId}`);
        if (e.detail.pageId === 'spl-heatmap' || e.detail.pageId === 'analyzer') {
            setTimeout(initHeatmap, 200);
        }
    });

    // Observer removido: page-loaded é suficiente com setTimeout
})();
