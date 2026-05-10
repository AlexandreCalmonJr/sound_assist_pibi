import React from 'react';
import { useSocket } from '../hooks/useSocket';

const Dashboard = () => {
  const { isConnected, mixerStatus } = useSocket();

  const stats = [
    { label: 'Canais Ativos', value: '16', trend: 'OK', icon: '🎚️' },
    { label: 'Latência Rede', value: '1.2ms', trend: 'Ultra Low', icon: '⚡' },
    { label: 'Carga de IA', value: '4.2%', trend: 'Estável', icon: '🧠' },
    { label: 'Sincronia PTP', value: 'Locked', trend: 'Ideal', icon: '🔒' },
  ];

  const alerts = [
    { type: 'info', text: 'Calibração de microfone RTA recomendada (última há 4 dias).' },
    { type: 'success', text: 'Túnel HTTPS estabelecido via Cloudflare Zero Trust.' },
    { type: 'warning', text: 'Jitter de rede detectado no Switch 2 (AES67).' }
  ];

  return (
    <div className="page-enter space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-text-primary tracking-tighter">Dashboard Operacional</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary mt-2">Visão Geral da Inteligência Acústica</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase text-text-muted">Status do Sistema</span>
                <span className={`text-xs font-bold ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
                    {isConnected ? 'ONLINE' : 'OFFLINE'}
                </span>
            </div>
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'} shadow-[0_0_15px_currentColor]`}></div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-surface-elevated/20 border border-white/5 p-8 rounded-[32px] hover:border-brand-primary/20 transition-all group shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 text-4xl group-hover:scale-110 transition-transform">{s.icon}</div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-4">{s.label}</p>
            <div className="flex items-end justify-between relative z-10">
                <span className="text-3xl font-black text-text-primary tracking-tighter">{s.value}</span>
                <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${
                    s.trend === 'Ideal' || s.trend === 'Ultra Low' || s.trend === 'OK' ? 'text-green-400 bg-green-400/10' : 'text-brand-primary bg-brand-primary/10'
                }`}>
                    {s.trend}
                </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Activity Chart Placeholder */}
        <div className="lg:col-span-2 bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 flex flex-col shadow-2xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-10">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted">Análise de Tráfego de Áudio (Live)</h3>
                <span className="text-[9px] text-brand-primary font-black animate-pulse">● LIVE STREAM</span>
            </div>
            <div className="flex-1 flex items-end gap-3 min-h-[200px]">
                {Array.from({ length: 24 }).map((_, i) => (
                    <div 
                        key={i} 
                        className="flex-1 bg-white/5 rounded-t-lg transition-all duration-500 group-hover:bg-brand-primary/20" 
                        style={{ height: `${Math.floor(Math.random() * 80) + 10}%` }}
                    ></div>
                ))}
            </div>
            <div className="mt-8 pt-6 border-t border-white/5 flex justify-between text-[9px] font-black text-text-muted uppercase tracking-widest">
                <span>Mix Bus 1-12</span>
                <span>DSP Load: 12%</span>
                <span>RTP Buffering: OK</span>
            </div>
        </div>

        {/* Alerts & Tasks */}
        <div className="bg-surface-elevated/20 border border-white/5 rounded-[40px] p-10 shadow-2xl flex flex-col">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted mb-8">Notificações do Sistema</h3>
            <div className="space-y-4 flex-1">
                {alerts.map((alert, i) => (
                    <div key={i} className="p-5 bg-black/40 rounded-[24px] border border-white/5 flex items-start gap-4 group hover:border-brand-primary/20 transition-all">
                        <span className="text-lg">{alert.type === 'info' ? 'ℹ️' : (alert.type === 'success' ? '✅' : '⚠️')}</span>
                        <p className="text-xs text-text-secondary leading-relaxed font-medium group-hover:text-text-primary transition-colors">{alert.text}</p>
                    </div>
                ))}
            </div>
            <button className="mt-8 w-full py-4 bg-brand-primary hover:brightness-110 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-primary/20">
                Ver Logs Completos
            </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
