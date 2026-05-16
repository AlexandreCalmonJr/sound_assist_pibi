import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import MixerPage from './pages/MixerPage'
import AnalyzerPage from './pages/AnalyzerPage'
import { useMixerConnection } from './hooks/useMixerConnection'

function App() {
  // Inicializa a conexão global com o servidor Node.js
  useMixerConnection()

  return (

    <AppLayout>
      <Routes>
        <Route path="/" element={<MixerPage />} />
        <Route path="/analyzer" element={<AnalyzerPage />} />
        {/* Adicione mais rotas conforme necessário */}
        <Route path="*" element={<MixerPage />} />
      </Routes>
    </AppLayout>
  )
}

export default App
