import React from 'react';
import ChannelStrip from '../components/ChannelStrip';
import { useSocket } from '../hooks/useSocket';

const MixerConsole = () => {
  const { mixerStatus, emit } = useSocket();

  const handleConnectSimulated = () => {
    emit('connect_mixer', 'simulado');
  };

  return (
    <div className="page-enter h-full flex flex-col">
      <div className="flex items-center justify-between mb-10 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Canais de Entrada</h2>
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">{mixerStatus.msg}</p>
            {!mixerStatus.connected && (
                <button 
                    onClick={handleConnectSimulated}
                    className="text-[9px] font-bold uppercase tracking-widest text-brand-primary hover:underline"
                >
                    Ativar Modo Simulado
                </button>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 bg-surface-elevated/50 hover:bg-white/5 rounded-xl border border-white/5 transition-all text-[10px] font-bold uppercase tracking-widest">
            Presets
          </button>
          <button className="px-5 py-2.5 bg-brand-primary hover:brightness-110 text-white rounded-xl transition-all text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-brand-primary/20">
            Snapshots
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24].map((i) => (
          <ChannelStrip key={i} channel={i} />
        ))}
        <div className="min-w-[80px]"></div>
      </div>
    </div>
  );
};

export default MixerConsole;
