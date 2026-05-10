import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

const Home = () => {
  const navigate = useNavigate();
  const { isConnected } = useSocket();
  const [localIp, setLocalIp] = useState('192.168.1.100'); // No futuro virá do backend

  const quickActions = [
    { id: 'analyzer', title: 'Iniciar Analisador', desc: 'Abra o analisador ao vivo para capturar ruído e gerar sugestões.', icon: '📊', color: 'bg-brand-primary' },
    { id: 'acoustics', title: 'Acústica do Salão', desc: 'Calcule RT60 e entenda como tratar reverberação no espaço.', icon: '📐', color: 'bg-slate-700' },
    { id: 'ai-chat', title: 'Assistente IA', desc: 'Envie relatórios e obtenha recomendações práticas para o mix.', icon: '🤖', color: 'bg-slate-700' }
  ];

  return (
    <div className="page-enter space-y-10">
      <header className="bg-gradient-to-br from-surface-elevated/40 to-surface-elevated/10 p-10 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-12 opacity-5 text-9xl group-hover:scale-110 transition-transform">🎧</div>
        <div className="relative z-10">
            <h2 className="text-5xl font-black text-brand-primary tracking-tighter mb-4">SoundMaster <span className="text-white font-thin">Pro</span></h2>
            <p className="text-text-secondary text-lg font-medium max-w-2xl leading-relaxed">
                Bem-vindo ao seu assistente de inteligência acústica. Navegue entre os módulos de análise, 
                mixagem e engenharia para obter o melhor som para sua igreja.
            </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {quickActions.map(action => (
            <div 
                key={action.id} 
                className="bg-surface-elevated/20 border border-white/10 rounded-[32px] p-8 hover:border-brand-primary/40 transition-all group shadow-xl flex flex-col justify-between h-72"
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-3xl">{action.icon}</span>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}></div>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-text-primary group-hover:text-brand-primary transition-colors">{action.title}</h3>
                        <p className="text-xs text-text-secondary leading-relaxed mt-2">{action.desc}</p>
                    </div>
                </div>
                <button 
                    onClick={() => navigate(`/${action.id}`)}
                    className={`w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        action.id === 'analyzer' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'bg-white/5 hover:bg-white/10 text-white'
                    }`}
                >
                    Acessar Módulo
                </button>
            </div>
        ))}
      </div>

      <div className="bg-amber-600/5 border border-amber-500/20 p-8 rounded-[40px] shadow-2xl flex items-start gap-6 relative group">
        <div className="absolute top-0 right-0 p-6 opacity-10 text-4xl">💡</div>
        <div className="p-4 bg-amber-500/10 rounded-3xl text-2xl">⚡</div>
        <div className="space-y-2">
            <h3 className="text-amber-500 font-black uppercase tracking-widest text-[10px]">Dica do Contexto</h3>
            <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
                Sua igreja possui muitas superfícies reflexivas (vidros/mármore). 
                Recomendamos usar o módulo <strong className="text-amber-400">Acústica (RT60)</strong> para simular tratamento ou ativar o 
                <strong className="text-amber-400"> Detector de Feedback</strong> para evitar microfonias inesperadas.
            </p>
        </div>
      </div>

      <div className="bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 shadow-2xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-2">
                <h3 className="text-2xl font-black text-text-primary tracking-tight flex items-center gap-4">
                    📱 Controle Remoto 
                    <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-full uppercase tracking-widest">Ativo</span>
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">Acesse este console de qualquer iPad ou celular conectado na mesma rede Wi-Fi.</p>
            </div>
            
            <div className="bg-black/40 p-6 rounded-3xl border border-white/5 flex flex-col items-center min-w-[240px]">
                <span className="text-[9px] uppercase font-black text-text-muted mb-4 tracking-widest">Endereço Local</span>
                <div className="text-2xl font-black text-brand-primary font-mono tracking-wider">{localIp}</div>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-center bg-black/20 p-8 rounded-[32px] border border-white/5">
            <div className="flex-1 space-y-4">
                <h4 className="text-lg font-bold text-text-primary">Conexão via QR Code</h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                    Aponte a câmera do seu dispositivo para o código ao lado. O sistema abrirá automaticamente o 
                    modo mobile otimizado com suporte a multi-touch para faders.
                </p>
                <button className="px-6 py-2.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    Copiar Link Seguro
                </button>
            </div>
            <div className="p-4 bg-white rounded-[32px] shadow-2xl">
                <div className="w-32 h-32 bg-slate-100 rounded-2xl flex items-center justify-center border-4 border-slate-50">
                    {/* QR Code Placeholder */}
                    <div className="grid grid-cols-4 gap-1 opacity-20">
                        {Array.from({ length: 16 }).map((_, i) => (
                            <div key={i} className={`w-4 h-4 bg-black rounded-sm ${Math.random() > 0.5 ? 'opacity-100' : 'opacity-0'}`}></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
