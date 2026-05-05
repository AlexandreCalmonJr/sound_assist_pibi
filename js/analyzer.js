// Analisador de Áudio em Tempo Real (Web Audio API)
let audioCtx;
let analyser;
let source;
let stream;
let isAnalyzing = false;
let animationId;
let lastAnalysis = null;
let pinkMeasurementActive = false;
let pinkMeasurementCount = 0;
let pinkMeasurementSum = null;
let pinkReport = null;

// Refs que serão capturadas no init
let canvas, canvasCtx, rmsBar, feedbackAlert, analysisSummaryText, analysisDetailList, btnSendAnalysis, btnMeasurePink, btnDesktopPink, pinkMeasureSummary;
let waterfallCanvasEl, waterfallCtx;

// --- Novas Variáveis de Melhoria ---
let peakHold = { hz: 0, db: -100, timer: 0 };
let waterfallData = []; // Histórico de espectro
const WATERFALL_DEPTH = 100; // Quantos frames guardar

class FeedbackDetector {
    constructor(bufferSize = 10) {
        this.peakHistory = new Array(bufferSize).fill(null);
        this.bufferIndex = 0;
    }
    
    analyze(peakHz, peakDb, threshold = -20) {
        this.peakHistory[this.bufferIndex % this.peakHistory.length] = { hz: peakHz, db: peakDb };
        this.bufferIndex++;
        
        // Feedback real = mesma frequência sustentada por múltiplos frames
        const recentPeaks = this.peakHistory.filter(Boolean);
        if (recentPeaks.length < this.peakHistory.length) return false;

        const avgHz = recentPeaks.reduce((s, p) => s + p.hz, 0) / recentPeaks.length;
        const allSimilarFreq = recentPeaks.every(p => Math.abs(p.hz - avgHz) < 50);
        const allAboveThreshold = recentPeaks.every(p => p.db > threshold);
        
        return allSimilarFreq && allAboveThreshold;
    }
}

const feedbackDetector = new FeedbackDetector(15); // Sensibilidade ajustada

    // -------------------------------------------------------------------------
    // Controles Manuais (Ferramentas Técnicas)
    // -------------------------------------------------------------------------
    function _initManualControls() {
        const btnPink = document.getElementById('btn-toggle-pink-noise');
        const sliderPink = document.getElementById('pink-noise-level');
        const valPink = document.getElementById('pink-noise-val');
        const btnDiag = document.getElementById('btn-manual-diagnostic');

        if (btnPink) {
            btnPink.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                const level = sliderPink ? sliderPink.value : -20;
                MixerService.setOscillator(enabled, level);
                console.log(`[Analyzer] Ruído Rosa: ${enabled ? 'ON' : 'OFF'} (${level}dB)`);
            });
        }

        if (sliderPink) {
            sliderPink.addEventListener('input', (e) => {
                const level = e.target.value;
                if (valPink) valPink.innerText = level + 'dB';
                // Só emite se o ruído estiver ligado (throttle implícito pelo protocolo)
                if (btnPink && btnPink.checked) {
                    MixerService.setOscillator(true, level);
                }
            });
        }

        if (btnDiag) {
            btnDiag.addEventListener('click', () => {
                const analysis = _analyzeSpectrum();
                const summaryEl = document.getElementById('acoustic-summary');
                if (summaryEl) {
                    summaryEl.innerHTML = `<strong>Diagnóstico Manual:</strong> ${analysis.text}`;
                    summaryEl.classList.add('text-cyan-400');
                }
                console.log('[Analyzer] Diagnóstico Manual disparado.');
            });
        }
    }

    function initAnalyzer() {
    console.log('[Analyzer] Inicializando elementos do DOM...');
    canvas = document.getElementById('fft-canvas');
    if (!canvas) return; // Não está na página do analisador

    canvasCtx = canvas.getContext('2d');
    _initManualControls();
    rmsBar = document.getElementById('rms-bar');
    feedbackAlert = document.getElementById('feedback-alert');
    analysisSummaryText = document.getElementById('acoustic-summary');
    analysisDetailList = document.getElementById('acoustic-detail-list');
    btnSendAnalysis = document.getElementById('btn-send-analysis');
    btnMeasurePink = document.getElementById('btn-measure-pink');
    btnDesktopPink = document.getElementById('btn-desktop-pink-noise');
    pinkMeasureSummary = document.getElementById('pink-measure-summary');
    waterfallCanvasEl = document.getElementById('waterfall-canvas');
    if (waterfallCanvasEl) waterfallCtx = waterfallCanvasEl.getContext('2d');

    // Re-anexar listeners
    document.getElementById('btn-start-audio')?.addEventListener('click', startAnalyzer);
    document.getElementById('btn-stop-audio')?.addEventListener('click', stopAnalyzer);
    btnSendAnalysis?.addEventListener('click', sendAnalysisToAI);
    btnMeasurePink?.addEventListener('click', startPinkNoiseMeasurement);
    
    // Sinais
    const btnPink = document.getElementById('btn-pink-noise');
    const btnSine = document.getElementById('btn-sine-wave');
    const sineFreqInput = document.getElementById('sine-freq');

    btnPink?.addEventListener('click', () => {
        ensureAudioCtx();
        if (isPinkNoisePlaying) stopPinkNoise();
        else startPinkNoise(false);
    });

    btnSine?.addEventListener('click', () => {
        ensureAudioCtx();
        if (isSineWavePlaying && sineWaveNode) {
            sineWaveNode.stop();
            sineWaveNode.disconnect();
            isSineWavePlaying = false;
            btnSine.innerHTML = '🎵 Tom Senoidal';
            return;
        }
        const freq = parseFloat(sineFreqInput?.value) || 60;
        sineWaveNode = audioCtx.createOscillator();
        sineWaveNode.type = 'sine';
        sineWaveNode.frequency.value = freq;
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.1;
        sineWaveNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        sineWaveNode.start();
        isSineWavePlaying = true;
        btnSine.innerHTML = '⏹ Parar Senoidal';
    });

    btnDesktopPink?.addEventListener('click', () => {
        ensureAudioCtx();
        if (isPinkNoisePlaying) stopPinkNoise();
        else startPinkNoise(false);
    });
}

// Ouvir evento do roteador
document.addEventListener('page-loaded', (e) => {
    if (e.detail.pageId === 'analyzer') {
        initAnalyzer();
    }
});

async function startAnalyzer() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Acesso ao microfone bloqueado pelo navegador ou sistema. Verifique se está usando HTTPS ou localhost.');
            throw new Error('navigator.mediaDevices.getUserMedia não disponível.');
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 8192;
        analyser.smoothingTimeConstant = 0.85;
        analyser.minDecibels = -100;
        analyser.maxDecibels = -10;
        
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        
        isAnalyzing = true;
        document.getElementById('mic-status-dot').className = 'dot online';
        document.getElementById('mic-status-text').innerText = 'Mic Online';
        
        document.getElementById('btn-start-audio').disabled = true;
        document.getElementById('btn-stop-audio').disabled = false;
        
        analyze();
    } catch (err) {
        console.error("Erro ao acessar microfone:", err);
        alert(`Erro ao acessar o microfone: ${err.name} - ${err.message}\nVerifique se há um microfone conectado e se o Windows permite o acesso.`);
    }
}

function stopAnalyzer() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (audioCtx) {
        audioCtx.close();
    }
    isAnalyzing = false;
    cancelAnimationFrame(animationId);
    
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    rmsBar.style.width = '0%';
    
    document.getElementById('mic-status-dot').className = 'dot offline';
    document.getElementById('mic-status-text').innerText = 'Mic Offline';
    
    document.getElementById('btn-start-audio').disabled = false;
    document.getElementById('btn-stop-audio').disabled = true;
    
    feedbackAlert.className = 'alert safe';
    feedbackAlert.innerHTML = 'Sem picos perigosos.';
    if (analysisSummaryText) {
        analysisSummaryText.innerText = 'Aguardando análise...';
    }
}

function formatDb(value) {
    return value.toFixed(1);
}

function getBandAverage(freqData, sampleRate, minHz, maxHz) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < freqData.length; i++) {
        const freq = i * sampleRate / analyser.fftSize;
        if (freq >= minHz && freq < maxHz) {
            sum += freqData[i];
            count += 1;
        }
    }
    return count ? sum / count : -100;
}

function formatBandLabel(hz) {
    if (hz >= 1000) return `${hz / 1000}kHz`;
    return `${hz}Hz`;
}

function getPinkReference(freq, referenceDb) {
    const refHz = 250;
    if (freq <= 0) return referenceDb;
    const octaves = Math.log2(freq / refHz);
    return referenceDb - 3 * octaves;
}

function buildPinkNoiseReport(avgSpectrum, sampleRate) {
    const bands = [63, 125, 250, 500, 1000, 2000, 4000, 8000];
    const referenceDb = avgSpectrum[0] || -60;
    const report = [];
    const deviations = {};
    let lowSum = 0;
    let midSum = 0;
    let highSum = 0;
    let lowCount = 0;
    let midCount = 0;
    let highCount = 0;

    for (const hz of bands) {
        const index = Math.round(hz * analyser.fftSize / sampleRate);
        const measured = avgSpectrum[index] || analyser.minDecibels;
        const ideal = getPinkReference(hz, referenceDb);
        const deviation = measured - ideal;
        deviations[hz] = formatDb(deviation);
        report.push(` ${formatBandLabel(hz)}: ${formatDb(measured)} dB (${formatDb(deviation)} dB)`);

        if (hz <= 250) { lowSum += measured; lowCount += 1; }
        else if (hz <= 2000) { midSum += measured; midCount += 1; }
        else { highSum += measured; highCount += 1; }
    }

    const lowAvg = lowCount ? lowSum / lowCount : -100;
    const midAvg = midCount ? midSum / midCount : -100;
    const highAvg = highCount ? highSum / highCount : -100;
    const conclusions = [];
    if (lowAvg > midAvg + 4) conclusions.push('grave elevado');
    if (lowAvg < midAvg - 4) conclusions.push('grave fraco');
    if (highAvg < midAvg - 4) conclusions.push('agudos muito retraidos');
    if (highAvg > midAvg + 4) conclusions.push('agudos vivos ou reflexivos');
    if (Math.abs(midAvg - lowAvg) < 3 && Math.abs(highAvg - midAvg) < 3) conclusions.push('curva relativamente equilibrada');

    const summaryText = `Medição rosa: ${conclusions.length ? conclusions.join(', ') + '.' : 'sem desvio pronunciado.'}`;
    return {
        summary: summaryText,
        details: {
            bands: deviations,
            averages: {
                low: formatDb(lowAvg),
                mid: formatDb(midAvg),
                high: formatDb(highAvg)
            },
            reportLines: report
        }
    };
}

function buildAcousticSummary(freqData, timeData) {
    const peak = { db: -Infinity, index: 0 };
    for (let i = 0; i < freqData.length; i++) {
        if (freqData[i] > peak.db) {
            peak.db = freqData[i];
            peak.index = i;
        }
    }

    let sumSquares = 0;
    for (let i = 0; i < timeData.length; i++) {
        sumSquares += timeData[i] * timeData[i];
    }
    const rms = Math.sqrt(sumSquares / timeData.length);
    const rmsDb = 20 * Math.log10(Math.max(rms, 1e-12));

    const peakHz = peak.index * audioCtx.sampleRate / analyser.fftSize;
    const lowAvg = getBandAverage(freqData, audioCtx.sampleRate, 20, 250);
    const lowMidAvg = getBandAverage(freqData, audioCtx.sampleRate, 250, 800);
    const midAvg = getBandAverage(freqData, audioCtx.sampleRate, 800, 3000);
    const highAvg = getBandAverage(freqData, audioCtx.sampleRate, 3000, 12000);

    const notes = [];
    if (lowAvg > midAvg + 6) notes.push('grave muito presente');
    else if (lowAvg < midAvg - 6) notes.push('grave fraco');
    if (highAvg < midAvg - 6) notes.push('agudos apagados');
    else if (highAvg > midAvg + 6) notes.push('agudos vivos');
    if (peak.db > -18 && peakHz > 200 && peakHz < 8000) notes.push(`pico estreito em ${Math.round(peakHz)} Hz`);

    const summaryText = `RMS ${formatDb(rmsDb)} dB; pico ${Math.round(peakHz)} Hz (${formatDb(peak.db)} dB). Graves ${formatDb(lowAvg)} dB, Low-Mid ${formatDb(lowMidAvg)} dB, Médios ${formatDb(midAvg)} dB, Agudos ${formatDb(highAvg)} dB.` +
        (notes.length ? ' Observações: ' + notes.join('; ') + '.' : ' Resposta de frequência bem distribuída.');

    return {
        text: summaryText,
        details: {
            peakHz: Math.round(peakHz),
            peakDb: formatDb(peak.db),
            rmsDb: formatDb(rmsDb),
            bands: {
                low: formatDb(lowAvg),
                lowMid: formatDb(lowMidAvg),
                mid: formatDb(midAvg),
                high: formatDb(highAvg)
            }
        }
    };
}

function renderAnalysisDetails(summary, pink) {
    if (!analysisDetailList) return;
    analysisDetailList.innerHTML = '';
    const items = [
        `RMS: ${summary.details.rmsDb} dB`,
        `Pico: ${summary.details.peakHz} Hz (${summary.details.peakDb} dB)`,
        `Graves: ${summary.details.bands.low} dB`,
        `Low-Mid: ${summary.details.bands.lowMid} dB`,
        `Médios: ${summary.details.bands.mid} dB`,
        `Agudos: ${summary.details.bands.high} dB`
    ];
    if (pink) {
        items.push(`Relatório rosa: ${pink.summary}`);
        if (pink.details && pink.details.reportLines) {
            pink.details.reportLines.forEach(line => items.push(line));
        }
    }
    items.forEach(text => {
        const li = document.createElement('li');
        li.innerText = text;
        analysisDetailList.appendChild(li);
    });
}

function startPinkNoiseMeasurement() {
    if (!audioCtx) {
        alert('Ative o microfone antes de iniciar a medição de ruído rosa.');
        return;
    }
    if (pinkMeasurementActive) return;
    if (!isPinkNoisePlaying) {
        startPinkNoise(true);
    }
    pinkMeasurementActive = true;
    pinkMeasurementCount = 0;
    pinkMeasurementSum = new Float32Array(analyser.frequencyBinCount);
    pinkReport = null;
    if (pinkMeasureSummary) {
        pinkMeasureSummary.innerText = 'Medindo ruído rosa... mantenha o microfone estável.';
    }
    btnMeasurePink && (btnMeasurePink.innerText = '⏳ Medindo...');
}

function finishPinkNoiseMeasurement() {
    pinkMeasurementActive = false;
    const averageSpectrum = new Float32Array(pinkMeasurementSum.length);
    for (let i = 0; i < pinkMeasurementSum.length; i++) {
        averageSpectrum[i] = pinkMeasurementSum[i] / Math.max(1, pinkMeasurementCount);
    }
    pinkReport = buildPinkNoiseReport(averageSpectrum, audioCtx.sampleRate);
    lastAnalysis = lastAnalysis || {};
    lastAnalysis.pinkReport = pinkReport;
    if (pinkMeasureSummary) {
        pinkMeasureSummary.innerText = pinkReport.summary;
    }
    btnMeasurePink && (btnMeasurePink.innerText = '🎚️ Medir Ruído Rosa');
    if (isPinkNoisePlaying && pinkNoiseNode) {
        stopPinkNoise();
    }
}

function startPinkNoise(autoStop = false) {
    if (!pinkNoiseNode) {
        const bufferSize = 4096;
        pinkNoiseNode = audioCtx.createScriptProcessor(bufferSize, 1, 1);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        pinkNoiseNode.onaudioprocess = function(e) {
            const output = e.outputBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                let white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                output[i] *= 0.05;
                b6 = white * 0.115926;
            }
        };
    }
    pinkNoiseNode.connect(audioCtx.destination);
    isPinkNoisePlaying = true;
    btnPink && (btnPink.innerHTML = '⏹ Parar Ruído Rosa');
    btnPink && btnPink.classList.remove('secondary');
    btnPink && btnPink.classList.add('primary');
    if (autoStop) {
        setTimeout(() => {
            if (pinkMeasurementActive) {
                finishPinkNoiseMeasurement();
            }
        }, 4000);
    }
}

function stopPinkNoise() {
    if (pinkNoiseNode) {
        pinkNoiseNode.disconnect();
    }
    isPinkNoisePlaying = false;
    btnPink && (btnPink.innerHTML = '🔊 Ruído Rosa (Pink)');
    btnPink && btnPink.classList.remove('primary');
    btnPink && btnPink.classList.add('secondary');
}

function stopPinkNoiseMeasurement() {
    pinkMeasurementActive = false;
    pinkMeasurementCount = 0;
    pinkMeasurementSum = null;
    if (pinkMeasureSummary) {
        pinkMeasureSummary.innerText = 'Medição cancelada.';
    }
    btnMeasurePink && (btnMeasurePink.innerText = '🎚️ Medir Ruído Rosa');
}

function analyze() {
    if (!isAnalyzing) return;
    
    animationId = requestAnimationFrame(analyze);
    
    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Float32Array(bufferLength);
    const timeData = new Float32Array(analyser.fftSize);

    analyser.getFloatFrequencyData(freqData);
    analyser.getFloatTimeDomainData(timeData);
    
    canvasCtx.fillStyle = 'var(--bg-dark)';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;
    
    let peakDb = -Infinity;
    let peakIndex = 0;
    
    for (let i = 0; i < bufferLength; i++) {
        if (freqData[i] > peakDb) {
            peakDb = freqData[i];
            peakIndex = i;
        }
    }

    // --- Lógica de Peak Hold ---
    if (peakDb > peakHold.db) {
        peakHold.db = peakDb;
        peakHold.hz = peakIndex * audioCtx.sampleRate / analyser.fftSize;
        peakHold.timer = 120; // ~2 segundos a 60fps
    } else if (peakHold.timer > 0) {
        peakHold.timer--;
    } else {
        peakHold.db = -100;
    }

    // --- Renderização FFT ---
    for (let i = 0; i < bufferLength; i++) {
        const db = freqData[i];
        const freq = i * audioCtx.sampleRate / analyser.fftSize;
        let fillStyle = 'var(--text-muted)';
        
        // Zonas frequenciais coloridas (Overlay)
        if (freq < 100) fillStyle = '#3498db'; // Sub
        else if (freq < 500) fillStyle = '#2ecc71'; // Low
        else if (freq < 2000) fillStyle = '#f1c40f'; // Mid
        else if (freq < 6000) fillStyle = '#e67e22'; // High-Mid
        else fillStyle = '#e74c3c'; // High

        const normalized = Math.max(0, Math.min(1, (db - analyser.minDecibels) / (analyser.maxDecibels - analyser.minDecibels)));
        const barHeight = normalized * canvas.height;

        canvasCtx.fillStyle = fillStyle;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }

    // Desenhar Peak Hold Line
    if (peakHold.timer > 0) {
        const peakX = (peakHold.hz * analyser.fftSize / audioCtx.sampleRate) * (barWidth + 1) / 2.5; // Ajuste simplificado
        const peakNormalized = Math.max(0, Math.min(1, (peakHold.db - analyser.minDecibels) / (analyser.maxDecibels - analyser.minDecibels)));
        const peakY = canvas.height - (peakNormalized * canvas.height);
        
        canvasCtx.strokeStyle = '#ffffff';
        canvasCtx.lineWidth = 2;
        canvasCtx.beginPath();
        canvasCtx.moveTo(peakX, peakY);
        canvasCtx.lineTo(peakX + barWidth, peakY);
        canvasCtx.stroke();
    }

    // --- Lógica de Waterfall (Histórico Visual) ---
    waterfallData.unshift(new Float32Array(freqData));
    if (waterfallData.length > WATERFALL_DEPTH) waterfallData.pop();

    if (waterfallCtx && waterfallCanvasEl) {
        const w = waterfallCanvasEl.width;
        const h = waterfallCanvasEl.height;
        const rowHeight = h / WATERFALL_DEPTH;
        
        waterfallCtx.drawImage(waterfallCanvasEl, 0, rowHeight); // Scroll down
        
        const barW = w / bufferLength;
        for (let i = 0; i < bufferLength; i++) {
            const db = freqData[i];
            const normalized = Math.max(0, Math.min(1, (db - analyser.minDecibels) / (analyser.maxDecibels - analyser.minDecibels)));
            
            // Cor baseada em intensidade (Heatmap)
            let color;
            if (normalized < 0.2) color = `rgb(0, 0, ${normalized * 255})`;
            else if (normalized < 0.5) color = `rgb(0, ${(normalized-0.2)*255}, 255)`;
            else if (normalized < 0.8) color = `rgb(${(normalized-0.5)*255}, 255, 0)`;
            else color = `rgb(255, ${(1-normalized)*255}, 0)`;
            
            waterfallCtx.fillStyle = color;
            waterfallCtx.fillRect(i * barW, 0, barW + 1, rowHeight);
        }
    }

    const peakHz = peakIndex * audioCtx.sampleRate / analyser.fftSize;
    const neighborLeft = freqData[Math.max(0, peakIndex - 1)] || analyser.minDecibels;
    const neighborRight = freqData[Math.min(bufferLength - 1, peakIndex + 1)] || analyser.minDecibels;
    const neighborAvg = (neighborLeft + neighborRight) / 2;
    
    let sumSquares = 0;
    for (let i = 0; i < timeData.length; i++) {
        sumSquares += timeData[i] * timeData[i];
    }
    const rms = Math.sqrt(sumSquares / timeData.length);
    const rmsDb = 20 * Math.log10(Math.max(rms, 1e-12));
    const rmsPercent = Math.min(100, Math.max(0, ((rmsDb - analyser.minDecibels) / (analyser.maxDecibels - analyser.minDecibels)) * 100));
    rmsBar.style.width = `${rmsPercent}%`;
    
    const summary = buildAcousticSummary(freqData, timeData);
    if (pinkMeasurementActive) {
        if (!pinkMeasurementSum || pinkMeasurementSum.length !== bufferLength) {
            pinkMeasurementSum = new Float32Array(bufferLength);
        }
        for (let i = 0; i < bufferLength; i++) {
            pinkMeasurementSum[i] += freqData[i];
        }
        pinkMeasurementCount += 1;
        const progress = Math.min(100, Math.round((pinkMeasurementCount / 80) * 100));
        if (pinkMeasureSummary) {
            pinkMeasureSummary.innerText = `Medindo ruído rosa... ${progress}%`;
        }
        if (pinkMeasurementCount >= 80) {
            finishPinkNoiseMeasurement();
        }
    }
    lastAnalysis = summary;
    if (pinkReport) {
        lastAnalysis.pinkReport = pinkReport;
    }
    if (analysisSummaryText) {
        analysisSummaryText.innerText = summary.text;
    }
    renderAnalysisDetails(summary, pinkReport);
    
    const btnAutoCut = document.getElementById('btn-auto-cut');
    
    const isFeedback = feedbackDetector.analyze(peakHz, peakDb, -20);
    
    if (isFeedback) {
        feedbackAlert.className = 'alert danger';
        feedbackAlert.innerHTML = `⚠️ <strong>Microfonia DETECTADA</strong> em <strong>${Math.round(peakHz)} Hz</strong> sustentados. Diferença local: ${formatDb(peakDb - neighborAvg)} dB.`;

        if (socket && typeof socket.emit === 'function') {
            btnAutoCut.style.display = 'block';
            btnAutoCut.onclick = () => {
                socket.emit('cut_feedback', { hz: Math.round(peakHz) });
                btnAutoCut.innerText = 'Cortando...';
            };
        }
    } else {
        feedbackAlert.className = 'alert safe';
        feedbackAlert.innerHTML = `Espectro estável. Pico dominante: ${Math.round(peakHz)} Hz (${formatDb(peakDb)} dB).`;
        if (btnAutoCut) {
            btnAutoCut.style.display = 'none';
            btnAutoCut.innerText = '🪄 Cortar Frequência na Mesa';
        }
    }
}

async function sendAnalysisToAI() {
    if (!lastAnalysis) {
        alert('Nenhuma análise disponível. Ative o microfone e aguarde alguns segundos.');
        return;
    }

    const channelInput = document.getElementById('ai-target-channel');
    const channel = channelInput ? Number(channelInput.value) : 1;
    
    // Se o Assistente IA estiver carregado, use a função dele para mostrar no chat
    if (window.SoundMasterAIChat && typeof window.SoundMasterAIChat.sendAnalysis === 'function') {
        window.SoundMasterAIChat.sendAnalysis(false);
        // Navega para a aba da IA para o usuário ver
        const aiTab = document.querySelector('[data-target="ai-chat"]');
        if (aiTab) aiTab.click();
        return;
    }

    if (!window.AIService) {
        alert('IA indisponível. Aguarde a inicialização do assistente.');
        return;
    }

    const payload = {
        summary: lastAnalysis.text,
        bands: lastAnalysis.details.bands,
        peakHz: lastAnalysis.details.peakHz,
        peakDb: lastAnalysis.details.peakDb,
        rmsDb: lastAnalysis.details.rmsDb
    };
    if (lastAnalysis.pinkReport) {
        payload.pinkReport = lastAnalysis.pinkReport;
    }

    const result = await AIService.ask('Análise acústica do salão', channel, payload);

    if (feedbackAlert) {
        feedbackAlert.className = 'alert warning';
        feedbackAlert.innerHTML = `IA: ${result.text}`;
    }
}

window.SoundMasterAnalyzer = {
    getLastAnalysis: function () { return lastAnalysis; },
    getPinkReport: function () { return pinkReport; },
    hasAnalysis: function () { return !!lastAnalysis; }
};

// --- Geradores de Sinais de Áudio (Alinhamento) ---
let pinkNoiseNode = null;
let sineWaveNode = null;
let isPinkNoisePlaying = false;
let isSineWavePlaying = false;

const btnPink = document.getElementById('btn-pink-noise');
const btnSine = document.getElementById('btn-sine-wave');
const sineFreqInput = document.getElementById('sine-freq');

// Helper to ensure AudioContext
function ensureAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Helpers (mantidos fora para serem reutilizados)
