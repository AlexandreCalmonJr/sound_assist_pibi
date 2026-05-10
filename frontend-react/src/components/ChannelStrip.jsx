import React, { useState } from 'react';
import Fader from './Fader';

const ChannelStrip = ({ channel, name }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [level, setLevel] = useState(0);

  return (
    <div className="bg-surface-elevated/30 border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-4 group hover:border-brand-primary/20 transition-all duration-300">
      <div className="flex justify-between w-full items-center mb-2 px-1">
        <span className="text-[10px] font-bold text-text-secondary bg-black/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
            Ch {channel}
        </span>
        <div className={`w-1.5 h-1.5 rounded-full ${level > 0 ? 'bg-green-400 shadow-[0_0_5px_green]' : 'bg-white/10'}`}></div>
      </div>

      <Fader 
        label={name || `INPUT ${channel}`} 
        value={level} 
        onChange={setLevel} 
      />

      <div className="flex gap-2 w-full mt-2">
        <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${
                isMuted 
                    ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                    : 'bg-white/5 text-text-secondary hover:bg-white/10'
            }`}
        >
          MUTE
        </button>
      </div>
    </div>
  );
};

export default ChannelStrip;
