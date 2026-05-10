import React, { useState } from 'react';
import AcousticMap from '../components/AcousticMap';

const Acoustics = () => {
  const [dimensions, setDimensions] = useState({ length: 20, width: 10, height: 5 });
  const [absorption, setAbsorption] = useState(0.15);
  const [delayDist, setDelayDist] = useState(10);
  const [result, setResult] = useState(null);

  const calculateRT60 = () => {
    const { length, width, height } = dimensions;
    const volume = length * width * height;
    const surfaceArea = (2 * length * width) + (2 * length * height) + (2 * width * height);
    
    // Fórmula de Sabine: RT60 = 0.161 * (V / A)
    const totalAbsorption = surfaceArea * absorption;
    const rt60 = totalAbsorption > 0 ? 0.161 * (volume / totalAbsorption) : 0;
    
    const delayMs = delayDist > 0 ? (delayDist / 343) * 1000 : 0;

    let status = 'safe';
    let text = 'Ideal para fala / Palavra';
    if (rt60 >= 1.6) {
        status = 'danger';
        text = 'Reverberação Excessiva';
    } else if (rt60 >= 1.0) {
        status = 'warning';
        text = 'Aceitável p/ Louvor Contemporâneo';
    }

    setResult({ rt60, status, text, delayMs, volume });
  };

  return (
    <div className="page-enter space-y-10">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <span className="p-3 bg-surface-elevated/50 rounded-2xl text-2xl border border-white/5">📐</span>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Acústica & RT60</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">Análise de Decaimento e Cobertura</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-brand-primary/10 border border-brand-primary/20 px-5 py-3 rounded-2xl max-w-sm">
          <span className="text-lg">💡</span>
          <p className="text-[10px] text-brand-primary/80 font-bold leading-relaxed uppercase tracking-wider">
            Para igrejas, busque um RT60 entre 1.4s e 1.6s.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Calculadora e Inputs */}
        <div className="space-y-6">
          <div className="bg-surface-elevated/20 border border-white/5 rounded-3xl p-8 shadow-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-8">Parâmetros da Sala</h3>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              {['length', 'width', 'height'].map(dim => (
                <div key={dim} className="space-y-2">
                  <label className="text-[9px] uppercase font-bold text-text-muted ml-1">{dim === 'length' ? 'Comp. (m)' : dim === 'width' ? 'Larg. (m)' : 'Alt. (m)'}</label>
                  <input 
                    type="number" 
                    value={dimensions[dim]}
                    onChange={(e) => setDimensions({...dimensions, [dim]: parseFloat(e.target.value)})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:border-brand-primary/40 outline-none transition-all" 
                  />
                </div>
              ))}
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-text-muted ml-1">Distância PA até Delay (m)</label>
                <input 
                    type="number" 
                    value={delayDist}
                    onChange={(e) => setDelayDist(parseFloat(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:border-brand-primary/40 outline-none transition-all" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-text-muted ml-1">Nível de Absorção</label>
                <select 
                    value={absorption}
                    onChange={(e) => setAbsorption(parseFloat(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-xs font-bold uppercase text-white focus:border-brand-primary/40 outline-none transition-all"
                >
                    <option value="0.05">Baixa (Muito vidro, mármore)</option>
                    <option value="0.15">Média (Cadeiras estofadas, pessoas)</option>
                    <option value="0.30">Alta (Carpete, forro acústico)</option>
                </select>
              </div>

              <button 
                onClick={calculateRT60}
                className="w-full py-4 bg-brand-primary hover:brightness-110 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-primary/20 mt-4"
              >
                Gerar Relatório Acústico
              </button>
            </div>
          </div>

          {/* Resultado */}
          {result && (
            <div className={`p-8 rounded-3xl border animate-in fade-in slide-in-from-bottom-4 shadow-2xl ${
                result.status === 'danger' ? 'bg-red-500/10 border-red-500/20' : (result.status === 'warning' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-cyan-500/10 border-cyan-500/20')
            }`}>
                <div className="flex justify-between text-[9px] uppercase font-black text-text-muted mb-4 tracking-[0.2em]">
                    <span>Volume: {Math.round(result.volume)}m³</span>
                    <span>Fórmula: Sabine (PRO)</span>
                </div>
                <div className="flex items-baseline gap-3 mb-2">
                    <h3 className="text-4xl font-black text-white tracking-tighter">RT60: {result.rt60.toFixed(2)}s</h3>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${result.status === 'safe' ? 'text-cyan-400' : (result.status === 'warning' ? 'text-amber-400' : 'text-red-400')}`}>
                        • {result.text}
                    </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed mb-6">
                    A acústica do ambiente impacta diretamente na inteligibilidade da palavra. {result.status === 'danger' ? 'O som está muito reflexivo.' : 'A clareza está em níveis ótimos.'}
                </p>

                {result.delayMs > 0 && (
                    <div className="pt-6 border-t border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary mb-2 block">Delay Sugerido</span>
                        <div className="text-2xl font-black text-white">{result.delayMs.toFixed(1)} ms</div>
                    </div>
                )}
            </div>
          )}
        </div>

        {/* Mapa e Benchmarking */}
        <div className="space-y-8">
            <div className="bg-surface-elevated/20 border border-white/5 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Mapa de Cobertura</h3>
                    <span className="text-[9px] text-text-muted opacity-50 uppercase font-bold italic">Interativo 2D</span>
                </div>
                <AcousticMap width={dimensions.width} length={dimensions.length} />
            </div>

            <div className="bg-surface-elevated/10 border border-white/5 rounded-3xl p-8 space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Benchmarking (Vazio vs Cheio)</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-black/40 rounded-2xl border border-white/5 text-center">
                        <span className="text-[9px] uppercase text-text-muted font-bold block mb-2">Templo Vazio</span>
                        <div className="text-2xl font-black text-brand-primary">1.82s</div>
                    </div>
                    <div className="p-6 bg-black/40 rounded-2xl border border-white/5 text-center">
                        <span className="text-[9px] uppercase text-text-muted font-bold block mb-2">Templo Cheio</span>
                        <div className="text-2xl font-black text-green-400">1.45s</div>
                    </div>
                </div>
                <p className="text-[10px] text-text-muted italic leading-relaxed text-center">
                    Dica: O público absorve energia sonora. O RT60 diminui com a igreja cheia.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Acoustics;
