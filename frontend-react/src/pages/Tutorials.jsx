import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Tutorials = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('tutorials');
  const [delayMeters, setDelayMeters] = useState(10);

  const tutorialCards = [
    { id: 'fft', icon: '📊', title: 'FFT & Waterfall', desc: 'Entenda como o Waterfall mostra a dissipação de energia sonora e ajuda a tratar ressonâncias persistentes.', link: '/analyzer', btn: 'Abrir Analisador' },
    { id: 'cal', icon: '🎤', title: 'Calibração SPL', desc: 'Aprenda a calibrar seu microfone de medição usando um offset de 94dB para leituras precisas.', link: '/analyzer', btn: 'Calibrar Mic' },
    { id: 'heatmap', icon: '🗺️', title: 'Mapa de Cobertura', desc: 'Garanta que o som chegue com clareza em todos os bancos, mantendo a média entre 75dB e 105dB.', link: '/acoustics', btn: 'Ver Mapa' },
    { id: 'mixer', icon: '🎚️', title: 'Mixer & Auxiliares', desc: 'Aprenda a diferença entre Pré e Pós fader e como alinhar torres de delay usando o atraso de saída.', link: '/mixer-input', btn: 'Ver Mixer' },
    { id: 'ia', icon: '🤖', title: 'Assistente IA', desc: 'O motor IA traduz comandos naturais em ações técnicas. Peça para "limpar sibilâncias" no canal 1.', link: '/', btn: 'Falar com a IA', highlight: true },
    { id: 'gain', icon: '📈', title: 'Gain Staging', desc: 'Estrutura de ganho é tudo. Mantenha o sinal no verde/amarelo (-18dBFS) para evitar ruídos e distorção.', link: '/mixer-input', btn: 'Checar Ganho' }
  ];

  const checklistItems = [
    'Verificar cabos e conexões (AES67)',
    'Conectar mesa Ui24R (IP Check)',
    'Zerar faders e ganhos (Panic Mode)',
    'Testar microfones (Check de Ganho)',
    'Alinhar torres de delay (Fase)',
    'Executar medição RT60 (Sala)',
    'Ajustar Reverb da nave (FX)',
    'Sincronizar Tap Delay (Musica)'
  ];

  return (
    <div className="page-enter max-w-7xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-3xl text-3xl shadow-xl shadow-amber-500/5">🎓</div>
          <div>
            <h2 className="text-4xl font-black text-text-primary tracking-tighter">Centro de Treinamento</h2>
            <p className="text-text-muted font-medium text-lg">Guia profissional para engenharia de som em igrejas</p>
          </div>
        </div>
        
        <div className="flex bg-surface-elevated/30 p-1.5 rounded-2xl border border-white/5 shadow-2xl self-start">
            <button 
                onClick={() => setActiveTab('tutorials')}
                className={`px-8 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-widest min-w-[140px] ${
                    activeTab === 'tutorials' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-text-muted hover:text-white'
                }`}
            >
                Tutoriais
            </button>
            <button 
                onClick={() => setActiveTab('tools')}
                className={`px-8 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-widest min-w-[140px] ${
                    activeTab === 'tools' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-text-muted hover:text-white'
                }`}
            >
                Ferramentas
            </button>
        </div>
      </header>

      {activeTab === 'tutorials' ? (
        <div className="space-y-12">
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.4em] mb-8 flex items-center gap-6">
                <span className="w-12 h-px bg-white/10"></span>
                Biblioteca Técnica
                <span className="flex-1 h-px bg-white/10"></span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {tutorialCards.map(card => (
                    <div 
                        key={card.id} 
                        className={`border rounded-3xl p-8 flex flex-col justify-between transition-all group shadow-xl ${
                            card.highlight 
                            ? 'bg-brand-primary/5 border-brand-primary/20 hover:border-brand-primary/40' 
                            : 'bg-surface-elevated/20 border-white/5 hover:border-amber-500/30'
                        }`}
                    >
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <span className="text-2xl">{card.icon}</span>
                                <h3 className={`text-xl font-bold ${card.highlight ? 'text-brand-primary' : 'text-text-primary'}`}>{card.title}</h3>
                            </div>
                            <p className="text-xs text-text-secondary leading-relaxed font-medium">
                                {card.desc}
                            </p>
                        </div>
                        <button 
                            onClick={() => navigate(card.link)}
                            className="mt-8 w-full py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-widest border border-white/5"
                        >
                            {card.btn}
                        </button>
                    </div>
                ))}
            </div>
        </div>
      ) : (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Checklist */}
                <div className="bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 shadow-2xl">
                    <div className="flex items-center justify-between mb-10">
                        <div className="flex items-center gap-4">
                            <span className="text-2xl">✅</span>
                            <h4 className="text-2xl font-black text-text-primary tracking-tight">Soundcheck Checklist</h4>
                        </div>
                        <button className="text-[10px] font-black text-text-muted hover:text-white transition-colors uppercase tracking-widest">Resetar</button>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {checklistItems.map((item, i) => (
                            <label key={i} className="flex items-center gap-4 p-4 bg-black/40 rounded-2xl border border-white/5 cursor-pointer group hover:border-amber-500/20 transition-all">
                                <input type="checkbox" className="w-5 h-5 rounded-lg border-white/10 bg-white/5 accent-amber-600 cursor-pointer" />
                                <span className="text-xs font-bold text-text-secondary group-hover:text-text-primary transition-colors">{item}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Calculadora de Delay */}
                <div className="bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 shadow-2xl space-y-10">
                    <div className="flex items-center gap-4">
                        <span className="text-2xl">📏</span>
                        <h4 className="text-2xl font-black text-text-primary tracking-tight">Cálculo de Alinhamento</h4>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">Ajuste o alinhamento temporal entre o PA principal e as torres de delay ou reforço lateral.</p>
                    
                    <div className="space-y-10">
                        <div className="bg-black/40 p-8 rounded-3xl border border-white/5">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-[10px] text-text-muted uppercase font-black tracking-widest">Distância do PA</span>
                                <span className="text-2xl font-black text-white">{delayMeters} <span className="text-xs text-text-muted font-bold ml-1">m</span></span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="50" step="0.5" 
                                value={delayMeters}
                                onChange={(e) => setDelayMeters(parseFloat(e.target.value))}
                                className="w-full accent-amber-500 h-2 bg-white/5 rounded-full cursor-pointer"
                            />
                        </div>

                        <div className="bg-amber-600/10 border border-amber-600/20 p-10 rounded-3xl text-center shadow-inner relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 to-transparent"></div>
                            <span className="text-6xl font-black text-white tracking-tighter">{(delayMeters / 343 * 1000).toFixed(1)}</span>
                            <span className="text-2xl font-black text-amber-500 ml-3">ms</span>
                            <p className="text-[10px] text-amber-500/60 uppercase font-black tracking-[0.3em] mt-4">Delay Requisitado</p>
                        </div>
                    </div>

                    <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-start gap-4">
                        <span className="text-xl">💡</span>
                        <p className="text-[10px] text-blue-400/80 leading-relaxed font-bold uppercase tracking-wide">Dica: Adicione 10ms extras para o efeito Haas, fazendo o som "parecer" vir do palco.</p>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Tutorials;
