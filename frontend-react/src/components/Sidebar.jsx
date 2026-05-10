import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const CATEGORIES = {
    measure: {
        title: 'Medir',
        icon: '📊',
        items: [
            { id: 'rt60', label: 'RT60 & Acústica' },
            { id: 'benchmarking', label: 'Benchmarking' },
            { id: 'spl-heatmap', label: 'Mapa de Calor SPL' },
        ]
    },
    analysis: {
        title: 'Análise do Som',
        icon: '📈',
        items: [
            { id: 'analyzer', label: 'FFT & Waterfall' },
            { id: 'feedback-detector', label: 'Detector Feedback' },
            { id: 'eq-guide', label: 'Guia de EQ' },
        ]
    },
    ai: {
        title: 'Inteligência',
        icon: '🤖',
        items: [
            { id: 'ai-chat', label: 'Assistente IA' },
            { id: 'voice-presets', label: 'Presets de Voz IA' },
        ]
    },
    mixer: {
        title: 'Mixer',
        icon: '🎚️',
        items: [
            { id: 'mixer-input', label: 'Canais de Entrada' },
            { id: 'mixer-aux', label: 'Monitores & Aux' },
            { id: 'mixer-fx', label: 'Envios de Efeito' },
            { id: 'voice-presets', label: 'Presets de Voz IA' },
        ]
    },
    network: {
        title: 'Rede & Sistemas',
        icon: '🌐',
        items: [
            { id: 'systems', label: 'Conexão Ui24R' },
            { id: 'mobile', label: 'Conectar Mobile' },
            { id: 'aes67', label: 'Saúde de Cabos (AES67)' },
        ]
    },
    settings: {
        title: 'Configurações',
        icon: '⚙️',
        items: [
            { id: 'settings', label: 'Preferências' },
        ]
    },
    support: {
        title: 'Suporte',
        icon: '🎓',
        items: [
            { id: 'tutorials', label: 'Centro de Treino' },
        ]
    }
};

const Sidebar = ({ isOpen, togglePanel }) => {
  const [activeCategory, setActiveCategory] = useState('mixer');
  const navigate = useNavigate();
  const location = useLocation();

  const handleRailClick = (catId) => {
    setActiveCategory(catId);
    if (!isOpen) togglePanel();
  };

  const handleItemClick = (itemId) => {
    navigate(`/${itemId}`);
  };

  const isActive = (itemId) => location.pathname === `/${itemId}`;

  return (
    <div className="flex h-full flex-shrink-0 z-30">
      {/* Icon Rail */}
      <aside className="w-[var(--rail-width)] bg-surface-3 flex flex-col items-center py-5 justify-between rounded-r-[24px] shadow-[4px_0_24px_rgba(0,0,0,0.4)] z-30 relative">
        <div className="flex flex-col items-center w-full">
          <button 
            onClick={() => navigate('/')}
            className="w-[42px] h-[42px] bg-gradient-to-br from-brand-primary to-brand-secondary rounded-[14px] flex items-center justify-center text-white font-normal text-lg mb-6 shadow-[0_4px_20px_rgba(6,182,212,0.3)] tracking-tighter"
          >
            S
          </button>
          
          <nav className="flex flex-col items-center gap-1 w-full">
            {Object.keys(CATEGORIES).map(catId => (
              <button
                key={catId}
                onClick={() => handleRailClick(catId)}
                className={`group relative w-12 h-12 flex items-center justify-center rounded-[14px] transition-all duration-200 ${
                  activeCategory === catId ? 'bg-white/10 text-white' : 'text-text-muted hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-xl">{CATEGORIES[catId].icon}</span>
                {activeCategory === catId && (
                  <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-1 h-7 bg-brand-primary rounded-r-md shadow-[0_0_12px_rgba(34,211,238,0.3)]"></div>
                )}
                
                {!isOpen && (
                  <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 bg-surface-3 text-white px-3 py-1.5 rounded-lg text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl z-50">
                    {CATEGORIES[catId].title}
                  </div>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={() => navigate('/settings')}
            className={`w-12 h-12 flex items-center justify-center rounded-[14px] transition-all ${
                location.pathname === '/settings' ? 'bg-white/10 text-white' : 'text-text-muted hover:bg-white/5 hover:text-white'
            }`}
          >
            👤
          </button>
        </div>
      </aside>

      {/* Category Panel */}
      <div 
        className={`bg-surface-2 border-r border-white/5 flex flex-col transition-all duration-300 overflow-hidden z-20 ${
          isOpen ? 'w-[var(--panel-width)]' : 'w-0'
        }`}
      >
        <div className={`p-6 pt-6 pb-4 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
          <h5 className="text-[11px] font-normal uppercase tracking-[0.1em] text-text-muted">
            {CATEGORIES[activeCategory]?.title}
          </h5>
        </div>

        <nav className={`flex-1 px-3 flex flex-col gap-0.5 overflow-y-auto scrollbar-none transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
          {CATEGORIES[activeCategory]?.items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-xs transition-all text-left relative ${
                isActive(item.id) ? 'text-brand-primary bg-brand-primary/10' : 'text-text-secondary hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isActive(item.id) ? 'bg-brand-primary shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-current opacity-40'}`}></div>
              {item.label}
              {isActive(item.id) && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[55%] bg-brand-primary rounded-r-sm"></div>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
