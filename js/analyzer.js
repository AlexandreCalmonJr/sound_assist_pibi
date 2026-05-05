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

// Canvas setup
const canvas = document.getElementById('fft-canvas');
const canvasCtx = canvas.getContext('2d');
const rmsBar = document.getElementById('rms-bar');
const feedbackAlert = document.getElementById('feedback-alert');
const analysisSummaryText = document.getElementById('acoustic-summary');
const analysisDetailList = document.getElementById('acoustic-detail-list');
const btnSendAnalysis = document.getElementById('btn-send-analysis');
const btnMeasurePink = document.getElementById('btn-measure-pink');
const btnDesktopPink = document.getElementById('btn-desktop-pink-noise');
const pinkMeasureSummary = document.getElementById('pink-measure-summary');

async function startAnalyzer() {
    try {
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
        const db = freqData[i];
        if (db > peakDb) {
            peakDb = db;
            peakIndex = i;
        }

        const freq = i * audioCtx.sampleRate / analyser.fftSize;
        let fillStyle = 'var(--text-muted)';
        if (freq < 100) fillStyle = '#3498db';
        else if (freq < 500) fillStyle = '#2ecc71';
        else if (freq < 2000) fillStyle = '#f1c40f';
        else if (freq < 6000) fillStyle = '#e67e22';
        else fillStyle = '#e74c3c';

        const normalized = Math.max(0, Math.min(1, (db - analyser.minDecibels) / (analyser.maxDecibels - analyser.minDecibels)));
        const barHeight = normalized * canvas.height;

        canvasCtx.fillStyle = fillStyle;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
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
    
    if (peakDb > -20 && peakDb - neighborAvg > 8 && peakHz > 150) {
        feedbackAlert.className = 'alert danger';
        feedbackAlert.innerHTML = `⚠️ <strong>Microfonia provável</strong> em <strong>${Math.round(peakHz)} Hz</strong>. Diferença local: ${formatDb(peakDb - neighborAvg)} dB.`;

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

document.getElementById('btn-start-audio').addEventListener('click', startAnalyzer);
document.getElementById('btn-stop-audio').addEventListener('click', stopAnalyzer);
btnSendAnalysis?.addEventListener('click', sendAnalysisToAI);
btnMeasurePink?.addEventListener('click', startPinkNoiseMeasurement);
btnDesktopPink?.addEventListener('click', () => {
    ensureAudioCtx();
    if (isPinkNoisePlaying) stopPinkNoise();
    else startPinkNoise(false);
});

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

// Gerador de Ruído Rosa (Algoritmo de filtro Paul Kellet)
btnPink.addEventListener('click', () => {
    ensureAudioCtx();
    if (isPinkNoisePlaying) {
        stopPinkNoise();
        return;
    }
    startPinkNoise(false);
});

// Gerador de Onda Senoidal
btnSine.addEventListener('click', () => {
    ensureAudioCtx();
    
    if (isSineWavePlaying && sineWaveNode) {
        sineWaveNode.stop();
        sineWaveNode.disconnect();
        isSineWavePlaying = false;
        btnSine.innerHTML = '🎵 Tom Senoidal';
        btnSine.classList.remove('primary');
        btnSine.classList.add('secondary');
        return;
    }

    const freq = parseFloat(sineFreqInput.value) || 60;
    
    sineWaveNode = audioCtx.createOscillator();
    sineWaveNode.type = 'sine';
    sineWaveNode.frequency.value = freq;
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.1; // 10% volume
    
    sineWaveNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    sineWaveNode.start();
    isSineWavePlaying = true;
    
    btnSine.innerHTML = '⏹ Parar Senoidal';
    btnSine.classList.remove('secondary');
    btnSine.classList.add('primary');
});
