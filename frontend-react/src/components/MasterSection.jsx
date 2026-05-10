import React, { useState, useEffect } from 'react';
import Fader from './Fader';
import { useSocket } from '../hooks/useSocket';

const MasterSection = () => {
  const { socket, emit } = useSocket();
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!socket) return;

    socket.on('master_level', (newLevel) => {
      setLevel(newLevel);
    });

    return () => {
      socket.off('master_level');
    };
  }, [socket]);

  const handleLevelChange = (newVal) => {
    setLevel(newVal);
    emit('set_master_level', { level: newVal });
  };

  return (
    <div className="bg-surface-elevated/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse"></div>
        <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary">Master Out</h3>
      </div>

      <div className="flex gap-8 items-end">
        {/* Output Meter */}
        <div className="flex flex-col gap-1 h-64 w-4">
            {Array.from({ length: 20 }).map((_, i) => {
                const isActive = (1 - i / 20) <= level;
                return (
                    <div 
                        key={i} 
                        className={`flex-1 rounded-sm transition-colors duration-200 ${
                            isActive 
                                ? (i < 4 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : i < 8 ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]' : 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]') 
                                : 'bg-white/5'
                        }`}
                    ></div>
                );
            })}
        </div>

        <Fader 
            label="MASTER" 
            value={level} 
            onChange={handleLevelChange} 
            isMaster={true}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        <button className="py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-tighter transition-all">
          Mute All
        </button>
        <button className="py-3 bg-white/5 hover:bg-white/10 text-text-secondary border border-white/10 rounded-xl text-xs font-bold uppercase tracking-tighter transition-all">
          Mono
        </button>
      </div>
    </div>
  );
};

export default MasterSection;
