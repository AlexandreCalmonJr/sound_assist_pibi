import React, { useState } from 'react';
import Fader from './Fader';
import { useSocket } from '../hooks/useSocket';

const AuxStrip = ({ index, name: initialName, initialLevel = 70, initialMute = false }) => {
  const { emit } = useSocket();
  const [name, setName] = useState(initialName || `AUX ${index}`);
  const [level, setLevel] = useState(initialLevel);
  const [isMuted, setIsMuted] = useState(initialMute);
  const [delay, setDelay] = useState(0);

  const handleLevelChange = (val) => {
    setLevel(val);
    emit('mixer_command', `SETD|a|${index - 1}|mix|${val / 100}`);
  };

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    emit('mixer_command', `SETD|a|${index - 1}|mute|${newState ? 1 : 0}`);
  };

  const handleNameBlur = () => {
    // Aqui poderíamos emitir um evento para salvar o nome no banco
    emit('save_name', { type: 'aux', id: index, name });
  };

  return (
    <div className="bg-surface-2 border border-white/5 rounded-3xl p-6 flex flex-col gap-6 min-w-[280px] flex-shrink-0 group hover:border-brand-primary/20 transition-all shadow-xl">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                className="bg-transparent text-sm font-black uppercase tracking-widest text-brand-primary focus:outline-none focus:text-white transition-colors w-40"
            />
            <span className="px-2 py-1 bg-green-500/10 text-green-400 text-[8px] font-black rounded-md border border-green-500/20 uppercase tracking-tighter">Post-Fader</span>
        </div>

        <div className="flex-1 flex flex-col gap-4 items-center justify-between bg-black/20 rounded-2xl p-4 border border-white/5 shadow-inner">
            <div className="flex flex-col gap-2 w-full items-center">
                <span className="text-[9px] text-text-muted uppercase font-black tracking-widest">Nível Envio</span>
                <div className="h-40">
                    <Fader value={level} onChange={handleLevelChange} />
                </div>
            </div>

            <div className="w-full space-y-4">
                <div className="flex flex-col gap-2 w-full">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-[8px] text-text-muted uppercase font-black">Delay</span>
                        <span className="text-[9px] text-brand-primary font-bold">{delay}ms</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" max="500" 
                        value={delay} 
                        onChange={(e) => setDelay(e.target.value)}
                        className="w-full accent-brand-primary cursor-pointer h-1.5 bg-white/5 rounded-full appearance-none"
                    />
                </div>
                
                <button 
                    onClick={toggleMute}
                    className={`w-full py-3 text-[9px] font-black rounded-xl border transition-all active:scale-95 uppercase tracking-widest ${
                        isMuted 
                        ? 'bg-red-500/20 text-red-500 border-red-500/20' 
                        : 'bg-white/5 text-text-muted border-white/5 hover:bg-white/10 hover:text-white'
                    }`}
                >
                    {isMuted ? 'MUTADO' : 'Mute Auxiliar'}
                </button>
            </div>
        </div>
    </div>
  );
};

export default AuxStrip;
