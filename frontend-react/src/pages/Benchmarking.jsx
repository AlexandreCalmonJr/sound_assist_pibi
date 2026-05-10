import React, { useState } from 'react';

const Benchmarking = () => {
  const [history, setHistory] = useState([
    { id: 1, title: 'Culto de Domingo', date: '04/05/2026 • 19:30', rt60: '1.42s', type: 'Cheio' },
    { id: 2, title: 'Ensaio de Sábado', date: '03/05/2026 • 15:00', rt60: '1.78s', type: 'Vazio' },
    { id: 3, title: 'Conferência Jovens', date: '01/05/2026 • 20:00', rt60: '1.35s', type: 'Cheio' },
  ]);

  return (
    <div className="page-enter space-y-10">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-cyan-900/40 border border-cyan-500/20 rounded-3xl text-3xl shadow-xl shadow-cyan-500/5">⚖️</div>
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter">Benchmarking</h2>
            <p className="text-text-muted font-medium text-lg">Compare o desempenho acústico histórico</p>
          </div>
        </div>
        <button className="px-8 py-3.5 bg-brand-primary hover:brightness-110 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-primary/20 flex items-center gap-2">
            <span>🔄</span> Atualizar Histórico
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Gráfico de Comparação */}
        <div className="bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 shadow-2xl space-y-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted">Curva de Decaimento (RT60)</h3>
            <div className="h-64 bg-black/40 rounded-3xl relative flex items-end p-8 gap-4 border border-white/5 shadow-inner">
                {/* Barras Comparativas */}
                <div className="flex-1 bg-cyan-500/50 rounded-t-2xl h-[90%] relative group hover:bg-cyan-500/70 transition-all">
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] text-cyan-400 font-black whitespace-nowrap">VAZIO: 1.82s</span>
                </div>
                <div className="flex-1 bg-green-500/50 rounded-t-2xl h-[65%] relative group hover:bg-green-500/70 transition-all">
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] text-green-400 font-black whitespace-nowrap">CHEIO: 1.45s</span>
                </div>
                <div className="flex-1 bg-white/10 rounded-t-2xl h-[40%] relative group opacity-50 italic">
                     <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] text-text-muted font-black whitespace-nowrap uppercase">Ideal: 1.2s</span>
                </div>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed italic text-center px-10">
                "O público presente ajuda a absorver frequências médias e agudas, reduzindo o tempo de reverberação naturalmente."
            </p>
        </div>

        {/* Snapshots Salvos */}
        <div className="bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 shadow-2xl flex flex-col">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted mb-10">Snapshots de Medição</h3>
            <div className="space-y-4 flex-1">
                {history.map(item => (
                    <div key={item.id} className="p-6 bg-black/40 rounded-3xl border border-white/5 flex items-center justify-between hover:bg-white/5 transition-all cursor-pointer group">
                        <div className="flex items-center gap-5">
                            <div className={`w-3 h-3 rounded-full ${item.type === 'Cheio' ? 'bg-green-500' : 'bg-cyan-500'}`}></div>
                            <div>
                                <span className="text-sm font-bold text-text-primary block group-hover:text-brand-primary transition-colors">{item.title}</span>
                                <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest">{item.date}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <span className="text-xs font-black text-brand-primary font-mono">{item.rt60}</span>
                            <button className="text-xl opacity-0 group-hover:opacity-100 transition-opacity">➡️</button>
                        </div>
                    </div>
                ))}
            </div>
            <button className="mt-10 w-full py-4 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest border border-white/5">
                Exportar Relatório PDF
            </button>
        </div>
      </div>
    </div>
  );
};

export default Benchmarking;
