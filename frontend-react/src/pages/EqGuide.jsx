import React, { useState } from 'react';

const EqGuide = () => {
  const [instrument, setInstrument] = useState('bumbo');

  const instruments = {
    bumbo: { title: '🥁 Bumbo (Kick)', data: [
        { label: 'Peso/Corpo', range: '60 - 80 Hz' },
        { label: 'Clareza/Ataque', range: '3 - 5 kHz' },
        { label: 'Remover (Boxy)', range: '300 - 400 Hz', bad: true }
    ]},
    violao: { title: '🎸 Violão', data: [
        { label: 'Corpo', range: '80 - 120 Hz' },
        { label: 'Brilho', range: '5 - 10 kHz' },
        { label: 'Ressonância', range: '200 - 400 Hz', bad: true }
    ]},
    baixo: { title: '🎸 Baixo', data: [
        { label: 'Fundamento', range: '40 - 80 Hz' },
        { label: 'Definição', range: '800 - 1.2 kHz' },
        { label: 'Ruído Dedo', range: '2 - 4 kHz' }
    ]},
    voz: { title: '🎙️ Voz (Lead)', data: [
        { label: 'Corpo', range: '150 - 250 Hz' },
        { label: 'Inteligibilidade', range: '2 - 5 kHz' },
        { label: 'Aritculação/Ar', range: '8 - 12 kHz' }
    ]},
    teclado: { title: '🎹 Teclado/Piano', data: [
        { label: 'Presença', range: '2 - 5 kHz' },
        { label: 'Corte Graves', range: '< 100 Hz', bad: true }
    ]}
  };

  return (
    <div className="page-enter space-y-10">
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-indigo-900/40 border border-indigo-500/20 rounded-3xl text-3xl shadow-xl shadow-indigo-500/5">🎚️</div>
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter">Guia de Equalização</h2>
            <p className="text-text-muted font-medium text-lg">Melhores práticas e tabelas de frequências</p>
          </div>
        </div>

        <div className="flex items-center gap-6 bg-surface-elevated/30 p-2 rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex flex-col px-4">
                <span className="text-[9px] uppercase font-black text-text-muted mb-1 tracking-widest">Instrumento:</span>
                <select 
                    value={instrument}
                    onChange={(e) => setInstrument(e.target.value)}
                    className="bg-transparent text-white font-black text-sm outline-none cursor-pointer"
                >
                    <option value="bumbo" className="bg-surface-3">🥁 Bumbo (Kick)</option>
                    <option value="violao" className="bg-surface-3">🎸 Violão</option>
                    <option value="baixo" className="bg-surface-3">🎸 Baixo</option>
                    <option value="voz" className="bg-surface-3">🎙️ Voz</option>
                    <option value="teclado" className="bg-surface-3">🎹 Teclado</option>
                </select>
            </div>
            <button className="px-6 py-3 bg-brand-primary hover:brightness-110 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-primary/20">
                🚀 Aplicar via IA
            </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Card Dinâmico */}
        <div className="bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 shadow-2xl flex flex-col justify-center min-h-[300px] animate-in fade-in zoom-in-95">
            <h3 className="text-3xl font-black text-white mb-10 flex items-center gap-4">
                {instruments[instrument].title}
            </h3>
            <div className="space-y-6">
                {instruments[instrument].data.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-6 bg-black/40 rounded-3xl border border-white/5 group hover:border-brand-primary/20 transition-all">
                        <span className={`text-xs font-bold uppercase tracking-widest ${item.bad ? 'text-red-400' : 'text-text-muted group-hover:text-text-primary'}`}>
                            {item.label}
                        </span>
                        <span className={`text-sm font-black font-mono ${item.bad ? 'text-red-500' : 'text-brand-primary'}`}>
                            {item.range}
                        </span>
                    </div>
                ))}
            </div>
        </div>

        {/* Grid de Referência Rápida */}
        <div className="grid grid-cols-2 gap-6">
            {Object.keys(instruments).filter(k => k !== instrument).slice(0, 4).map(k => (
                <div key={k} className="p-8 bg-surface-elevated/10 border border-white/5 rounded-[32px] hover:bg-white/5 transition-all cursor-pointer group" onClick={() => setInstrument(k)}>
                    <h4 className="text-lg font-bold text-text-muted group-hover:text-white transition-colors mb-4">{instruments[k].title}</h4>
                    <div className="space-y-2 opacity-40 group-hover:opacity-80 transition-opacity">
                        <div className="h-1 bg-white/10 rounded-full w-full"></div>
                        <div className="h-1 bg-white/10 rounded-full w-2/3"></div>
                    </div>
                </div>
            ))}
        </div>
      </div>

      <div className="p-10 bg-brand-primary/5 border border-brand-primary/10 rounded-[40px] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl group-hover:scale-110 transition-transform">💡</div>
        <h4 className="text-sm font-black text-white uppercase mb-4 tracking-[0.2em] relative z-10">Dica da IA Pro</h4>
        <p className="text-sm text-text-secondary leading-relaxed italic relative z-10 max-w-2xl">
            "Sempre tente <b>cortar</b> frequências indesejadas antes de tentar dar ganho em outras. Isso mantém o headroom do sistema e evita que o som soe 'artificial' ou congestionado."
        </p>
      </div>
    </div>
  );
};

export default EqGuide;
