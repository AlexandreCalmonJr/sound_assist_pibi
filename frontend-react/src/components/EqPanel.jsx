import React, { useState } from 'react';
import { useSocket } from '../hooks/useSocket';

const EqPanel = () => {
  const { emit } = useSocket();
  const [target, setTarget] = useState('master');
  const [channel, setChannel] = useState(1);
  const [hz, setHz] = useState(1000);
  const [gain, setGain] = useState(-6);

  const handleApplyCut = () => {
    emit('apply_eq_cut', {
      target,
      channel: target === 'channel' ? channel : undefined,
      hz: parseFloat(hz),
      gain: parseFloat(gain),
      q: 2.0,
      band: 3
    });
  };

  const quickFreqs = [60, 100, 250, 500, 1000, 2500, 5000, 10000];

  return (
    <div className="bg-surface-elevated/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5h10"/><path d="M11 9h10"/><path d="M11 13h10"/><path d="M11 17h10"/><path d="M11 21h10"/><path d="M3 5h4v16H3z"/></svg>
            Equalização Cirúrgica
        </h3>
        <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
            <button 
                onClick={() => setTarget('master')}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${target === 'master' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-text-secondary hover:text-text-primary'}`}
            >
                Master
            </button>
            <button 
                onClick={() => setTarget('channel')}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${target === 'channel' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-text-secondary hover:text-text-primary'}`}
            >
                Canal
            </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
            <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">Frequência (Hz)</label>
            <div className="relative">
                <input 
                    type="number" 
                    value={hz}
                    onChange={(e) => setHz(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-2xl font-mono font-bold text-brand-primary focus:outline-none focus:border-brand-primary/50 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary font-mono text-sm">Hz</span>
            </div>
            
            <div className="grid grid-cols-4 gap-1.5">
                {quickFreqs.map(f => (
                    <button 
                        key={f} 
                        onClick={() => setHz(f)}
                        className={`py-1.5 rounded-md text-[9px] font-mono transition-all border ${hz === f ? 'bg-brand-primary/20 border-brand-primary text-brand-primary' : 'bg-white/5 border-transparent text-text-secondary hover:border-white/10'}`}
                    >
                        {f < 1000 ? f : (f/1000).toFixed(1) + 'k'}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex flex-col gap-4">
            <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">Ganho (dB)</label>
            <div className="relative">
                <input 
                    type="range" 
                    min="-24" 
                    max="12" 
                    step="0.5"
                    value={gain}
                    onChange={(e) => setGain(e.target.value)}
                    className="w-full h-1.5 bg-black/40 rounded-full appearance-none cursor-pointer accent-brand-primary"
                />
                <div className="flex justify-between mt-2 text-[10px] font-mono text-text-secondary">
                    <span>-24dB</span>
                    <span className="text-brand-primary font-bold">{gain}dB</span>
                    <span>+12dB</span>
                </div>
            </div>

            {target === 'channel' && (
                <div className="mt-2">
                    <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest mb-2 block">Selecione o Canal</label>
                    <select 
                        value={channel}
                        onChange={(e) => setChannel(parseInt(e.target.value))}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-text-primary focus:outline-none focus:border-brand-primary/50"
                    >
                        {Array.from({ length: 24 }).map((_, i) => (
                            <option key={i+1} value={i+1}>Canal {i+1}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
      </div>

      <button 
        onClick={handleApplyCut}
        className="w-full py-4 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-2xl font-bold uppercase tracking-[0.2em] shadow-xl shadow-brand-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
      >
        Aplicar Filtro
      </button>
    </div>
  );
};

export default EqPanel;
