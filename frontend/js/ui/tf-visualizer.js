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
    let crosshairX = -1;
    let crosshairYMag = -1;
    let crosshairYPhase = -1;
    let zoomMag = 40; // Range em dB (ex: 40 = +/- 20dB)
    let zoomPhase = 360; // Range em graus

    function init() {
        console.log('[TF-Visualizer] Inicializando canvases...');
        magCanvas = document.getElementById('tf-magnitude-canvas');
        phaseCanvas = document.getElementById('tf-phase-canvas');
        if (magCanvas) magCtx = magCanvas.getContext('2d');
        if (phaseCanvas) phaseCtx = phaseCanvas.getContext('2d');
        
        if (!magCanvas || !phaseCanvas) {
            console.warn('[TF-Visualizer] Canvases não encontrados no DOM.');
        }

        window.removeEventListener('resize', resize);
        window.addEventListener('resize', resize);
        resize();

        // --- Crosshair e Zoom Listeners ---
        const bindInteractivity = (canvas, type) => {
            if (!canvas) return;
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                crosshairX = (e.clientX - rect.left) * (canvas.width / rect.width);
                if (type === 'mag') crosshairYMag = (e.clientY - rect.top) * (canvas.height / rect.height);
                if (type === 'phase') crosshairYPhase = (e.clientY - rect.top) * (canvas.height / rect.height);
            });
            canvas.addEventListener('mouseleave', () => {
                crosshairX = -1; crosshairYMag = -1; crosshairYPhase = -1;
            });
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = Math.sign(e.deltaY);
                if (type === 'mag') {
                    zoomMag = Math.max(10, Math.min(120, zoomMag + delta * 5));
                } else {
                    zoomPhase = Math.max(90, Math.min(720, zoomPhase + delta * 30));
                }
            }, { passive: false });
        };

        bindInteractivity(magCanvas, 'mag');
        bindInteractivity(phaseCanvas, 'phase');
    }

    /**
     * Algoritmo de Phase Unwrapping Automático
     * Analisa o array de fase e corrige descontinuidades maiores que PI.
     */
    function unwrapPhase(phaseArray) {
        const unwrapped = new Float32Array(phaseArray.length);
        let shift = 0;
        unwrapped[0] = phaseArray[0];

        for (let i = 1; i < phaseArray.length; i++) {
            let diff = phaseArray[i] - phaseArray[i - 1];

            // Corrige saltos abruptos maiores que +/- PI
            if (diff > Math.PI) {
                shift -= 2 * Math.PI;
            } else if (diff < -Math.PI) {
                shift += 2 * Math.PI;
            }

            unwrapped[i] = phaseArray[i] + shift;
        }
        return unwrapped;
    }

    /**
     * Captura a medição atual e armazena como um trace estático
     */
    function captureCurrentTrace(magnitude, phase, coherence) {
        if (capturedTraces.length >= 5) capturedTraces.shift(); // Limite de 5 traces
        capturedTraces.push({
            magnitude: new Float32Array(magnitude),
            phase: unwrapPhase(new Float32Array(phase)), // Aplica unwrapping no snapshot
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

        // Grid Horizontal dinâmico com base no Zoom
        ctx.beginPath();
        if (type === 'magnitude') {
            const step = zoomMag > 60 ? 12 : 6;
            for (let db = -Math.floor(zoomMag/2); db <= Math.floor(zoomMag/2); db += step) {
                const y = height / 2 - (db * (height / zoomMag));
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
        } else {
            const step = zoomPhase > 360 ? 90 : 45;
            for (let deg = -Math.floor(zoomPhase/2); deg <= Math.floor(zoomPhase/2); deg += step) {
                const y = height / 2 - (deg * (height / zoomPhase));
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
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
                y = height / 2 - (data[i] * (height / zoomMag));
            } else {
                let deg = data[i] * (180 / Math.PI);
                // Phase Unwrapping: A fase agora é contínua e não sofre wrap artificial
                y = height / 2 - (deg * (height / zoomPhase));
            }

            if (i === 0) ctx.moveTo(x, y);
            else {
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

        // Aplica o Unwrapping no traço ao vivo
        const livePhaseUnwrapped = unwrapPhase(phase);

        // --- Desenhar Trace em Tempo Real ---
        drawTraceLine(magCtx, magnitude, w, h, 'magnitude', hzPerBin, '#22d3ee', true);
        drawTraceLine(phaseCtx, livePhaseUnwrapped, w, h, 'phase', hzPerBin, '#a855f7', true);

        // --- Crosshair UI ---
        if (crosshairX > 0) {
            const drawCrosshair = (ctx, yPos, type, color, scaleRange) => {
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);

                // Linha vertical
                ctx.beginPath(); ctx.moveTo(crosshairX, 0); ctx.lineTo(crosshairX, h); ctx.stroke();

                // Mouse Tooltip
                const logMin = Math.log10(minFreq);
                const logMax = Math.log10(maxFreq);
                const xPercent = crosshairX / w;
                const freqAtCursor = Math.pow(10, logMin + xPercent * (logMax - logMin));

                let valStr = '';
                if (yPos > 0) {
                    // Linha horizontal se o mouse estiver DENTRO desse canvas
                    ctx.beginPath(); ctx.moveTo(0, yPos); ctx.lineTo(w, yPos); ctx.stroke();
                    
                    const val = ((h / 2 - yPos) / h) * scaleRange;
                    valStr = type === 'mag' ? ` | ${val.toFixed(1)} dB` : ` | ${val.toFixed(1)}°`;
                }

                // Desenha a caixa de texto no topo
                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.fillRect(crosshairX + 5, 5, 80, 16);
                ctx.fillStyle = color;
                ctx.font = '10px monospace';
                ctx.fillText(`${Math.round(freqAtCursor)}Hz${valStr}`, crosshairX + 8, 16);
                ctx.setLineDash([]);
            };

            drawCrosshair(magCtx, crosshairYMag, 'mag', '#22d3ee', zoomMag);
            drawCrosshair(phaseCtx, crosshairYPhase, 'phase', '#a855f7', zoomPhase);
        }
    }

    window.SoundMasterVisualizer = {
        init,
        drawTransferFunction,
        captureCurrentTrace,
        clearTraces
    };

})();
