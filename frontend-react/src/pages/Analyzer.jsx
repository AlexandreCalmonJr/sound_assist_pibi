import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../hooks/useSocket';

const Analyzer = () => {
  const { emit } = useSocket();
  const canvasRef = useRef(null);
  const waterfallRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationIdRef = useRef(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [rms, setRms] = useState(-100);
  const [peak, setPeak] = useState({ hz: 0, db: -100 });

  useEffect(() => {
    const getDevices = async () => {
      try {
        const devList = await navigator.mediaDevices.enumerateDevices();
        setDevices(devList.filter(d => d.kind === 'audioinput'));
      } catch (err) {
        console.error('Erro ao listar dispositivos:', err);
      }
    };
    getDevices();
  }, []);

  const startAnalysis = async () => {
    try {
      const constraints = {
        audio: {
          deviceId: selectedDevice !== 'default' ? { exact: selectedDevice } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 16384; // Alta resolução
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsAnalyzing(true);
      requestAnimationFrame(runAnalysis);
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
      alert('Não foi possível acessar o microfone.');
    }
  };

  const stopAnalysis = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    setIsAnalyzing(false);
    setRms(-100);
    setPeak({ hz: 0, db: -100 });
  };

  const runAnalysis = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Float32Array(bufferLength);
    const timeData = new Float32Array(analyser.fftSize);

    analyser.getFloatFrequencyData(freqData);
    analyser.getFloatTimeDomainData(timeData);

    // RMS Calculation
    let sumSquares = 0;
    for (let i = 0; i < timeData.length; i++) {
      sumSquares += timeData[i] * timeData[i];
    }
    const currentRms = Math.sqrt(sumSquares / timeData.length);
    const currentRmsDb = 20 * Math.log10(Math.max(currentRms, 1e-12));
    setRms(currentRmsDb);

    // Peak Detection
    let maxDb = -Infinity;
    let maxIndex = 0;
    for (let i = 0; i < bufferLength; i++) {
        if (freqData[i] > maxDb) {
            maxDb = freqData[i];
            maxIndex = i;
        }
    }
    const peakHz = maxIndex * audioCtxRef.current.sampleRate / analyser.fftSize;
    setPeak({ hz: Math.round(peakHz), db: maxDb });

    // Render FFT (Logarithmic)
    renderFFT(freqData);
    renderWaterfall(freqData);

    animationIdRef.current = requestAnimationFrame(runAnalysis);
  };

  const renderFFT = (data) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, w, h);

    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logRange = logMax - logMin;

    ctx.beginPath();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;

    for (let i = 0; i < w; i++) {
        const xPercent = i / w;
        const freq = Math.pow(10, logMin + xPercent * logRange);
        const bin = Math.floor(freq * analyserRef.current.fftSize / audioCtxRef.current.sampleRate);
        const db = data[bin] || -120;
        
        const yPercent = Math.max(0, Math.min(1, (db + 100) / 90));
        const y = h - (yPercent * h);

        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
    }
    ctx.stroke();

    // Frequency labels
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.font = '9px monospace';
    [100, 1000, 10000].forEach(f => {
        const x = ((Math.log10(f) - logMin) / logRange) * w;
        ctx.fillText(`${f >= 1000 ? f/1000 + 'k' : f}Hz`, x, h - 5);
        ctx.fillRect(x, 0, 1, h - 20);
    });
  };

  const renderWaterfall = (data) => {
    const canvas = waterfallRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Shift down
    ctx.drawImage(canvas, 0, 1);

    // Draw new top line
    const bufferLength = data.length;
    for (let i = 0; i < w; i++) {
        const xPercent = i / w;
        // Simplified log map for waterfall for performance
        const bin = Math.floor(xPercent * bufferLength);
        const db = data[bin];
        
        const norm = Math.max(0, Math.min(1, (db + 100) / 90));
        
        let color;
        if (norm < 0.2) color = `rgb(0, 0, ${norm * 5 * 255})`;
        else if (norm < 0.5) color = `rgb(0, ${(norm-0.2) * 3.3 * 255}, 255)`;
        else if (norm < 0.8) color = `rgb(${(norm-0.5) * 3.3 * 255}, 255, 0)`;
        else color = `rgb(255, ${(1-norm) * 5 * 255}, 0)`;

        ctx.fillStyle = color;
        ctx.fillRect(i, 0, 1, 1);
    }
  };

  return (
    <div className="page-enter space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Analisador Espectral</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">RTA & Waterfall de Precisão</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="bg-surface-elevated/50 border border-white/5 rounded-xl px-4 py-2 text-xs text-text-secondary focus:outline-none focus:border-brand-primary/40"
          >
            <option value="default">Dispositivo Padrão</option>
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microfone'}</option>
            ))}
          </select>
          
          <button 
            onClick={isAnalyzing ? stopAnalysis : startAnalysis}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
              isAnalyzing 
                ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20' 
                : 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:brightness-110'
            }`}
          >
            {isAnalyzing ? '⏹ Parar Análise' : '▶ Iniciar Áudio'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* FFT Canvas Area */}
        <div className="lg:col-span-3 space-y-4">
            <div className="relative bg-black rounded-3xl overflow-hidden border border-white/5 aspect-video lg:aspect-auto lg:h-[400px]">
                <canvas ref={canvasRef} width={1200} height={400} className="w-full h-full" />
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                    <div className="bg-black/60 backdrop-blur-md border border-white/5 rounded-lg px-3 py-2">
                        <p className="text-[8px] uppercase text-text-muted mb-1">Peak Hold</p>
                        <p className="text-xs font-mono text-brand-primary">{peak.hz} Hz / {peak.db.toFixed(1)} dB</p>
                    </div>
                </div>
            </div>

            {/* Waterfall Area */}
            <div className="bg-black rounded-3xl overflow-hidden border border-white/5 h-40">
                <canvas ref={waterfallRef} width={1200} height={160} className="w-full h-full opacity-60" />
            </div>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
            <div className="bg-surface-elevated/20 border border-white/5 rounded-3xl p-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-6">Métricas Ativas</h4>
                
                <div className="space-y-8">
                    <div>
                        <div className="flex justify-between text-[10px] uppercase font-bold text-text-muted mb-2">
                            <span>RMS Level</span>
                            <span className={rms > -20 ? 'text-red-400' : 'text-brand-primary'}>{rms.toFixed(1)} dB</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-75 ${rms > -20 ? 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]' : 'bg-brand-primary shadow-[0_0_10px_rgba(34,211,238,0.5)]'}`}
                                style={{ width: `${Math.max(0, (rms + 100) / 90 * 100)}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[8px] uppercase text-text-muted mb-1">Freq. Dominante</p>
                            <p className="text-lg font-bold text-text-primary">{peak.hz} <span className="text-[10px] font-normal opacity-40">Hz</span></p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[8px] uppercase text-text-muted mb-1">Pico Máximo</p>
                            <p className="text-lg font-bold text-text-primary">{peak.db.toFixed(1)} <span className="text-[10px] font-normal opacity-40">dB</span></p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-surface-elevated/10 border border-white/5 rounded-3xl p-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-4">Ações de Análise</h4>
                <div className="space-y-3">
                    <button className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-bold uppercase tracking-widest border border-white/5 transition-all text-left px-4 flex justify-between items-center group">
                        Gerar Relatório IA
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </button>
                    <button className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-bold uppercase tracking-widest border border-white/5 transition-all text-left px-4 flex justify-between items-center group">
                        Calibrar Microfone
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Analyzer;
