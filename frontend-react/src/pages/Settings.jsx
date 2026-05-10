import React, { useState } from 'react';

const Settings = () => {
  const [autoStart, setAutoStart] = useState(true);
  const [highResFFT, setHighResFFT] = useState(false);
  const [unit, setUnit] = useState('Metros (m)');

  const settingsItems = [
    {
      id: 'autostart',
      title: 'Auto-Iniciação',
      desc: 'Abrir o app e conectar à mesa automaticamente ao ligar o PC.',
      value: autoStart,
      setter: setAutoStart,
      type: 'toggle'
    },
    {
      id: 'highres',
      title: 'Modo de Alta Resolução FFT',
      desc: 'Aumenta o consumo de CPU para precisão máxima (32k bins).',
      value: highResFFT,
      setter: setHighResFFT,
      type: 'toggle'
    },
  ];

  return (
    <div className="page-enter max-w-4xl mx-auto">
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-4">
          <span className="p-3 bg-surface-elevated/50 rounded-2xl text-2xl border border-white/5">⚙️</span>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">Preferências Globais do Sistema</p>
          </div>
        </div>
      </header>

      <div className="space-y-8">
        {/* Preferências de Interface */}
        <div className="bg-surface-elevated/20 border border-white/5 rounded-3xl p-8 shadow-2xl">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-8">Interface & Performance</h3>
          
          <div className="space-y-6">
            {settingsItems.map(item => (
              <div key={item.id} className="flex items-center justify-between py-5 border-b border-white/5 last:border-0">
                <div>
                  <span className="text-sm font-bold text-text-primary block mb-1">{item.title}</span>
                  <p className="text-[10px] text-text-muted">{item.desc}</p>
                </div>
                <button 
                    onClick={() => item.setter(!item.value)}
                    className={`w-12 h-6 rounded-full relative transition-all duration-300 ${item.value ? 'bg-brand-primary' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${item.value ? 'right-1' : 'left-1'}`}></div>
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between py-5 border-t border-white/5">
                <div>
                  <span className="text-sm font-bold text-text-primary block mb-1">Unidade de Medida</span>
                  <p className="text-[10px] text-text-muted">Utilizada em cálculos de atraso (Delay) e acústica.</p>
                </div>
                <select 
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase text-white outline-none focus:border-brand-primary/40 transition-all"
                >
                    <option>Metros (m)</option>
                    <option>Pés (ft)</option>
                </select>
            </div>
          </div>
        </div>

        {/* Sobre o Sistema */}
        <div className="bg-surface-elevated/40 border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-2xl flex items-center justify-center shadow-xl shadow-brand-primary/20">
              <span className="text-3xl font-black text-white">S</span>
            </div>
            <div className="text-center md:text-left">
              <h4 className="text-lg font-bold text-text-primary tracking-tight">SoundMaster Pro Edition</h4>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">Versão 2.0.0-react • Licença Ativa</p>
            </div>
          </div>
          <button className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-white/5">
            Verificar Atualizações
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
