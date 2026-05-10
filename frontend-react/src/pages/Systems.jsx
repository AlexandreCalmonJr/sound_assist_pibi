import React, { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

const Systems = () => {
  const { mixerStatus, emit } = useSocket();
  const [ip, setIp] = useState('10.10.1.1');
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [isTunneling, setIsTunneling] = useState(false);

  useEffect(() => {
    // Busca status inicial do túnel
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.tunnelUrl) {
          setTunnelUrl(data.tunnelUrl);
          setIsTunneling(true);
        }
      })
      .catch(err => console.error('Erro ao carregar config:', err));
  }, []);

  const handleConnect = () => {
    emit('connect_mixer', ip);
  };

  const toggleTunnel = async () => {
    setIsTunneling(!isTunneling);
    try {
        const res = await fetch('/api/tunnel/toggle', { method: 'POST' });
        const data = await res.json();
        if (data.success && !isTunneling) {
            // Aguarda um pouco e tenta pegar a URL
            setTimeout(() => {
                fetch('/api/config')
                    .then(r => r.json())
                    .then(d => setTunnelUrl(d.tunnelUrl));
            }, 3000);
        } else {
            setTunnelUrl('');
        }
    } catch (e) {
        console.error('Falha no túnel:', e);
    }
  };

  const copyLink = () => {
    if (tunnelUrl) {
        navigator.clipboard.writeText(tunnelUrl);
        alert('Link copiado: ' + tunnelUrl);
    }
  };

  return (
    <div className="page-enter max-w-5xl mx-auto">
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-4">
          <span className="p-3 bg-surface-elevated/50 rounded-2xl text-2xl border border-white/5">🌐</span>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Sistemas & Rede</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">Gestão de Infraestrutura e Conectividade</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Conexão Ui24R */}
        <div className="bg-surface-elevated/20 border border-white/5 rounded-3xl p-8 shadow-2xl space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Mesa de Som (Hardware)</h3>
            
            <div className="space-y-4">
                <div>
                    <label className="text-[9px] font-bold text-text-muted uppercase mb-3 block tracking-widest">Endereço IP da Mesa</label>
                    <div className="flex gap-3">
                        <input 
                            type="text" 
                            value={ip}
                            onChange={(e) => setIp(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm flex-1 focus:border-brand-primary/40 outline-none transition-all font-mono" 
                            placeholder="10.10.1.1" 
                        />
                        <button 
                            onClick={handleConnect}
                            className="px-6 py-3 bg-brand-primary hover:brightness-110 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-brand-primary/20"
                        >
                            Conectar
                        </button>
                    </div>
                </div>

                <div className="p-5 bg-black/40 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted uppercase font-bold tracking-tight">Status de Controle</span>
                        <span className={`text-[10px] font-mono font-bold uppercase ${mixerStatus.connected ? 'text-green-400' : 'text-red-400'}`}>
                            {mixerStatus.connected ? 'Ativo (12ms)' : 'Desconectado'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted uppercase font-bold tracking-tight">Firmware Mesa</span>
                        <span className="text-[10px] font-mono text-text-muted">v3.3.8242-PRO</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Status do Servidor & Túnel */}
        <div className="bg-surface-elevated/20 border border-white/5 rounded-3xl p-8 shadow-2xl space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Servidor & Acesso Remoto</h3>
            
            <div className="space-y-6">
                <div className="flex items-center justify-between p-5 bg-black/40 rounded-2xl border border-white/5">
                    <div>
                        <span className="text-[10px] text-text-primary block font-bold uppercase mb-1.5 tracking-tight">Túnel HTTPS (Mobile)</span>
                        <span className={`text-[10px] font-mono ${tunnelUrl ? 'text-brand-primary' : 'text-text-muted'} break-all`}>
                            {tunnelUrl || 'Desativado'}
                        </span>
                    </div>
                    <div className={`w-3 h-3 rounded-full transition-all duration-500 ${isTunneling ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]' : 'bg-white/10'}`}></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={toggleTunnel}
                        className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                            isTunneling 
                            ? 'bg-white/5 border-white/10 text-text-muted' 
                            : 'bg-brand-primary text-white border-brand-primary/20 shadow-lg shadow-brand-primary/20 hover:brightness-110'
                        }`}
                    >
                        {isTunneling ? 'Pausar Túnel' : 'Ativar Túnel'}
                    </button>
                    <button 
                        onClick={copyLink}
                        disabled={!tunnelUrl}
                        className="py-3 bg-white/5 hover:bg-white/10 text-text-primary rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        Copiar Link
                    </button>
                </div>

                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3">
                    <span className="text-lg">ℹ️</span>
                    <p className="text-[9px] text-blue-400/80 leading-relaxed font-medium">
                        O túnel permite controlar a mesa via celular ou tablet de qualquer lugar. Certifique-se de que o computador tem acesso estável à internet.
                    </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Systems;
