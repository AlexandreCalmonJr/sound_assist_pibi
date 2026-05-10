import React, { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import AcousticMap from '../components/AcousticMap';

const Rt60Acoustics = () => {
  const { emit } = useSocket();
  const [dimensions, setDimensions] = useState({ length: 20, width: 10, height: 5 });
  const [delayDist, setDelayDist] = useState(10);
  const [absorption, setAbsorption] = useState(0.15);
  const [result, setResult] = useState(null);
  const [isMeasuring, setIsMeasuring] = useState(false);

  const calculateRt60 = () => {
    const { length, width, height } = dimensions;
    const volume = length * width * height;
    const surfaceArea = (2 * length * width) + (2 * length * height) + (2 * width * height);
    const totalAbsorption = surfaceArea * absorption;
    
    const rt60 = totalAbsorption > 0 ? 0.161 * (volume / totalAbsorption) : 0;
    const delayMs = (delayDist / 343) * 1000;

    let status = 'safe';
    let text = 'Ideal para fala / Palavra';
    let suggestion = 'A acústica está seca e favorece a pregação. Cenário seguro para inteligibilidade.';

    if (rt60 >= 1.6) {
      status = 'danger';
      text = 'Reverberação Excessiva';
      suggestion = 'O som pode embolar. Reduza o volume geral, controle graves e adicione materiais absorventes.';
    } else if (rt60 >= 1.0) {
      status = 'warning';
      text = 'Aceitável para Culto Contemporâneo';
      suggestion = 'Bom balanço para louvor, mas a fala exige articulação clara e controle de volume.';
    }

    setResult({ rt60, delayMs, status, text, suggestion, volume });
  };

  const triggerPulse = () => {
    setIsMeasuring(true);
    emit('mixer_command', { type: 'oscillator', enabled: true, level: -10 });
    setTimeout(() => {
        emit('mixer_command', { type: 'oscillator', enabled: false, level: -10 });
        setIsMeasuring(false);
    }, 200);
  };

  return (
    <div className="page-enter space-y-10">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-cyan-900/40 border border-cyan-500/20 rounded-3xl text-3xl shadow-xl shadow-cyan-500/5">📐</div>
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter">Acústica & RT60</h2>
            <p className="text-text-muted font-medium text-lg">Análise de decaimento e inteligibilidade (STI)</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-amber-500/5 border border-amber-500/10 px-6 py-3 rounded-2xl max-w-sm">
          <span className="text-2xl">💡</span>
          <p className="text-[10px] text-amber-200/70 font-bold leading-tight">
            Para igrejas, busque um RT60 entre <b>1.4s e 1.6s</b>. <br /> Valores muito altos (reverb longo) prejudicam a pregação.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Controles de Medição */}
        <div className="bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 shadow-2xl space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted">Medição de Precisão</h3>
            
            <div className="grid grid-cols-1 gap-6">
                <button 
                    onClick={triggerPulse}
                    disabled={isMeasuring}
                    className={`py-6 rounded-[28px] text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-4 shadow-2xl ${
                        isMeasuring ? 'bg-amber-600/20 text-amber-400 animate-pulse' : 'bg-brand-primary text-white hover:brightness-110 shadow-brand-primary/20'
                    }`}
                >
                    <span className="text-2xl">{isMeasuring ? '📡' : '🔊'}</span>
                    {isMeasuring ? 'Capturando Decaimento...' : 'Disparar Pulso de Medição'}
                </button>

                <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-3">
                        <label className="text-[9px] uppercase font-black text-text-muted ml-2">Comp. (m)</label>
                        <input 
                            type="number" 
                            value={dimensions.length}
                            onChange={(e) => setDimensions({...dimensions, length: parseFloat(e.target.value)})}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-brand-primary outline-none transition-all"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[9px] uppercase font-black text-text-muted ml-2">Larg. (m)</label>
                        <input 
                            type="number" 
                            value={dimensions.width}
                            onChange={(e) => setDimensions({...dimensions, width: parseFloat(e.target.value)})}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-brand-primary outline-none transition-all"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[9px] uppercase font-black text-text-muted ml-2">Alt. (m)</label>
                        <input 
                            type="number" 
                            value={dimensions.height}
                            onChange={(e) => setDimensions({...dimensions, height: parseFloat(e.target.value)})}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-brand-primary outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[9px] uppercase font-black text-text-muted ml-2">Nível de Absorção Estimado</label>
                    <select 
                        value={absorption}
                        onChange={(e) => setAbsorption(parseFloat(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-brand-primary outline-none transition-all appearance-none cursor-pointer"
                    >
                        <option value="0.05">Baixa (Piso liso, muito vidro, paredes nuas)</option>
                        <option value="0.15">Média (Cadeiras estofadas, pessoas, cortinas)</option>
                        <option value="0.30">Alta (Carpete, forro acústico, cortinas grossas)</option>
                    </select>
                </div>

                <button 
                    onClick={calculateRt60}
                    className="w-full py-5 bg-white/5 hover:bg-white/10 text-white rounded-[24px] font-black uppercase tracking-widest text-[10px] transition-all border border-white/5 shadow-xl"
                >
                    Calcular Acústica (Sabine/Eyring)
                </button>
            </div>
        </div>

        {/* Resultados & Mapa */}
        <div className="space-y-8">
            {result && (
                <div className={`p-8 rounded-[40px] border animate-in slide-in-from-bottom-4 shadow-2xl ${
                    result.status === 'danger' ? 'bg-red-600/10 border-red-500/20' : (result.status === 'warning' ? 'bg-amber-600/10 border-amber-500/20' : 'bg-green-600/10 border-green-500/20')
                }`}>
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Volume: {result.volume}m³</span>
                            <h3 className="text-4xl font-black text-white mt-1">RT60: {result.rt60.toFixed(2)}s</h3>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            result.status === 'danger' ? 'bg-red-500 text-white' : (result.status === 'warning' ? 'bg-amber-500 text-white' : 'bg-green-500 text-white')
                        }`}>
                            {result.text}
                        </span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed font-medium mb-6">{result.suggestion}</p>
                    
                    {delayDist > 0 && (
                        <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-brand-primary">Sincronia de Delay</span>
                                <p className="text-sm font-bold text-white mt-1">Ajuste na Ui24R:</p>
                            </div>
                            <span className="text-3xl font-black text-brand-primary font-mono tracking-tighter">{(delayDist / 343 * 1000).toFixed(1)}ms</span>
                        </div>
                    )}
                </div>
            )}

            <div className="bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 shadow-2xl">
                <h3 className="text-lg font-black text-white mb-2">Mapa Visual de Cobertura</h3>
                <p className="text-xs text-text-muted mb-8">Clique no mapa para registrar pontos de análise.</p>
                <div className="rounded-[32px] overflow-hidden border border-white/5 shadow-inner">
                    <AcousticMap />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Rt60Acoustics;
