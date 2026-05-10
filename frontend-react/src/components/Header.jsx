import React from 'react';

const Header = ({ onToggleSidebar, onToggleMixer, sidebarOpen, mixerOpen }) => {
  return (
    <header className="h-[var(--header-height)] flex items-center justify-between px-6 border-b border-white/5 bg-surface-0/85 backdrop-blur-xl z-20 flex-shrink-0">
      <div className="flex items-center gap-4">
        <button 
            onClick={onToggleSidebar}
            className={`w-9 h-9 flex items-center justify-center rounded-xl border border-white/5 transition-all ${
                sidebarOpen ? 'bg-brand-primary/20 text-brand-primary border-brand-primary/20' : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'
            }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-normal uppercase tracking-[0.08em] text-text-muted">Mixer</span>
          <span className="text-text-muted text-[10px]">›</span>
          <span className="text-[11px] font-normal uppercase tracking-[0.08em] text-text-primary">Console</span>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-black/40 rounded-full border border-white/5 hover:bg-white/5 transition-all cursor-pointer">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
          <span className="text-[10px] font-normal uppercase text-text-muted">Mic Online</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-text-secondary hover:bg-white/10 hover:text-white transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        </button>
        
        <button 
            onClick={onToggleMixer}
            className={`flex items-center gap-2 px-4 h-9 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-widest ${
                mixerOpen 
                    ? 'bg-brand-primary/15 border-brand-primary/20 text-brand-primary' 
                    : 'bg-white/5 border-white/5 text-text-secondary hover:bg-white/10 hover:text-white'
            }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/></svg>
          Mixer
        </button>
      </div>
    </header>
  );
};

export default Header;
