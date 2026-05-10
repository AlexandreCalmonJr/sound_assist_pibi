import React, { useState } from 'react';
import { useSocket } from '../hooks/useSocket';

const VoicePresets = () => {
  const { emit } = useSocket();
  const [selectedChannel, setSelectedChannel] = useState(1);
  const [applying, setApplying] = useState(null);

  const presets = [
    { id: 'baritone', icon: '🎤', title: 'Voz Barítono', desc: 'Realça o corpo e retira sibilâncias. HPF em 120Hz.', opts: { hpf: 120, low: -2 } },
    { id: 'soprano', icon: '✨', title: 'Voz Soprano', desc: 'Clareza nas altas e controle de picos. HPF em 150Hz.', opts: { hpf: 150, high: 2 } },
    { id: 'preacher', icon: '📢', title: 'Modo Pregador', desc: 'Compressão agressiva e AFS ativo para máxima clareza.', opts: { compressor: 'aggressive', afs: true }, highlight: true },
    { id: 'background', icon: '👥', title: 'Backing Vocals', desc: 'Corte de médios-graves para abrir espaço no mix.', opts: { mid: -3, q: 0.7 } }
  ];

  const applyPreset = (preset) => {
    setApplying(preset.id);
    emit('apply_voice_preset', { channel: selectedChannel, ...preset.opts });
    
    setTimeout(() => {
        setApplying(null);
    }, 2000);
  };

  return (
    <div className="page-enter space-y-10">
      <header className="mb-12">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-brand-primary/10 border border-brand-primary/20 rounded-3xl text-3xl shadow-xl shadow-brand-primary/5">🎙️</div>
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter">Presets de Voz IA</h2>
            <p className="text-text-muted font-medium text-lg">Otimização instantânea para timbres específicos</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl space-y-8">
        <div className="bg-surface-elevated/20 border border-white/5 rounded-3xl p-8 shadow-2xl flex items-center justify-between gap-8">
            <div>
                <h4 className="text-sm font-bold text-text-primary mb-1">Selecione o Canal Alvo</h4>
                <p className="text-[10px] text-text-muted uppercase font-black tracking-widest">O preset será aplicado aos filtros deste canal</p>
            </div>
            <select 
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(parseInt(e.target.value))}
                className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-brand-primary/40 transition-all min-w-[200px]"
            >
                {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i+1} value={i+1} className="bg-surface-3">Canal {String(i+1).padStart(2, '0')}</option>
                ))}
            </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {presets.map(preset => (
                <div 
                    key={preset.id} 
                    className={`p-8 rounded-[32px] border transition-all duration-300 flex flex-col justify-between h-64 shadow-xl ${
                        preset.highlight 
                        ? 'bg-brand-primary/5 border-brand-primary/20 hover:bg-brand-primary/10' 
                        : 'bg-surface-elevated/20 border-white/5 hover:bg-white/5'
                    }`}
                >
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-3xl">{preset.icon}</span>
                            {preset.highlight && <span className="px-2 py-1 bg-brand-primary text-white text-[8px] font-black rounded-md uppercase tracking-widest">Recomendado</span>}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-text-primary">{preset.title}</h3>
                            <p className="text-xs text-text-secondary mt-2 leading-relaxed">{preset.desc}</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => applyPreset(preset)}
                        className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg ${
                            applying === preset.id 
                            ? 'bg-green-500 text-white shadow-green-500/20' 
                            : 'bg-white/5 hover:bg-white/10 text-white border border-white/5'
                        }`}
                    >
                        {applying === preset.id ? 'Aplicado ✓' : 'Aplicar ao Canal'}
                    </button>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default VoicePresets;
