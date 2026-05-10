import React, { useState, useEffect } from 'react';

const MobileConnect = () => {
  const [localIp, setLocalIp] = useState('192.168.1.100');

  return (
    <div className="page-enter space-y-10">
      <header className="flex flex-col gap-4">
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Conectar Dispositivo Móvel</h2>
        <p className="text-text-secondary font-medium max-w-2xl text-lg">
          Transforme seu iPad ou Smartphone em um controle remoto e sensor RTA volante para o salão.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 flex flex-col items-center justify-center text-center group transition-all hover:bg-white/[0.03] shadow-2xl">
            <h3 className="text-2xl font-black text-white mb-8 tracking-tight">Escaneie para Acessar</h3>
            
            <div className="bg-white p-6 rounded-[32px] mb-8 shadow-[0_0_50px_rgba(34,211,238,0.2)] group-hover:scale-105 transition-transform">
                {/* QR Code Placeholder */}
                <div className="w-48 h-48 bg-slate-100 rounded-2xl flex items-center justify-center border-8 border-slate-50">
                    <div className="grid grid-cols-5 gap-1.5 opacity-20">
                        {Array.from({ length: 25 }).map((_, i) => (
                            <div key={i} className={`w-3.5 h-3.5 bg-black rounded-sm ${Math.random() > 0.4 ? 'opacity-100' : 'opacity-0'}`}></div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="space-y-6 w-full max-w-sm">
                <div className="bg-black/40 border border-white/10 rounded-2xl p-5 font-mono text-sm text-brand-primary break-all shadow-inner">
                    <span className="opacity-40 mr-2 text-[10px] uppercase font-black tracking-widest block mb-2">URL Local</span>
                    http://{localIp}:3000
                </div>
                <button className="flex items-center justify-center gap-3 w-full p-5 bg-brand-primary hover:brightness-110 text-white font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 shadow-xl shadow-brand-primary/20">
                    <span>Copiar Link Direto</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                </button>
            </div>
        </div>

        <div className="space-y-8">
            <div className="bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 transition-all hover:bg-white/[0.03] shadow-xl">
                <h3 className="text-xl font-black text-white mb-8 flex items-center gap-4">
                    <span className="w-10 h-10 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center text-sm">01</span>
                    Guia de Instalação
                </h3>
                <ul className="space-y-6">
                    <li className="flex gap-5 text-text-secondary items-center">
                        <div className="w-2 h-2 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>
                        <span className="font-medium">Conecte o dispositivo na mesma rede Wi-Fi da mesa.</span>
                    </li>
                    <li className="flex gap-5 text-text-secondary items-center">
                        <div className="w-2 h-2 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>
                        <span className="font-medium">Abra o link acima no Safari ou Chrome do celular.</span>
                    </li>
                    <li className="flex gap-5 text-text-secondary items-center">
                        <div className="w-2 h-2 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>
                        <span className="font-medium">Dê permissão para uso do microfone para o RTA Móvel.</span>
                    </li>
                    <li className="flex gap-5 text-text-secondary items-center">
                        <div className="w-2 h-2 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>
                        <span className="font-medium">Controle faders e EQ de qualquer lugar do templo.</span>
                    </li>
                </ul>
            </div>

            <div className="bg-brand-primary/5 border border-brand-primary/10 rounded-[40px] p-10 shadow-2xl relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 text-6xl group-hover:scale-110 transition-transform">💡</div>
                <h3 className="text-xl font-black text-brand-primary mb-6 flex items-center gap-4 relative z-10">
                    Dicas de Uso Pro
                </h3>
                <ul className="space-y-6 relative z-10">
                    <li className="flex gap-5 text-text-secondary items-start">
                        <span className="text-lg">🎧</span>
                        <span className="font-medium italic">Use fones de ouvido ao ativar o microfone móvel para evitar loops de feedback destrutivos.</span>
                    </li>
                    <li className="flex gap-5 text-text-secondary items-start">
                        <span className="text-lg">📏</span>
                        <span className="font-medium italic">Caminhe pelos bancos e use o celular para identificar 'zonas mortas' de agudos.</span>
                    </li>
                </ul>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MobileConnect;
