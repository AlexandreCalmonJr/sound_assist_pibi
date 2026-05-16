import { LayoutDashboard, Mic2, Settings, History, Map, Activity } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const Sidebar = () => {
  const location = useLocation()

  const menuItems = [
    { icon: LayoutDashboard, label: 'Mixer', path: '/' },
    { icon: Activity, label: 'Analyzer', path: '/analyzer' },
    { icon: Map, label: 'Heatmap', path: '/heatmap' },
    { icon: History, label: 'Histórico', path: '/history' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ]

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-6">
        <h2 className="text-xl font-black text-cyan-400 flex items-center gap-2">
          <Mic2 className="w-6 h-6" />
          SoundMaster
        </h2>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                isActive 
                  ? 'bg-cyan-600/10 text-cyan-400 border border-cyan-600/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/50 p-4 rounded-xl text-center">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Status da Mesa</div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 anim-pulse" />
            <span className="text-xs font-bold text-emerald-400">Online</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
