import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSocket } from './hooks/useSocket'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import MasterSection from './components/MasterSection'
import EqPanel from './components/EqPanel'
import AiPanel from './components/AiPanel'

// Páginas
import Dashboard from './pages/Dashboard'
import MixerPage from './pages/MixerPage'
import Analyzer from './pages/Analyzer'
import Systems from './pages/Systems'
import Settings from './pages/Settings'
import Rt60Acoustics from './pages/Rt60Acoustics'
import Tutorials from './pages/Tutorials'
import Aes67Health from './pages/Aes67Health'
import VoicePresets from './pages/VoicePresets'
import FeedbackDetector from './pages/FeedbackDetector'
import AiChat from './pages/AiChat'
import Benchmarking from './pages/Benchmarking'
import SplHeatmap from './pages/SplHeatmap'
import EqGuide from './pages/EqGuide'
import Home from './pages/Home'
import MobileConnect from './pages/MobileConnect'

function App() {
  const { isConnected, mixerStatus, lastLog, emit } = useSocket();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mixerOpen, setMixerOpen] = useState(true);

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-surface-0 text-text-primary">
        {/* Sidebar (Rail + Category Panel) */}
        <Sidebar 
          isOpen={sidebarOpen} 
          togglePanel={() => setSidebarOpen(!sidebarOpen)} 
        />

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          
          {/* Global Header */}
          <Header 
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onToggleMixer={() => setMixerOpen(!mixerOpen)}
            sidebarOpen={sidebarOpen}
            mixerOpen={mixerOpen}
          />

          {/* Content Viewport */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Main Content Area (Dynamic) */}
            <main className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent bg-gradient-to-b from-transparent to-black/30">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/mixer-input" element={<MixerPage />} />
                <Route path="/mixer-aux" element={<MixerPage />} />
                <Route path="/mixer-fx" element={<MixerPage />} />
                <Route path="/analyzer" element={<Analyzer />} />
                <Route path="/systems" element={<Systems />} />
                <Route path="/mobile" element={<MobileConnect />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/rt60" element={<Rt60Acoustics />} />
                <Route path="/tutorials" element={<Tutorials />} />
                <Route path="/aes67" element={<Aes67Health />} />
                <Route path="/voice-presets" element={<VoicePresets />} />
                <Route path="/feedback-detector" element={<FeedbackDetector />} />
                <Route path="/ai-chat" element={<AiChat />} />
                <Route path="/benchmarking" element={<Benchmarking />} />
                <Route path="/spl-heatmap" element={<SplHeatmap />} />
                <Route path="/eq-guide" element={<EqGuide />} />
                
                {/* Fallback para páginas não implementadas ainda */}
                <Route path="*" element={
                    <div className="page-enter h-full flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-3xl mb-6 grayscale opacity-30">🚧</div>
                        <h2 className="text-2xl font-bold mb-2">Página em Construção</h2>
                        <p className="text-text-secondary text-xs uppercase tracking-widest">Estamos migrando este módulo do legado para o React.</p>
                        <button onClick={() => window.history.back()} className="mt-8 px-6 py-2 bg-brand-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-brand-primary/20 hover:brightness-110">
                            Voltar
                        </button>
                    </div>
                } />
              </Routes>
            </main>

            {/* Mixer Panel (Right Aside) - Global */}
            <aside 
              className={`bg-surface-1 border-l border-white/5 flex flex-col transition-all duration-300 overflow-hidden ${
                  mixerOpen ? 'w-[var(--mixer-width)] opacity-100' : 'w-0 opacity-0'
              }`}
            >
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 scrollbar-none">
                  <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-4 opacity-50">Master Output</h4>
                      <div className="flex justify-center">
                          <MasterSection />
                      </div>
                  </section>

                  <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-4 opacity-50">AI Assistant</h4>
                      <AiPanel />
                  </section>
                  
                  <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-4 opacity-50">DSP Rack</h4>
                      <EqPanel />
                  </section>
              </div>
            </aside>
          </div>
        </div>

        {/* Audit Log Overlay (Floating) */}
        {lastLog && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-black/80 backdrop-blur-md border border-brand-primary/20 rounded-xl text-[10px] text-brand-primary font-mono shadow-2xl animate-in fade-in slide-in-from-bottom-4">
              <span className="opacity-40 mr-2 uppercase">Auditoria:</span> {lastLog}
          </div>
        )}
      </div>
    </BrowserRouter>
  )
}

export default App
