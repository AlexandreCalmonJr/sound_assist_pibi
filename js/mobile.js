const socket = io();

const btnConnect = document.getElementById('mobile-btn-connect');
const btnDisconnect = document.getElementById('mobile-btn-disconnect');
const mixerIpInput = document.getElementById('mobile-mixer-ip');
const connectionText = document.getElementById('mobile-connection-text');
const connectionBadge = document.getElementById('mobile-connection-badge');
const masterSlider = document.getElementById('mobile-master-slider');
const masterLevelText = document.getElementById('mobile-master-level');
const masterDbText = document.getElementById('mobile-master-db');
const masterDown = document.getElementById('mobile-master-down');
const masterUp = document.getElementById('mobile-master-up');
const presetButtons = document.querySelectorAll('[data-master-preset]');
const btnStartMic = document.getElementById('mobile-btn-start-mic');
const btnStopMic = document.getElementById('mobile-btn-stop-mic');
const micStatusText = document.getElementById('mobile-mic-status');
const fftCanvas = document.getElementById('mobile-fft-canvas');
const mobileLog = document.getElementById('mobile-log');
const feedbackAlert = document.getElementById('mobile-feedback-alert');
const rmsReadout = document.getElementById('mobile-rms-readout');
const peakReadout = document.getElementById('mobile-peak-readout');
const btnCutFeedback = document.getElementById('mobile-btn-cut-feedback');
const mobileTargetChannel = document.getElementById('mobile-target-channel');
const btnMobileCleanChannel = document.getElementById('mobile-clean-channel');
const btnMobileHpf = document.getElementById('mobile-hpf-channel');
const btnMobileGate = document.getElementById('mobile-gate-channel');
const btnMobileCompressor = document.getElementById('mobile-compressor-channel');
const btnMobileEqMud = document.getElementById('mobile-eq-mud');
const btnMobileEqHarsh = document.getElementById('mobile-eq-harsh');
const btnMobileAfsOn = document.getElementById('mobile-afs-on');
const btnMobileAfsOff = document.getElementById('mobile-afs-off');
const mobileMapLocation = document.getElementById('mobile-map-location');
const btnMobileSavePeak = document.getElementById('mobile-save-peak');
const btnMobileRefreshMaps = document.getElementById('mobile-refresh-maps');
const mobileMappingList = document.getElementById('mobile-mapping-list');
const btnAiAnalyze = document.getElementById('mobile-btn-ai-analyze');
const btnAiSend = document.getElementById('mobile-btn-ai-send');
const btnAiReset = document.getElementById('mobile-btn-ai-reset');
const btnPinkNoise = document.getElementById('mobile-btn-pink-noise');
const aiInput = document.getElementById('mobile-ai-input');
const aiChatBox = document.getElementById('mobile-ai-chat');
const aiQuickTags = document.querySelectorAll('.ai-quick-tag');

let audioCtx;
let analyser;
let source;
let micStream;
let isMicActive = false;
let animationId;
let currentPeakHz = 0;
let suspectedFeedbackFrames = 0;
let latestMasterPercent = 0;
let isPinkNoiseActive = false;

function appendMobileLog(message) {
    if (!mobileLog) return;
    const entry = document.createElement('div');
    entry.className = 'mixer-log-entry';
    entry.innerText = `${new Date().toLocaleTimeString()} - ${message}`;
    mobileLog.prepend(entry);
    while (mobileLog.children.length > 20) {
        mobileLog.removeChild(mobileLog.lastChild);
    }
}

function setBusy(button, busy, label) {
    if (!button) return;
    button.disabled = busy;
    if (label) button.innerText = label;
}

function updateConnection(connected, msg) {
    connectionBadge.classList.toggle('online', connected);
    connectionBadge.classList.toggle('offline', !connected);
    connectionBadge.innerText = connected ? 'Conectado' : 'Offline';
    connectionText.innerText = msg || (connected ? 'Mixer conectado.' : 'Mixer desconectado.');
    setBusy(btnConnect, false, 'Conectar');
    appendMobileLog(msg || (connected ? 'Conectado ao mixer.' : 'Desconectado do mixer.'));
}

function updateMasterDisplay(level, db) {
    const percentage = Math.round(Math.min(100, Math.max(0, level * 100)));
    latestMasterPercent = percentage;
    masterLevelText.innerText = `${percentage}%`;
    masterDbText.innerText = `(${typeof db === 'number' ? db.toFixed(1) + ' dB' : '-∞ dB'})`;
    if (masterSlider) masterSlider.value = percentage;
}

function resizeCanvasForDisplay() {
    if (!fftCanvas) return;
    const scale = window.devicePixelRatio || 1;
    const displayWidth = Math.max(320, Math.floor(fftCanvas.clientWidth));
    const displayHeight = Math.max(140, Math.floor(fftCanvas.clientHeight));
    const width = Math.floor(displayWidth * scale);
    const height = Math.floor(displayHeight * scale);
    if (fftCanvas.width !== width || fftCanvas.height !== height) {
        fftCanvas.width = width;
        fftCanvas.height = height;
    }
}

async function startMic() {
    if (!navigator.mediaDevices?.getUserMedia) {
        alert('Este navegador não permite acesso ao microfone nesta página.');
        return;
    }

    try {
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.82;
        source = audioCtx.createMediaStreamSource(micStream);
        source.connect(analyser);
        isMicActive = true;
        suspectedFeedbackFrames = 0;
        micStatusText.innerText = 'Microfone ativo';
        btnStartMic.disabled = true;
        btnStopMic.disabled = false;
        btnCutFeedback.disabled = true;
        analyzeMic();
        appendMobileLog('Microfone do telefone ativado.');
    } catch (error) {
        console.error(error);
        alert('Não foi possível ativar o microfone. Verifique as permissões do navegador.');
    }
}

function stopMic() {
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
    }
    if (audioCtx) {
        audioCtx.close();
    }
    isMicActive = false;
    micStream = null;
    audioCtx = null;
    analyser = null;
    source = null;
    cancelAnimationFrame(animationId);
    micStatusText.innerText = 'Microfone offline';
    btnStartMic.disabled = false;
    btnStopMic.disabled = true;
    btnCutFeedback.disabled = true;
    feedbackAlert.className = 'alert safe mobile-alert';
    feedbackAlert.innerText = 'Microfone parado.';
    rmsReadout.innerText = '0%';
    peakReadout.innerText = '-- Hz';
    appendMobileLog('Microfone do telefone parado.');
}

function drawAnalyzer(canvasCtx, dataArray, bufferLength) {
    resizeCanvasForDisplay();
    const width = fftCanvas.width;
    const height = fftCanvas.height;
    const barWidth = Math.max(2, (width / bufferLength) * 2.4);

    canvasCtx.clearRect(0, 0, width, height);
    canvasCtx.fillStyle = '#050508';
    canvasCtx.fillRect(0, 0, width, height);
    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    canvasCtx.lineWidth = 1;
    for (let y = 0; y < height; y += height / 4) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, y);
        canvasCtx.lineTo(width, y);
        canvasCtx.stroke();
    }

    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const freq = i * audioCtx.sampleRate / analyser.fftSize;
        let color = '#8888a0';
        if (freq < 100) color = '#34ace0';
        else if (freq < 500) color = '#2ed573';
        else if (freq < 2000) color = '#f1c40f';
        else if (freq < 6000) color = '#ffa502';
        else color = '#ff4757';
        canvasCtx.fillStyle = color;
        canvasCtx.fillRect(x, height - (value / 255) * height, barWidth, (value / 255) * height);
        x += barWidth + 1;
    }
}

function analyzeMic() {
    if (!isMicActive || !analyser) return;
    animationId = requestAnimationFrame(analyzeMic);

    const canvasCtx = fftCanvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    let maxVal = 0;
    let maxIndex = 0;
    let sumSquares = 0;

    for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const normalized = value / 255;
        sumSquares += normalized * normalized;
        if (value > maxVal) {
            maxVal = value;
            maxIndex = i;
        }
    }

    drawAnalyzer(canvasCtx, dataArray, bufferLength);

    const rms = Math.sqrt(sumSquares / bufferLength);
    const rmsPercent = Math.round(Math.min(100, rms * 350));
    currentPeakHz = maxIndex * (audioCtx.sampleRate / analyser.fftSize);
    const peakRounded = Math.round(currentPeakHz);

    rmsReadout.innerText = `${rmsPercent}%`;
    peakReadout.innerText = peakRounded > 0 ? `${peakRounded} Hz` : '-- Hz';

    const looksLikeFeedback = maxVal > 225 && currentPeakHz > 180 && currentPeakHz < 9000 && rmsPercent > 18;
    suspectedFeedbackFrames = looksLikeFeedback ? suspectedFeedbackFrames + 1 : Math.max(0, suspectedFeedbackFrames - 2);

    if (suspectedFeedbackFrames > 16) {
        feedbackAlert.className = 'alert danger mobile-alert';
        feedbackAlert.innerText = `Atenção: pico sustentado em ${peakRounded} Hz.`;
        btnCutFeedback.disabled = false;
    } else if (rmsPercent > 75) {
        feedbackAlert.className = 'alert danger mobile-alert';
        feedbackAlert.innerText = 'Nível ambiente muito alto. Confira o master e os retornos.';
        btnCutFeedback.disabled = true;
    } else {
        feedbackAlert.className = 'alert safe mobile-alert';
        feedbackAlert.innerText = `Microfone ok. Pico em ${peakRounded} Hz.`;
        btnCutFeedback.disabled = true;
    }
}

function setMasterLevel(value) {
    const level = Math.min(1, Math.max(0, value));
    updateMasterDisplay(level, undefined);
    socket.emit('set_master_level', { level });
}

function getTargetChannel() {
    const value = Number(mobileTargetChannel?.value || 1);
    if (!Number.isInteger(value) || value < 1 || value > 24) {
        alert('Informe um canal entre 1 e 24.');
        return null;
    }
    return value;
}

function emitMobileTool(eventName, payload, label) {
    socket.emit(eventName, payload);
    appendMobileLog(label);
}

async function loadMobileMappings() {
    if (!mobileMappingList) return;
    try {
        const res = await fetch('/api/mappings');
        if (!res.ok) throw new Error('Falha ao carregar mapeamentos.');
        const mappings = await res.json();
        if (!mappings.length) {
            mobileMappingList.innerText = 'Nenhum mapeamento salvo ainda.';
            return;
        }
        mobileMappingList.innerHTML = '';
        mappings.slice().reverse().slice(0, 8).forEach((map) => {
            const item = document.createElement('div');
            item.className = 'mobile-map-item';
            const location = map.location ? ` - ${map.location}` : '';
            const channel = map.channel ? ` canal ${map.channel}` : '';
            item.innerText = `${map.hz} Hz${channel}${location}`;
            mobileMappingList.appendChild(item);
        });
    } catch (error) {
        mobileMappingList.innerText = error.message;
    }
}

async function saveCurrentPeak() {
    const hz = Math.round(currentPeakHz);
    if (!hz) {
        alert('Ative o microfone e espere o pico aparecer antes de salvar.');
        return;
    }
    const body = {
        hz,
        channel: getTargetChannel() || 1,
        location: mobileMapLocation?.value?.trim() || '',
        rms: rmsReadout?.innerText || '',
        date: new Date().toISOString()
    };
    try {
        const res = await fetch('/api/mappings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Nao foi possivel salvar o mapeamento.');
        appendMobileLog(`Pico ${hz} Hz salvo no mapeamento.`);
        loadMobileMappings();
    } catch (error) {
        alert(error.message);
    }
}

async function askAI(text, includeAnalysis = false) {
    if (!text && !includeAnalysis) return;
    
    const chatMsg = document.createElement('div');
    chatMsg.style.marginBottom = '8px';
    chatMsg.innerHTML = `<strong style="color: var(--accent-primary);">Você:</strong> ${text || 'Análise de áudio...'}`;
    aiChatBox.appendChild(chatMsg);
    aiChatBox.scrollTop = aiChatBox.scrollHeight;

    const payload = { 
        message: text || 'analise o som ambiente',
        analysis: includeAnalysis ? {
            peakHz: Math.round(currentPeakHz),
            rms: rmsReadout?.innerText || '0%',
            timestamp: Date.now(),
            isPinkNoise: isPinkNoiseActive
        } : null
    };

    try {
        const res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        const aiMsg = document.createElement('div');
        aiMsg.style.marginBottom = '12px';
        aiMsg.style.paddingLeft = '8px';
        aiMsg.style.borderLeft = '2px solid var(--accent-secondary)';
        aiMsg.innerHTML = `<strong style="color: var(--accent-secondary);">IA:</strong> ${data.text}`;
        
        if (data.command) {
            const btnCmd = document.createElement('button');
            btnCmd.className = 'action-btn secondary small';
            btnCmd.style.marginTop = '8px';
            btnCmd.innerText = `Executar: ${data.command.desc}`;
            btnCmd.onclick = () => {
                socket.emit('execute_ai_command', data.command);
                appendMobileLog(`Executado via IA: ${data.command.desc}`);
                btnCmd.disabled = true;
                btnCmd.innerText = 'Aplicado ✅';
            };
            aiMsg.appendChild(btnCmd);
        }

        aiChatBox.appendChild(aiMsg);
        aiChatBox.scrollTop = aiChatBox.scrollHeight;
    } catch (err) {
        const errMsg = document.createElement('div');
        errMsg.style.color = 'var(--danger)';
        errMsg.innerText = 'IA: Erro de conexão com o servidor.';
        aiChatBox.appendChild(errMsg);
    }
}

btnConnect?.addEventListener('click', () => {
    const ip = mixerIpInput.value.trim();
    if (!ip) {
        alert('Informe o IP da mesa.');
        return;
    }
    setBusy(btnConnect, true, 'Conectando...');
    socket.emit('connect_mixer', ip);
    appendMobileLog(`Tentando conectar em ${ip}.`);
    connectionBadge.classList.remove('online');
    connectionBadge.classList.add('offline');
    connectionBadge.innerText = 'Conectando';
    connectionText.innerText = 'Conectando...';
});

btnDisconnect?.addEventListener('click', () => {
    socket.emit('disconnect_mixer');
    appendMobileLog('Solicitando desconexão do mixer.');
});

masterSlider?.addEventListener('input', () => {
    const value = Number(masterSlider.value) / 100;
    updateMasterDisplay(value, undefined);
});

masterSlider?.addEventListener('change', () => {
    const value = Number(masterSlider.value) / 100;
    setMasterLevel(value);
});

masterDown?.addEventListener('click', () => {
    const next = Math.max(0, latestMasterPercent - 1) / 100;
    setMasterLevel(next);
});

masterUp?.addEventListener('click', () => {
    const next = Math.min(100, latestMasterPercent + 1) / 100;
    setMasterLevel(next);
});

presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const preset = Number(button.dataset.masterPreset) / 100;
        setMasterLevel(preset);
        appendMobileLog(`Preset aplicado: ${button.innerText} (${Math.round(preset * 100)}%).`);
    });
});

btnStartMic?.addEventListener('click', startMic);
btnStopMic?.addEventListener('click', stopMic);

btnCutFeedback?.addEventListener('click', () => {
    if (!currentPeakHz) return;
    const hz = Math.round(currentPeakHz);
    socket.emit('cut_feedback', { hz });
    appendMobileLog(`Solicitado corte do pico em ${hz} Hz.`);
    btnCutFeedback.disabled = true;
});

btnMobileCleanChannel?.addEventListener('click', () => {
    const channel = getTargetChannel();
    if (!channel) return;
    emitMobileTool('run_clean_sound_preset', { channel }, `Preset de som limpo no canal ${channel}.`);
});

btnMobileHpf?.addEventListener('click', () => {
    const channel = getTargetChannel();
    if (!channel) return;
    emitMobileTool('apply_channel_hpf', { channel, hz: 100 }, `HPF 100Hz no canal ${channel}.`);
});

btnMobileGate?.addEventListener('click', () => {
    const channel = getTargetChannel();
    if (!channel) return;
    emitMobileTool('apply_channel_gate', { channel, enabled: 1, threshold: -52 }, `Gate leve no canal ${channel}.`);
});

btnMobileCompressor?.addEventListener('click', () => {
    const channel = getTargetChannel();
    if (!channel) return;
    emitMobileTool('apply_channel_compressor', { channel, ratio: 2.5, threshold: -18 }, `Compressor leve no canal ${channel}.`);
});

btnMobileEqMud?.addEventListener('click', () => {
    const channel = getTargetChannel();
    if (!channel) return;
    emitMobileTool('apply_eq_cut', { target: 'channel', channel, hz: 250, gain: -3, q: 1.1, band: 2 }, `Corte 250Hz no canal ${channel}.`);
});

btnMobileEqHarsh?.addEventListener('click', () => {
    const channel = getTargetChannel();
    if (!channel) return;
    emitMobileTool('apply_eq_cut', { target: 'channel', channel, hz: 3200, gain: -2.5, q: 1.5, band: 3 }, `Corte 3.2kHz no canal ${channel}.`);
});

btnMobileAfsOn?.addEventListener('click', () => {
    emitMobileTool('set_afs_enabled', { enabled: 1 }, 'Solicitado AFS2 global ligado.');
});

btnMobileAfsOff?.addEventListener('click', () => {
    emitMobileTool('set_afs_enabled', { enabled: 0 }, 'Solicitado AFS2 global desligado.');
});

btnMobileSavePeak?.addEventListener('click', saveCurrentPeak);
btnMobileRefreshMaps?.addEventListener('click', loadMobileMappings);

btnAiAnalyze?.addEventListener('click', () => {
    if (!isMicActive) {
        alert('Ative o microfone na aba "Microfone" primeiro!');
        return;
    }
    askAI('', true);
});

btnAiSend?.addEventListener('click', () => {
    const text = aiInput.value.trim();
    if (!text) return;
    askAI(text);
    aiInput.value = '';
});

btnPinkNoise?.addEventListener('click', () => {
    isPinkNoiseActive = !isPinkNoiseActive;
    socket.emit('set_oscillator', { enabled: isPinkNoiseActive, type: 1, level: -20 });
    btnPinkNoise.classList.toggle('active', isPinkNoiseActive);
    btnPinkNoise.innerText = isPinkNoiseActive ? 'Parar Ruído ⏹️' : 'Ruído Rosa 🔊';
    appendMobileLog(isPinkNoiseActive ? 'Gerador de Ruído Rosa ativado.' : 'Gerador de Ruído Rosa desligado.');
});

aiQuickTags.forEach(tag => {
    tag.addEventListener('click', () => {
        const prompt = tag.getAttribute('data-prompt');
        askAI(prompt, true);
    });
});

btnAiReset?.addEventListener('click', () => {
    aiChatBox.innerHTML = '<div style="color: var(--text-muted);">Histórico limpo. Aguardando nova análise...</div>';
    appendMobileLog('Sessão de IA reiniciada.');
});

aiInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnAiSend.click();
});

function initMobilePageNavigation() {
    const navButtons = document.querySelectorAll('.mobile-nav-btn');
    const pages = document.querySelectorAll('.mobile-page');

    navButtons.forEach((button) => {
        button.addEventListener('click', () => {
            navButtons.forEach(btn => btn.classList.remove('active'));
            pages.forEach(page => page.classList.remove('active'));

            button.classList.add('active');
            const target = button.getAttribute('data-target');
            document.getElementById(target)?.classList.add('active');
        });
    });
}

window.addEventListener('resize', resizeCanvasForDisplay);
resizeCanvasForDisplay();
loadMobileMappings();
initMobilePageNavigation();

socket.on('connect', () => appendMobileLog('Conectado ao servidor WebSocket.'));
socket.on('disconnect', () => appendMobileLog('Desconectado do servidor WebSocket.'));

socket.on('mixer_status', (data) => {
    updateConnection(data.connected, data.msg || 'Status do mixer recebido.');
});

socket.on('master_level', (level) => {
    updateMasterDisplay(level, undefined);
    appendMobileLog(`Master atual: ${Math.round(level * 100)}%.`);
});

socket.on('master_level_db', (db) => {
    masterDbText.innerText = `(${db.toFixed(1)} dB)`;
});

socket.on('feedback_cut_success', (data) => {
    appendMobileLog(data.msg || 'Ação de corte concluída.');
});
