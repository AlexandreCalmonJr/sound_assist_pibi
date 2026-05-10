import React, { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

const FeedbackDetector = () => {
  const { emit } = useSocket();
  const [status, setStatus] = useState('safe');
  const [criticalFreqs, setCriticalFreqs] = useState([]);

  useEffect(() => {
    // Simulação de detecção (no futuro virá do worker/analyzer)
    const interval = setInterval(() => {
        if (Math.random() > 0.8) {
            const freq = Math.floor(Math.random() * 8000) + 100;
            const newFreq = { 
                id: Date.now(), 
                hz: freq, 
                level: (Math.random() * 20 - 40).toFixed(1),
                timestamp: new Date().toLocaleTimeString()
            };
            setCriticalFreqs(prev => [newFreq, ...prev].slice(0, 5));
            setStatus('warning');
            
            setTimeout(() => setStatus('safe'), 5000);
        }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="page-enter space-y-10">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-3xl text-3xl shadow-xl shadow-red-500/5">🚨</div>
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter">Detector de Feedback</h2>
            <p className="text-text-muted font-medium text-lg">Monitoramento proativo e corte de microfonias</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-red-500/5 border border-red-500/10 px-6 py-3 rounded-2xl max-w-sm">
          <span className="text-2xl animate-pulse">🤖</span>
          <p className="text-[10px] text-red-400/80 font-bold leading-relaxed uppercase tracking-widest">
            A IA está varrendo os 24 canais em busca de picos ressonantes.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Status de Alerta */}
        <div className="lg:col-span-1 bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 shadow-2xl flex flex-col items-center justify-center text-center space-y-8">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
                status === 'safe' ? 'bg-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.3)]' : 'bg-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.4)] animate-pulse'
            }`}>
                <span className="text-5xl">{status === 'safe' ? '✅' : '⚠️'}</span>
            </div>
            <div>
                <h3 className={`text-2xl font-black mb-2 tracking-tight ${status === 'safe' ? 'text-green-400' : 'text-red-400'}`}>
                    {status === 'safe' ? 'Sistema Seguro' : 'Feedback Detectado'}
                </h3>
                <p className="text-xs text-text-muted leading-relaxed max-w-[200px] mx-auto">
                    {status === 'safe' 
                        ? 'Nenhuma frequência de feedback detectada nos últimos 5 minutos.' 
                        : 'Foram detectados picos anômalos que podem causar microfonia.'}
                </p>
            </div>
        </div>

        {/* Frequências Críticas */}
        <div className="lg:col-span-2 bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 shadow-2xl flex flex-col">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted mb-10">Frequências em Monitoramento</h3>
            
            <div className="flex-1 space-y-4">
                {criticalFreqs.length > 0 ? (
                    criticalFreqs.map(f => (
                        <div key={f.id} className="flex items-center justify-between p-6 bg-black/40 rounded-3xl border border-red-500/20 animate-in slide-in-from-right-4">
                            <div className="flex items-center gap-6">
                                <div className="text-3xl font-black text-white font-mono tracking-tighter">{f.hz}<span className="text-sm text-red-500 ml-1">Hz</span></div>
                                <div className="h-8 w-px bg-white/5"></div>
                                <div>
                                    <span className="text-[9px] uppercase font-black text-text-muted block mb-1">Nível Detectado</span>
                                    <span className="text-xs font-bold text-red-400">{f.level} dB</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-mono text-text-muted uppercase">{f.timestamp}</span>
                                <button className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-[9px] font-black rounded-xl uppercase tracking-widest transition-all">Corte Notch</button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 opacity-20">
                        <div className="w-12 h-12 border-4 border-white/20 border-t-brand-primary rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Varredura FFT Ativa...</p>
                    </div>
                )}
            </div>

            <div className="mt-10 pt-8 border-t border-white/5 flex justify-end gap-3">
                <button className="px-6 py-3 bg-white/5 hover:bg-white/10 text-text-muted hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5">Exportar Log</button>
                <button className="px-6 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20">Limpar Histórico</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackDetector;
