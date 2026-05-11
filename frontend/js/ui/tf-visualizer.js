/**
 * SoundMaster Pro - Transfer Function Visualizer
 * Renderização de gráficos de Magnitude, Fase e Coerência.
 */
(function () {
    'use strict';

    let magCanvas, magCtx, phaseCanvas, phaseCtx;
    const minFreq = 20;
    const maxFreq = 20000;
    let capturedTraces = []; // ✅ Armazena snapshots de medição

    function init() {
        magCanvas = document.getElementById('tf-magnitude-canvas');
        phaseCanvas = document.getElementById('tf-phase-canvas');
        if (magCanvas) magCtx = magCanvas.getContext('2d');
        if (phaseCanvas) phaseCtx = phaseCanvas.getContext('2d');
        
        window.addEventListener('resize', resize);
        resize();
    }

    /**
     * Captura a medição atual e armazena como um trace estático
     */
    function captureCurrentTrace(magnitude, phase, coherence) {
        if (capturedTraces.length >= 5) capturedTraces.shift(); // Limite de 5 traces
        capturedTraces.push({
            magnitude: new Float32Array(magnitude),
            phase: new Float32Array(phase),
            coherence: new Float32Array(coherence),
            timestamp: new Date().toLocaleTimeString(),
            color: `hsl(${Math.random() * 360}, 70%, 60%)` // Cor aleatória para distinguir
        });
    }

    function clearTraces() {
        capturedTraces = [];
    }

    function resize() {
        if (magCanvas) {
            magCanvas.width = magCanvas.clientWidth * window.devicePixelRatio;
            magCanvas.height = magCanvas.clientHeight * window.devicePixelRatio;
        }
        if (phaseCanvas) {
            phaseCanvas.width = phaseCanvas.clientWidth * window.devicePixelRatio;
            phaseCanvas.height = phaseCanvas.clientHeight * window.devicePixelRatio;
        }
    }

    /**
     * Converte frequência para coordenada X logarítmica
     */
    function freqToX(freq, width) {
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxFreq);
        const logFreq = Math.log10(Math.max(minFreq, freq));
        return ((logFreq - logMin) / (logMax - logMin)) * width;
    }

    function drawGrids(ctx, width, height, type) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';

        // Grid Vertical (Frequências)
        const freqs = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        freqs.forEach(f => {
            const x = freqToX(f, width);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            if (f >= 1000) ctx.fillText((f/1000)+'k', x + 2, height - 5);
            else ctx.fillText(f, x + 2, height - 5);
        });

        // Grid Horizontal (dB ou Graus)
        ctx.beginPath();
        if (type === 'magnitude') {
            for (let db = -18; db <= 18; db += 6) {
                const y = height / 2 - (db * (height / 40));
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
        } else {
            const steps = [-180, -90, 0, 90, 180];
            steps.forEach(deg => {
                const y = height / 2 - (deg * (height / 360));
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            });
        }
        ctx.stroke();
    }

    function drawTraceLine(ctx, data, width, height, type, hzPerBin, color, isLive = false) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = isLive ? 2 : 1;
        ctx.setLineDash(isLive ? [] : [4, 4]); // Trace estático é tracejado
        
        for (let i = 0; i < data.length; i++) {
            const freq = i * hzPerBin;
            if (freq < minFreq) continue;
            if (freq > maxFreq) break;

            const x = freqToX(freq, width);
            let y;
            if (type === 'magnitude') {
                y = height / 2 - (data[i] * (height / 40));
            } else {
                const deg = data[i] * (180 / Math.PI);
                y = height / 2 - (deg * (height / 360));
            }

            if (i === 0) ctx.moveTo(x, y);
            else {
                if (type === 'phase') {
                    const prevDeg = data[i-1] * (180 / Math.PI);
                    const deg = data[i] * (180 / Math.PI);
                    if (Math.abs(deg - prevDeg) > 180) { ctx.moveTo(x, y); continue; }
                }
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawTransferFunction(magnitude, phase, coherence) {
        if (!magCtx || !phaseCtx) return;

        const w = magCanvas.width;
        const h = magCanvas.height;
        const hzPerBin = 48000 / (magnitude.length * 2);

        magCtx.clearRect(0, 0, w, h);
        phaseCtx.clearRect(0, 0, w, h);

        drawGrids(magCtx, w, h, 'magnitude');
        drawGrids(phaseCtx, w, h, 'phase');

        // --- Desenhar Traces Capturados (GHOST TRACES) ---
        capturedTraces.forEach(trace => {
            magCtx.globalAlpha = 0.4;
            phaseCtx.globalAlpha = 0.4;
            drawTraceLine(magCtx, trace.magnitude, w, h, 'magnitude', hzPerBin, trace.color);
            drawTraceLine(phaseCtx, trace.phase, w, h, 'phase', hzPerBin, trace.color);
        });
        magCtx.globalAlpha = 1.0;
        phaseCtx.globalAlpha = 1.0;

        // --- Desenhar Trace em Tempo Real ---
        drawTraceLine(magCtx, magnitude, w, h, 'magnitude', hzPerBin, '#22d3ee', true);
        drawTraceLine(phaseCtx, phase, w, h, 'phase', hzPerBin, '#a855f7', true);
    }

    window.SoundMasterVisualizer = {
        init,
        drawTransferFunction,
        captureCurrentTrace,
        clearTraces
    };

})();
