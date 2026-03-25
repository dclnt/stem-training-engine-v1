import { NavLink, useLocation } from 'react-router-dom'
import { Home, GitBranch, BarChart2, Zap } from 'lucide-react'

const NAV = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/graph', icon: GitBranch, label: 'Skill Graph' },
  { to: '/progress', icon: BarChart2, label: 'Progress' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isSession = location.pathname.startsWith('/session')

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      {!isSession && (
        <header className="border-b border-[#1e293b] bg-[#0f172a]/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                <Zap size={14} className="text-white" />
              </div>
              <span className="text-white font-bold text-sm tracking-tight">STEM Engine</span>
            </div>
            <nav className="flex items-center gap-1">
              {NAV.map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#1e293b] text-white font-medium'
                          : 'text-[#64748b] hover:text-white hover:bg-[#1e293b]/50'
                      }`
                    }
                  >
                    <Icon size={14} />
                    <span className="hidden sm:inline">{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>
          </div>
        </header>
      )}
      <main className="flex-1">{children}</main>
    </div>
  )
}
