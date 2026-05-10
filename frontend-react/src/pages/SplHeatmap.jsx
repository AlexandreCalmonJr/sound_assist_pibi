import React from 'react';
import AcousticMap from '../components/AcousticMap';

const SplHeatmap = () => {
  return (
    <div className="page-enter space-y-10">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-red-900/40 border border-red-500/20 rounded-3xl text-3xl shadow-xl shadow-red-500/5">🔥</div>
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter">Mapa de Calor SPL</h2>
            <p className="text-text-muted font-medium text-lg">Distribuição de pressão sonora e cobertura</p>
          </div>
        </div>
      </header>

      <div className="bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between mb-10 gap-6">
            <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted mb-2">Cobertura do Salão Principal</h3>
                <p className="text-xs text-text-secondary">Clique nos bancos para registrar a leitura do microfone RTA.</p>
            </div>
            <div className="flex items-center gap-6 bg-black/40 px-6 py-4 rounded-3xl border border-white/5 shadow-inner">
                <span className="text-[10px] text-text-muted font-black uppercase tracking-widest">Escala dB:</span>
                <div className="flex h-2.5 w-48 rounded-full bg-gradient-to-r from-blue-500 via-green-500 via-yellow-500 to-red-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]"></div>
                <span className="text-[10px] text-text-primary font-black font-mono">70 - 105 dB</span>
            </div>
        </div>

        {/* Heatmap Tooling */}
        <AcousticMap />

        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="p-6 bg-black/40 rounded-3xl border border-white/5 text-center group hover:border-brand-primary/20 transition-all">
                <span className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block mb-2">Diferença L/R</span>
                <span className="text-2xl font-black text-white">1.2 <span className="text-sm text-text-muted font-bold">dB</span></span>
            </div>
            <div className="p-6 bg-black/40 rounded-3xl border border-white/5 text-center group hover:border-brand-primary/20 transition-all">
                <span className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block mb-2">Média Central</span>
                <span className="text-2xl font-black text-white">94 <span className="text-sm text-text-muted font-bold">dB</span></span>
            </div>
            <div className="p-6 bg-red-600/10 rounded-3xl border border-red-500/20 text-center group shadow-xl shadow-red-600/5">
                <span className="text-[10px] text-red-400 font-black uppercase tracking-[0.2em] block mb-2">Pico (Palco)</span>
                <span className="text-2xl font-black text-red-500">102 <span className="text-sm text-red-400/60 font-bold">dB</span></span>
            </div>
            <div className="p-6 bg-black/40 rounded-3xl border border-white/5 text-center group hover:border-brand-primary/20 transition-all">
                <span className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] block mb-2">Fundo (Galeria)</span>
                <span className="text-2xl font-black text-white">88 <span className="text-sm text-text-muted font-bold">dB</span></span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SplHeatmap;
