import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer'
import RtaCanvas from '../components/Analyzer/RtaCanvas'
import { Play, Square, Settings2 } from 'lucide-react'

const AnalyzerPage = () => {
  const { isAnalyzing, start, stop, freqData, sampleRate, analyser } = useAudioAnalyzer(8192)

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-white">Acoustic Analyzer</h1>
          <p className="text-slate-400">Análise de espectro e métricas em tempo real.</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={isAnalyzing ? stop : start}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
              isAnalyzing 
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20' 
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/20'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                Parar Análise
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Iniciar Microfone
              </>
            )}
          </button>
          
          <button className="p-3 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all">
            <Settings2 className="w-6 h-6" />
          </button>
        </div>
      </header>
      
      <div className="bg-slate-900 border border-slate-800 p-1 rounded-2xl aspect-video relative overflow-hidden group shadow-2xl">
        {!isAnalyzing && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-[14px]">
            <div className="w-16 h-16 bg-cyan-600/10 rounded-full flex items-center justify-center mb-4 border border-cyan-500/20">
              <Play className="w-8 h-8 text-cyan-400 ml-1" />
            </div>
            <p className="text-slate-400 font-medium">Clique em iniciar para capturar o áudio</p>
          </div>
        )}
        
        <div className="h-full w-full bg-slate-950 rounded-[14px] overflow-hidden border border-slate-800">
          <RtaCanvas 
            freqData={freqData} 
            sampleRate={sampleRate} 
            fftSize={8192} 
            minDb={analyser?.minDecibels || -100} 
            maxDb={analyser?.maxDecibels || -30} 
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl group hover:border-cyan-500/30 transition-all">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1 group-hover:text-cyan-400">Peak Level</div>
          <div className="text-3xl font-mono text-cyan-400">-12.4 <span className="text-sm text-slate-500">dB</span></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl group hover:border-emerald-500/30 transition-all">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1 group-hover:text-emerald-400">RMS (A-Weighted)</div>
          <div className="text-3xl font-mono text-emerald-400">84.2 <span className="text-sm text-slate-500">dBA</span></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl group hover:border-blue-500/30 transition-all">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1 group-hover:text-blue-400">Crest Factor</div>
          <div className="text-3xl font-mono text-blue-400">14.1 <span className="text-sm text-slate-500">dB</span></div>
        </div>
      </div>
    </div>
  )
}

export default AnalyzerPage
