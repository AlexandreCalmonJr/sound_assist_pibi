import React, { useState } from 'react';
import Fader from './Fader';
import { useSocket } from '../hooks/useSocket';

const FxStrip = ({ index, type }) => {
  const { emit } = useSocket();
  const [level, setLevel] = useState(50);

  const handleLevelChange = (val) => {
    setLevel(val);
    emit('mixer_command', `SETD|f|${index - 1}|mix|${val / 100}`);
  };

  return (
    <div className="bg-surface-2 border border-white/5 rounded-3xl p-6 flex flex-col gap-6 group hover:border-brand-primary/20 transition-all shadow-xl">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Engine FX {index}</span>
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">{type}</span>
        </div>

        <div className="flex-1 flex flex-col gap-6 items-center justify-center bg-black/20 rounded-2xl p-6 border border-white/5 shadow-inner">
            <div className="h-64">
                <Fader value={level} onChange={handleLevelChange} />
            </div>

            <div className="text-center">
                <span className="text-3xl font-black text-text-primary tracking-tighter">{level}</span>
                <span className="text-xs text-text-muted ml-1.5 uppercase font-bold">%</span>
            </div>
        </div>

        <div className="flex gap-2">
            <button className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-[9px] font-bold text-text-muted hover:text-white rounded-xl border border-white/5 transition-all uppercase tracking-widest">Edit</button>
            <button className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-[9px] font-bold text-text-muted hover:text-white rounded-xl border border-white/5 transition-all uppercase tracking-widest">Mute</button>
        </div>
    </div>
  );
};

export default FxStrip;
