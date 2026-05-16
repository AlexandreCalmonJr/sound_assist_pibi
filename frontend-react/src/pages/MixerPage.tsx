import { useMixerStore } from '../store/useMixerStore'

const MixerPage = () => {
  const { channels, masterLevel } = useMixerStore()

  // Se não houver canais ainda, mostra alguns placeholders
  const channelIds = Object.keys(channels).length > 0 
    ? Object.keys(channels).map(Number) 
    : [1, 2, 3, 4, 5, 6, 7, 8]

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black">Digital Mixer</h1>
          <p className="text-slate-400">Controle total dos canais e master.</p>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl w-48 space-y-2">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span>Master</span>
            <span>{(masterLevel * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-600 to-blue-500 transition-all duration-75" 
              style={{ width: `${masterLevel * 100}%` }} 
            />
          </div>
        </div>
      </header>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {channelIds.map(id => {
          const ch = channels[id] || { name: `Ch ${id}`, level: 0, mute: false }
          return (
            <div key={id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-4 flex flex-col">
              <div className="text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{ch.name}</div>
              </div>
              
              <div className="flex-1 h-64 bg-slate-950 rounded-xl border border-slate-800 flex items-end justify-center p-4 relative group">
                {/* Medidor de nível (VU) */}
                <div className="absolute right-2 top-4 bottom-4 w-1 bg-slate-900 rounded-full overflow-hidden">
                   <div className="w-full bg-emerald-500/50" style={{ height: '30%', marginTop: '70%' }} />
                </div>
                
                {/* Trilho do Fader */}
                <div className="w-1 h-full bg-slate-800 rounded-full relative">
                  {/* Botão do Fader */}
                  <div 
                    className="absolute left-1/2 -translate-x-1/2 w-6 h-10 bg-slate-700 border border-slate-600 rounded shadow-xl cursor-grab active:cursor-grabbing hover:bg-slate-600 transition-colors flex flex-col justify-center items-center gap-1"
                    style={{ bottom: `${ch.level * 100}%`, transform: 'translate(-50%, 50%)' }}
                  >
                    <div className="w-4 h-0.5 bg-cyan-500/50 rounded-full" />
                    <div className="w-4 h-0.5 bg-cyan-500/50 rounded-full" />
                  </div>
                </div>
              </div>
              
              <button 
                className={`w-full py-2 rounded-lg text-[10px] font-black transition-all ${
                  ch.mute 
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                MUTE
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MixerPage
