import React, { useState } from 'react';
import { useSocket } from '../hooks/useSocket';

const Aes67Health = () => {
  const { mixerStatus } = useSocket();
  const [activeChannels, setActiveChannels] = useState(32);

  return (
    <div className="page-enter space-y-10">
      <header className="mb-12">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-cyan-900/40 border border-cyan-500/20 rounded-3xl text-3xl shadow-xl shadow-cyan-500/5">🌐</div>
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter">Saúde de Cabos (AES67)</h2>
            <p className="text-text-muted font-medium text-lg">Telemetria de rede e monitoramento de canais via RTP</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Status da Rede */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface-elevated/20 border border-white/5 rounded-3xl p-8 shadow-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted mb-8">Status do Receptor</h3>
            <div className="space-y-6">
                <div className="flex items-center justify-between py-4 border-b border-white/5">
                    <span className="text-sm font-bold text-text-primary">Porta RTP</span>
                    <span className="px-3 py-1 bg-black rounded-lg text-xs font-mono text-brand-primary border border-brand-primary/30">5004</span>
                </div>
                <div className="flex items-center justify-between py-4 border-b border-white/5">
                    <span className="text-sm font-bold text-text-primary">Sincronismo PTP</span>
                    <span className="flex items-center gap-3 text-green-400 text-[10px] font-black uppercase tracking-[0.2em]">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]"></span>
                        Locked
                    </span>
                </div>
                <div className="flex items-center justify-between py-4">
                    <span className="text-sm font-bold text-text-primary">Jitter Nominal</span>
                    <span className="text-xs font-mono text-text-muted">0.02ms</span>
                </div>
            </div>
          </div>

          <div className="bg-surface-elevated/20 border border-white/5 rounded-3xl p-8 shadow-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted mb-6">Diagnóstico IA</h3>
            <div className="space-y-4">
                <div className="p-5 bg-black/40 rounded-2xl border border-white/5 text-xs text-text-muted italic leading-relaxed">
                    "O fluxo AES67 está estável. Não foram detectadas interferências de 60Hz nos cabos de sinal analógico balanceados."
                </div>
                <div className="p-4 bg-brand-primary/5 border border-brand-primary/10 rounded-2xl flex items-center gap-3">
                    <span className="text-lg">🛡️</span>
                    <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest">Proteção de Rede Ativa</span>
                </div>
            </div>
          </div>
        </div>

        {/* Canais Monitorados */}
        <div className="lg:col-span-2">
          <div className="bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 shadow-2xl h-full flex flex-col">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted">Meters Multi-Canal (AES67)</h3>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></span>
                <span className="text-[10px] text-brand-primary font-black uppercase tracking-widest">{activeChannels} Canais Ativos</span>
              </div>
            </div>
            
            {/* Grade de Meters */}
            <div className="flex-1 grid grid-cols-4 md:grid-cols-8 gap-6 min-h-[400px]">
                {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-3 group">
                        <div className="flex-1 w-4 bg-white/5 rounded-full relative overflow-hidden shadow-inner border border-white/5">
                            <div 
                                className="absolute bottom-0 w-full bg-gradient-to-t from-cyan-500 via-cyan-400 to-white/50 transition-all duration-300"
                                style={{ height: `${Math.floor(Math.random() * 60) + 20}%` }}
                            ></div>
                        </div>
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-tighter group-hover:text-brand-primary transition-colors">CH {i + 1}</span>
                    </div>
                ))}
            </div>

            <div className="mt-10 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-end gap-4">
                <button className="px-8 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5">
                    Reiniciar Stream RTP
                </button>
                <button className="px-8 py-3.5 bg-brand-primary hover:brightness-110 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-primary/20">
                    Ativar Varredura IA
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Aes67Health;
