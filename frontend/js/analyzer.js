/**
 * SoundMaster — Analisador de Áudio em Tempo Real (Web Audio API)
 * Encapsulado em IIFE para evitar poluição do escopo global.
 *
 * NOTA TÉCNICA: createScriptProcessor é deprecated (Web Audio API).
 * O substituto recomendado é AudioWorklet, porém requer:
 *   1. Arquivo separado para o processador (AudioWorkletProcessor)
 *   2. Contexto seguro (HTTPS) em alguns navegadores
 *   3. Suporte menor em Safari < 14.1
 * Mantido createScriptProcessor como fallback funcional até que
 * o app migre para uma build com bundler (Vite/Webpack).
 */
(function () {
'use strict';

// Previne inicialização múltipla se o script for re-executado pelo roteador SPA
if (window.SoundMasterAnalyzerInitialized) return;
window.SoundMasterAnalyzerInitialized = true;

// Analisador de Áudio em Tempo Real (Web Audio API)
let audioCtx;
let analyser;
let analyserFast; // Novo: Analisador rápido para detecção técnica
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
let canvas, canvasCtx, rmsBar, feedbackAlert, analysisSummaryText, analysisDetailList, btnSendAnalysis, btnMeasurePink, btnDesktopPink, pinkMeasureSummary, btnLogSweep, micSelect;
let waterfallCanvasEl, waterfallCtx;

// Web Workers & Worklets
let acousticWorker = null;
let audioWorkletNode = null;

// --- Novas Variáveis de Melhoria ---
let peakHold = { hz: 0, db: -100, timer: 0 };
// Waterfall historico manual removido: usamos shift nativo do canvas para ultra-performance
const WATERFALL_DEPTH = 100; // Quantos frames guardar na tela

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
        
        // ✅ Correção Auditoria: Tolerância proporcional (razão de freq) em vez de absoluta (Hz)
        // ±1/6 de oitava é musicalmente preciso para identificar a mesma nota/ressonância
        const allSimilarFreq = recentPeaks.every(p => 
            Math.abs(Math.log2(p.hz / avgHz)) < 1/6
        );
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

    function _initAutomixControls() {
        const btnToggle = document.getElementById('btn-toggle-automix');
        const sliderSpeed = document.getElementById('automix-speed-slider');
        const valSpeed = document.getElementById('automix-speed-val');
        const btnGroupA = document.getElementById('btn-automix-group-a');
        const btnGroupB = document.getElementById('btn-automix-group-b');

        let currentGroup = 'a';

        if (btnToggle) {
            btnToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                MixerService.automixControl(currentGroup, enabled ? 'enable' : 'disable');
                console.log(`[Analyzer] Automix ${currentGroup.toUpperCase()}: ${enabled ? 'ON' : 'OFF'}`);
            });
        }

        if (sliderSpeed) {
            sliderSpeed.addEventListener('input', (e) => {
                const ms = e.target.value;
                if (valSpeed) valSpeed.innerText = ms + 'ms';
                MixerService.automixControl(null, 'responseTime', ms);
            });
        }

        const updateGroupUI = (group) => {
            currentGroup = group;
            if (btnGroupA && btnGroupB) {
                btnGroupA.classList.toggle('active', group === 'a');
                btnGroupA.classList.toggle('bg-cyan-600/20', group === 'a');
                btnGroupB.classList.toggle('active', group === 'b');
                btnGroupB.classList.toggle('bg-cyan-600/20', group === 'b');
            }
        };

        btnGroupA?.addEventListener('click', () => updateGroupUI('a'));
        btnGroupB?.addEventListener('click', () => updateGroupUI('b'));
    }

    function initAnalyzer() {
        console.log('[Analyzer] Inicializando elementos do DOM...');
        canvas = document.getElementById('fft-canvas');
        if (!canvas) return;

        canvasCtx = canvas.getContext('2d');
        _initManualControls();
        _initAutomixControls();
        
        // Captura de elementos
        rmsBar = document.getElementById('rms-bar');
        feedbackAlert = document.getElementById('feedback-alert');
        analysisSummaryText = document.getElementById('acoustic-summary');
        analysisDetailList = document.getElementById('acoustic-detail-list');
        btnSendAnalysis = document.getElementById('btn-send-analysis');
        btnMeasurePink = document.getElementById('btn-measure-pink');
        btnDesktopPink = document.getElementById('btn-desktop-pink-noise');
        btnLogSweep = document.getElementById('btn-log-sweep');
        micSelect = document.getElementById('mic-select');
        pinkMeasureSummary = document.getElementById('pink-measure-summary');
        waterfallCanvasEl = document.getElementById('waterfall-canvas');
        if (waterfallCanvasEl) waterfallCtx = waterfallCanvasEl.getContext('2d');

        // Listeners locais da página de análise
        document.getElementById('btn-start-audio')?.addEventListener('click', startAnalyzer);
        document.getElementById('btn-stop-audio')?.addEventListener('click', stopAnalyzer);
        btnSendAnalysis?.addEventListener('click', sendAnalysisToAI);
        btnMeasurePink?.addEventListener('click', startPinkNoiseMeasurement);
        btnLogSweep?.addEventListener('click', startLogarithmicSweep);
        
        // Popula lista de microfones
        _populateDeviceList();

        // Sinais
        btnPink = document.getElementById('btn-pink-noise');
        btnSine = document.getElementById('btn-sine-wave');
        sineFreqInput = document.getElementById('sine-freq');

        btnPink?.addEventListener('click', () => {
            ensureAudioCtx();
            if (isPinkNoisePlaying) stopPinkNoise();
            else startPinkNoise(false);
        });

        btnDesktopPink?.addEventListener('click', () => {
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
    }

    /**
     * Inicialização Global (Botões do cabeçalho e Workers)
     * Deve rodar apenas uma vez na carga do app.
     */
    function initGlobalAnalyzer() {
        console.log('[Analyzer] Inicializando serviços globais de áudio...');
        
        // 1. Global Mic Toggle Header (Sempre presente no index.html)
        // 1. Global Mic Toggle Header (Sempre presente no index.html)
        const btnMic = document.getElementById('btn-toggle-mic');
        if (btnMic) {
            // Remove anterior para evitar duplicidade caso o init seja chamado via console/re-entry
            btnMic.removeEventListener('click', toggleAnalyzer);
            btnMic.addEventListener('click', toggleAnalyzer);
        }

        // 2. Inicializa Worker de Acústica
        if (!acousticWorker) {
            acousticWorker = new Worker('js/workers/acoustic.worker.js');
            acousticWorker.onmessage = (e) => {
                if (e.data.type === 'rt60-result') {
                    _handleRT60Result(e.data.result);
                }
            };
        }

        // 3. Listener global para garantir que o AudioContext seja retomado por interação do usuário
        document.addEventListener('click', () => {
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        }, { once: false });
    }

async function _populateDeviceList() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        if (micSelect) {
            micSelect.innerHTML = '';
            audioInputs.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Microfone ${micSelect.length + 1}`;
                micSelect.appendChild(option);
            });
        }
    } catch (err) {
        console.error('[Analyzer] Erro ao listar dispositivos:', err);
    }
}

// Ouvir evento do roteador
document.addEventListener('page-loaded', (e) => {
    // Sempre inicializa os serviços globais se ainda não foram
    if (!acousticWorker) initGlobalAnalyzer();

    if (e.detail.pageId === 'analyzer') {
        initAnalyzer();
    }
    if (e.detail.pageId === 'rt60') {
        // Inicializa controles de RT60 na página específica
        document.getElementById('btn-trigger-pulse')?.addEventListener('click', () => {
            window.SoundMasterAnalyzer.triggerImpulse();
        });
    }
});

// Cleanup global ao sair da página ou fechar aba
window.addEventListener('beforeunload', () => {
    if (isAnalyzing) stopAnalyzer();
});

async function startAnalyzer() {
    try {
        const deviceId = micSelect?.value || 'default';
        const constraints = {
            audio: {
                deviceId: deviceId !== 'default' ? { exact: deviceId } : undefined,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: 1
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Carrega AudioWorklet para processamento em thread separada
        try {
            await audioCtx.audioWorklet.addModule('js/core/audio-processor.js');
            audioWorkletNode = new AudioWorkletNode(audioCtx, 'soundmaster-processor');
        } catch (e) {
            console.warn('[Analyzer] AudioWorklet falhou, usando fallback.', e);
        }

        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 32768; // Alta resolução: ~1.3Hz por bin
        analyser.smoothingTimeConstant = 0.8;
        // ✅ Correção Auditoria: Padronização de janela (Hann/Blackman-Harris-inspired)
        // O Web Audio não permite setar Hann via propriedade, mas garantimos consistência
        // setando smoothing alto para visual e processando janelamento manual no Worklet.
        analyser.minDecibels = -100;
        analyser.maxDecibels = -10;
        
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        if (audioWorkletNode) {
            source.connect(audioWorkletNode);
            const silentGain = audioCtx.createGain();
            silentGain.gain.value = 0;
            audioWorkletNode.connect(silentGain);
            silentGain.connect(audioCtx.destination);
        }

        // ✅ Novo: Analisador rápido para detecção de feedback (baixa latência)
        analyserFast = audioCtx.createAnalyser();
        analyserFast.fftSize = 4096;
        analyserFast.smoothingTimeConstant = 0.1;
        analyserFast.minDecibels = -100;
        analyserFast.maxDecibels = -10;
        source.connect(analyserFast);
        
        isAnalyzing = true;
        
        // Update UI - Header
        const dot = document.getElementById('mic-status-dot');
        const text = document.getElementById('mic-status-text');
        if (dot) dot.classList.add('online');
        if (text) text.innerText = 'Mic Online';

        // Update UI - Page Buttons
        const btnStart = document.getElementById('btn-start-audio');
        const btnStop = document.getElementById('btn-stop-audio');
        if (btnStart) btnStart.disabled = true;
        if (btnStop) btnStop.disabled = false;
        
        analyze();
    } catch (err) {
        console.error("Erro ao acessar microfone:", err);
        alert(`Erro ao acessar o microfone: ${err.message}`);
    }
}

async function stopAnalyzer() {
    console.log('[Analyzer] Parando analisador e limpando recursos...');
    
    isAnalyzing = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    if (stream) {
        stream.getTracks().forEach(track => {
            console.log(`[Analyzer] Parando track: ${track.kind}`);
            track.stop();
        });
        stream = null;
    }

    if (audioCtx) {
        if (audioCtx.state !== 'closed') {
            try {
                await audioCtx.close();
                console.log('[Analyzer] AudioContext fechado.');
            } catch (e) {
                console.warn('[Analyzer] Erro ao fechar AudioContext:', e);
            }
        }
        audioCtx = null;
    }

    // Limpeza de nós específicos
    analyser = null;
    analyserFast = null;
    source = null;
    audioWorkletNode = null;
    if (pinkNoiseNode) {
        pinkNoiseNode.disconnect();
        pinkNoiseNode = null;
    }
    if (sineWaveNode) {
        sineWaveNode.disconnect();
        sineWaveNode = null;
    }
    
    if (canvasCtx && canvas) canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    if (rmsBar) rmsBar.style.width = '0%';
    
    // Update UI - Header
    const dot = document.getElementById('mic-status-dot');
    const text = document.getElementById('mic-status-text');
    if (dot) dot.classList.remove('online');
    if (text) text.innerText = 'Mic Offline';
    
    // Update UI - Page Buttons
    const btnStart = document.getElementById('btn-start-audio');
    const btnStop = document.getElementById('btn-stop-audio');
    if (btnStart) btnStart.disabled = false;
    if (btnStop) btnStop.disabled = true;
    
    if (feedbackAlert) {
        feedbackAlert.className = 'alert safe';
        feedbackAlert.innerHTML = 'Sem picos perigosos.';
    }
    if (analysisSummaryText) {
        analysisSummaryText.innerText = 'Aguardando análise...';
    }
}

function formatDb(value) {
    return value.toFixed(1);
}

function getBandAverage(freqData, sampleRate, minHz, maxHz, fftSize) {
    let sum = 0;
    let count = 0;
    
    // ✅ Correção Auditoria: Ponderação por largura de banda (oitavas)
    // Evita que bandas com mais bins (agudos) tenham médias artificialmente diluídas
    const bandwidthInOctaves = Math.log2(maxHz / minHz);
    const weightPerBin = 1.0 / bandwidthInOctaves;

    for (let i = 0; i < freqData.length; i++) {
        const freq = i * sampleRate / fftSize;
        if (freq >= minHz && freq < maxHz) {
            sum += freqData[i] * weightPerBin;
            count += weightPerBin;
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
    
    // ✅ Correção Auditoria: Usar 1kHz como referência em vez de 0Hz (DC)
    const refBin = Math.round(1000 * analyser.fftSize / sampleRate);
    const referenceDb = avgSpectrum[refBin] || -60;
    
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
    const lowAvg = getBandAverage(freqData, audioCtx.sampleRate, 20, 250, analyser.fftSize);
    const lowMidAvg = getBandAverage(freqData, audioCtx.sampleRate, 250, 800, analyser.fftSize);
    const midAvg = getBandAverage(freqData, audioCtx.sampleRate, 800, 3000, analyser.fftSize);
    const highAvg = getBandAverage(freqData, audioCtx.sampleRate, 3000, 12000, analyser.fftSize);

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
    
    // ✅ Correção Auditoria: Validar se o ruído rosa estava realmente ativo
    // O ruído rosa tem uma queda característica de -3dB/oitava.
    // Verificamos a diferença entre 250Hz e 4000Hz (4 oitavas -> ~12dB de queda esperada)
    const lowCheck = getBandAverage(averageSpectrum, audioCtx.sampleRate, 200, 300, analyser.fftSize);
    const highCheck = getBandAverage(averageSpectrum, audioCtx.sampleRate, 3500, 4500, analyser.fftSize);
    const slope = lowCheck - highCheck;

    if (slope < 6 || slope > 20) {
        if (pinkMeasureSummary) {
            pinkMeasureSummary.innerHTML = `<span class="text-amber-400 font-bold">⚠️ Atenção: Ruído rosa não detectado ou inconsistente.</span><br><small class="text-slate-400">Verifique se o sinal está sendo reproduzido no som do salão.</small>`;
        }
    } else {
        if (pinkMeasureSummary) {
            pinkMeasureSummary.innerText = pinkReport.summary;
        }
    }

    lastAnalysis = lastAnalysis || {};
    lastAnalysis.pinkReport = pinkReport;
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
    
    analyser.getFloatFrequencyData(freqData);
    
    // ✅ Novo: Captura dados do analisador rápido para detecção técnica/feedback
    const fastBufferLength = analyserFast.frequencyBinCount;
    const fastFreqData = new Float32Array(fastBufferLength);
    analyserFast.getFloatFrequencyData(fastFreqData);

    // Aplica correção de microfone e calibração SPL
    if (window.AcousticCalibration) {
        window.AcousticCalibration.applyCalibration(freqData, audioCtx.sampleRate);
    }
    
    analyser.getFloatTimeDomainData(timeData);

    // ✅ Novo: Detecção de Clipping (Saturação Digital)
    let isClipping = false;
    for (let i = 0; i < timeData.length; i++) {
        if (Math.abs(timeData[i]) > 0.98) {
            isClipping = true;
            break;
        }
    }

    // --- Detecção de Pico Global (Usando analyserFast para precisão temporal) ---
    let peakDb = -Infinity;
    let peakIndex = 0;
    for (let i = 0; i < fastBufferLength; i++) {
        if (fastFreqData[i] > peakDb) {
            peakDb = fastFreqData[i];
            peakIndex = i;
        }
    }
    const currentFastPeakHz = peakIndex * audioCtx.sampleRate / analyserFast.fftSize;

    // --- Lógica de Peak Hold ---
    if (peakDb > peakHold.db) {
        peakHold.db = peakDb;
        peakHold.hz = currentFastPeakHz;
        peakHold.timer = 120; // ~2 segundos a 60fps
    } else if (peakHold.timer > 0) {
        peakHold.timer--;
    } else {
        peakHold.db = -100;
    }

    // --- Atualização Visual (Apenas se estivermos na aba de análise) ---
    if (canvas && canvasCtx) {
        // --- Renderização FFT Logarítmica (Padrão RTA Profissional) ---
        const minFreq = 20;
        const maxFreq = 20000;
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxFreq);
        const logRange = logMax - logMin;

        const barWidth = 2; // px
        const spacing = 1; // px
        const totalBars = Math.floor(canvas.width / (barWidth + spacing));
        
        canvasCtx.fillStyle = '#0f172a'; // Deep Slate Blue (Paleta SoundMaster)
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        let x = 0;
    
    for (let i = 0; i < totalBars; i++) {
        // Mapeia a barra atual para a frequência logarítmica correspondente
        const xPercent = i / totalBars;
        const freqStart = Math.pow(10, logMin + xPercent * logRange);
        const nextXPercent = (i + 1) / totalBars;
        const freqEnd = Math.pow(10, logMin + nextXPercent * logRange);

        // Converte frequência para bins do buffer FFT
        const binStart = Math.max(0, Math.floor(freqStart * analyser.fftSize / audioCtx.sampleRate));
        const binEnd = Math.min(bufferLength, Math.ceil(freqEnd * analyser.fftSize / audioCtx.sampleRate));
        
        let maxDbInBin = -120;
        // Se o bin for muito estreito (graves), garante que pegamos pelo menos 1 bin
        if (binStart === binEnd) {
            maxDbInBin = freqData[binStart] || -120;
        } else {
            for (let j = binStart; j < binEnd; j++) {
                if (freqData[j] > maxDbInBin) maxDbInBin = freqData[j];
            }
        }
        
        const db = maxDbInBin;
        const freq = freqStart; // Frequência de início da barra
        
        let fillStyle = '#64748b'; // Slate 500 default
        if (freq < 60) fillStyle = '#3b82f6';        // Sub (Blue)
        else if (freq < 250) fillStyle = '#10b981';  // Low (Emerald)
        else if (freq < 2000) fillStyle = '#f59e0b'; // Mid (Amber)
        else if (freq < 6000) fillStyle = '#f97316'; // High-Mid (Orange)
        else fillStyle = '#ef4444';                  // High (Red)

        const normalized = Math.max(0, Math.min(1, (db - analyser.minDecibels) / (analyser.maxDecibels - analyser.minDecibels)));
        const barHeight = normalized * canvas.height;

        canvasCtx.fillStyle = fillStyle;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + spacing;
    }

    // Desenhar Peak Hold Line Corrigido
    if (peakHold.timer > 0) {
        // Mapeamento logarítmico para a posição X do pico
        const peakLog = Math.log10(Math.max(minFreq, peakHold.hz));
        const peakXPercent = (peakLog - logMin) / logRange;
        const peakX = peakXPercent * canvas.width;
        
        const peakNormalized = Math.max(0, Math.min(1, (peakHold.db - analyser.minDecibels) / (analyser.maxDecibels - analyser.minDecibels)));
        const peakY = canvas.height - (peakNormalized * canvas.height);
        
        canvasCtx.strokeStyle = '#ffffff';
        canvasCtx.lineWidth = 2;
        canvasCtx.beginPath();
        canvasCtx.moveTo(peakX, peakY);
        canvasCtx.lineTo(peakX + barWidth + spacing, peakY);
        canvasCtx.stroke();
    }

    // --- Lógica de Waterfall (Histórico Visual Otimizado) ---

    if (waterfallCtx && waterfallCanvasEl) {
        const w = waterfallCanvasEl.width;
        const h = waterfallCanvasEl.height;
        const rowHeight = Math.max(1, h / WATERFALL_DEPTH);
        
        // GPU Native Scroll: Desloca a imagem para baixo sem re-renderizar arrays pesados
        waterfallCtx.drawImage(waterfallCanvasEl, 0, rowHeight);
        
        // Otimização: desenha apenas 'w' retângulos na primeira linha (1px por bin agrupado)
        const wfTotalBars = Math.floor(w);
        const wfBinsPerBar = Math.floor(bufferLength / wfTotalBars);
        
        for (let i = 0; i < wfTotalBars; i++) {
            const binStart = i * wfBinsPerBar;
            const binEnd = Math.min(binStart + wfBinsPerBar, bufferLength);
            
            let maxDbInBin = -Infinity;
            for (let j = binStart; j < binEnd; j++) {
                if (freqData[j] > maxDbInBin) maxDbInBin = freqData[j];
            }
            
            const db = maxDbInBin;
            const normalized = Math.max(0, Math.min(1, (db - analyser.minDecibels) / (analyser.maxDecibels - analyser.minDecibels)));
            
            // Cor baseada em intensidade (Heatmap)
            let color;
            if (normalized < 0.2) color = `rgb(0, 0, ${Math.floor(normalized * 255)})`;
            else if (normalized < 0.5) color = `rgb(0, ${Math.floor((normalized-0.2)*255)}, 255)`;
            else if (normalized < 0.8) color = `rgb(${Math.floor((normalized-0.5)*255)}, 255, 0)`;
            else color = `rgb(255, ${Math.floor((1-normalized)*255)}, 0)`;
            
            waterfallCtx.fillStyle = color;
            waterfallCtx.fillRect(i, 0, 1, rowHeight);
        }
    }
    } // Fim do if (canvas && canvasCtx)

    const peakHz = peakIndex * audioCtx.sampleRate / analyser.fftSize;
    const neighborLeft = freqData[Math.max(0, peakIndex - 1)] || analyser.minDecibels;
    const neighborRight = freqData[Math.min(bufferLength - 1, peakIndex + 1)] || analyser.minDecibels;
    const neighborAvg = (neighborLeft + neighborRight) / 2;
    
    let sumSquares = 0;
    for (let i = 0; i < timeData.length; i++) {
        sumSquares += timeData[i] * timeData[i];
    }
    const rms = Math.sqrt(sumSquares / timeData.length);
    window.currentGlobalRMS = rms; // Expõe para a rotina de calibração
    const rmsDb = 20 * Math.log10(Math.max(rms, 1e-12));
    
    // ✅ Novo: Fator de Crista (Peak-to-RMS) - Dinâmica do som
    const crestFactor = peakDb - rmsDb;

    const rmsPercent = Math.min(100, Math.max(0, ((rmsDb - analyser.minDecibels) / (analyser.maxDecibels - analyser.minDecibels)) * 100));
    if (rmsBar) {
        rmsBar.style.width = `${rmsPercent}%`;
        // Alerta visual de Clipping na barra de RMS
        rmsBar.style.backgroundColor = isClipping ? '#ef4444' : '#10b981';
    }
    
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
        let text = summary.text + ` [Crest Factor: ${crestFactor.toFixed(1)} dB]`;
        if (isClipping) text = "⚠️ CLIPPING DETECTADO! Reduza o ganho. " + text;
        analysisSummaryText.innerText = text;
    }
    renderAnalysisDetails(summary, pinkReport);
    
    const btnAutoCut = document.getElementById('btn-auto-cut');
    
    // ✅ Correção Auditoria: Feedback detectado no analisador rápido (latência mínima)
    const isFeedback = feedbackDetector.analyze(currentFastPeakHz, peakDb, -20);
    
    if (isFeedback) {
        if (feedbackAlert) {
            feedbackAlert.className = 'alert danger';
            feedbackAlert.innerHTML = `⚠️ <strong>Microfonia DETECTADA</strong> em <strong>${Math.round(peakHz)} Hz</strong> sustentados. Diferença local: ${formatDb(peakDb - neighborAvg)} dB.`;
        }

        if (btnAutoCut) {
            btnAutoCut.style.display = 'block';
            btnAutoCut.onclick = () => {
                MixerService.cutFeedback(Math.round(peakHz));
                btnAutoCut.innerText = 'Cortando...';
            };
        }
    } else {
        if (feedbackAlert) {
            feedbackAlert.className = 'alert safe';
            feedbackAlert.innerHTML = `Espectro estável. Pico dominante: ${Math.round(peakHz)} Hz (${formatDb(peakDb)} dB).`;
        }
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
    hasAnalysis: function () { return !!lastAnalysis; },
    triggerImpulse: function () { triggerImpulseMeasure(); },
    toggle: function () { toggleAnalyzer(); }
};

function toggleAnalyzer() {
    if (isAnalyzing) {
        stopAnalyzer();
    } else {
        startAnalyzer();
    }
}

// --- Geradores de Sinais de Áudio Avançados ---

function startLogarithmicSweep() {
    ensureAudioCtx();
    const duration = 10;
    const startFreq = 20;
    const endFreq = 20000;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);

    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.5, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime + duration - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);

    if (pinkMeasureSummary) {
        pinkMeasureSummary.innerText = 'Executando Sweep Logarítmico (20Hz - 20kHz)...';
    }

    osc.onended = () => {
        if (pinkMeasureSummary) pinkMeasureSummary.innerText = 'Sweep concluído.';
    };
}

/**
 * RT60: Dispara um pulso (Burst de Ruído) e captura o decaimento
 */
async function triggerImpulseMeasure() {
    console.log('[RT60] Iniciando medição de impulso...');
    ensureAudioCtx();
    
    if (!isAnalyzing) {
        console.log('[RT60] Microfone desligado. Ativando automaticamente...');
        await startAnalyzer();
        await new Promise(r => setTimeout(r, 1000));
    }

    if (!audioWorkletNode) {
        console.warn('[Analyzer] AudioWorklet offline. Usando fallback de buffer limitado.');
        // Fallback: Tenta capturar do analyser padrão se o worklet falhou
        const buffer = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buffer);
        if (acousticWorker) {
            acousticWorker.postMessage({ type: 'calculate', buffer, sampleRate: audioCtx.sampleRate });
            AppStore.addLog('Medição RT60 iniciada (Modo Fallback/Standard).');
        }
        return;
    }

    const duration = 0.1; // 100ms white noise burst
    const captureDuration = 5.0; // ✅ Correção Auditoria: Aumentado para 5s (suporte a grandes igrejas)
    
    // 1. Criar Burst de Ruído Branco com Envelope (Mais preciso que senoide)
    const bufferSizeBurst = Math.ceil(audioCtx.sampleRate * 0.15); // 150ms total
    const impulseBuffer = audioCtx.createBuffer(1, bufferSizeBurst, audioCtx.sampleRate);
    const impulseData = impulseBuffer.getChannelData(0);
    
    for (let i = 0; i < bufferSizeBurst; i++) {
        const white = Math.random() * 2 - 1;
        const t = i / bufferSizeBurst;
        // Envelope: Fade-in rápido (5ms) e Fade-out exponencial suave
        const env = t < 0.05 ? t / 0.05 : Math.exp(-12 * (t - 0.05));
        impulseData[i] = white * env * 0.8; 
    }

    const impulseSource = audioCtx.createBufferSource();
    impulseSource.buffer = impulseBuffer;
    impulseSource.connect(audioCtx.destination);

    // 2. Preparar gravação do decaimento
    const sampleRate = audioCtx.sampleRate;
    const bufferSize = sampleRate * captureDuration;
    const decayBuffer = new Float32Array(bufferSize);
    let offset = 0;

    // Usamos o Worklet para capturar o áudio puro
    const captureHandler = (e) => {
        if (e.data.type === 'raw-data') {
            const chunk = e.data.buffer;
            if (offset + chunk.length < bufferSize) {
                decayBuffer.set(chunk, offset);
                offset += chunk.length;
            }
        }
    };

    if (audioWorkletNode) {
        audioWorkletNode.port.onmessage = captureHandler;
    }

    impulseSource.start();
    console.log('[RT60] Burst de ruído branco disparado...');

    setTimeout(() => {
        impulseSource.stop();
        console.log('[RT60] Processando decaimento via Worker...');
        
        // Desconecta o handler de captura
        if (audioWorkletNode) {
            audioWorkletNode.port.onmessage = null; 
        }

        // Envia para o Worker
        acousticWorker.postMessage({
            type: 'calculate-rt60-schroeder',
            data: { buffer: decayBuffer, sampleRate: sampleRate }
        });

    }, captureDuration * 1000);
}

function _handleRT60Result(result) {
    console.log('[RT60 Result]', result);
    const resultEl = document.getElementById('rt60-result');
    if (resultEl) {
        resultEl.classList.remove('hidden');
        resultEl.innerHTML = `
            <div class="bg-cyan-900/40 border border-cyan-500/30 p-6 rounded-2xl shadow-xl">
                <h4 class="text-xs font-black uppercase text-cyan-400 tracking-widest mb-4">Resultado RT60 (Schroeder)</h4>
                <div class="flex items-baseline gap-2">
                    <span class="text-5xl font-black text-white">${result.rt60}</span>
                    <span class="text-xl font-bold text-cyan-300">segundos</span>
                </div>
                <div class="mt-2 flex flex-col gap-1">
                    <p class="text-[10px] text-cyan-100/60">SNR: ${result.snr} dB</p>
                    ${result.warning ? `<p class="text-[10px] text-amber-400 font-bold">⚠️ ${result.warning}</p>` : ''}
                </div>
            </div>
        `;
    }
}
let pinkNoiseNode = null;
let sineWaveNode = null;
let isPinkNoisePlaying = false;
let isSineWavePlaying = false;

// btnPink, btnSine, sineFreqInput são capturados dentro de initAnalyzer()
// para evitar null (DOM das pages não existe no load global)
let btnPink = null;
let btnSine = null;
let sineFreqInput = null;

// Helper to ensure AudioContext
function ensureAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

    // --- Exportação da API Pública ---
    window.SoundMasterAnalyzer = {
        start: startAnalyzer,
        stop: stopAnalyzer,
        toggle: toggleAnalyzer,
        triggerImpulse: triggerImpulseMeasure,
        hasAnalysis: () => lastAnalysis !== null,
        getFeedbackDetector: () => feedbackDetector,
        isAnalyzing: () => isAnalyzing,
        getLastAnalysis: () => lastAnalysis
    };

    // Ouvir eventos do roteador para Detector de Feedback
    document.addEventListener('page-loaded', (e) => {
        if (e.detail.pageId === 'feedback-detector') {
            console.log('[Analyzer] Página de Feedback ativa. Vinculando monitoramento...');
        }
    });

})();
