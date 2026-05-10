import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ChannelStrip from '../components/ChannelStrip';
import AuxStrip from '../components/AuxStrip';
import FxStrip from '../components/FxStrip';
import { useSocket } from '../hooks/useSocket';

const MixerPage = () => {
  const { mixerStatus, emit } = useSocket();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('input');

  useEffect(() => {
    if (location.pathname.includes('aux')) setActiveTab('aux');
    else if (location.pathname.includes('fx')) setActiveTab('fx');
    else setActiveTab('input');
  }, [location.pathname]);

  const tabs = [
    { id: 'input', label: 'Canais de Entrada', icon: '🎚️' },
    { id: 'aux', label: 'Monitores (AUX)', icon: '🎧' },
    { id: 'fx', label: 'Efeitos (FX)', icon: '✨' },
  ];

  const handleConnectSimulated = () => {
    emit('connect_mixer', 'simulado');
  };

  return (
    <div className="page-enter h-full flex flex-col">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Console Pro</h2>
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

        {/* Tabs */}
        <div className="flex bg-surface-elevated/30 p-1.5 rounded-2xl border border-white/5 self-start">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                        activeTab === tab.id 
                        ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                        : 'text-text-muted hover:text-white hover:bg-white/5'
                    }`}
                >
                    <span className="text-sm">{tab.icon}</span>
                    {tab.label}
                </button>
            ))}
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {activeTab === 'input' && [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24].map((i) => (
          <ChannelStrip key={i} channel={i} />
        ))}

        {activeTab === 'aux' && [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <AuxStrip key={i} index={i} />
        ))}

        {activeTab === 'fx' && [
            { id: 1, type: 'Hall Reverb' },
            { id: 2, type: 'Room Reverb' },
            { id: 3, type: 'Digital Delay' },
            { id: 4, type: 'Chorus' }
        ].map((fx) => (
          <FxStrip key={fx.id} index={fx.id} type={fx.type} />
        ))}
        
        <div className="min-w-[80px]"></div>
      </div>
    </div>
  );
};

export default MixerPage;
