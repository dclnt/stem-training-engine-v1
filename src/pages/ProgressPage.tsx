import { useNavigate } from 'react-router-dom'
import { BarChart2, CheckCircle, Circle, Lock, Clock, Target, ArrowLeft, Zap, BookOpen, TrendingUp } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

export default function ProgressPage() {
  const navigate = useNavigate()
  const { getActiveGraph, sessionHistory } = useAppStore()
  const graph = getActiveGraph()

  if (!graph) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-center px-4">
        <BarChart2 size={40} className="text-[#475569] mb-3" />
        <p className="text-[#94a3b8] mb-4">No graph loaded. Submit a source first.</p>
        <button onClick={() => navigate('/')} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">Get Started</button>
      </div>
    )
  }

  const mastered = graph.nodes.filter(n => n.status === 'mastered').length
  const inProgress = graph.nodes.filter(n => n.status === 'in_progress').length
  const available = graph.nodes.filter(n => n.status === 'available').length
  const locked = graph.nodes.filter(n => n.status === 'locked').length
  const total = graph.nodes.length

  const recentSessions = sessionHistory.slice(0, 10)
  const totalSessions = sessionHistory.length
  const avgAccuracy = sessionHistory.length > 0
    ? sessionHistory.reduce((s, r) => s + r.accuracy, 0) / sessionHistory.length
    : 0

  const modeColors = { learn: 'text-purple-400', drill: 'text-amber-400', advance: 'text-emerald-400' }
  const modeIcons = { learn: BookOpen, drill: Zap, advance: TrendingUp }

  return (
    <div className="min-h-screen bg-[#0f172a] px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/graph')} className="text-[#475569] hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <BarChart2 size={18} className="text-blue-400" />
          <h1 className="text-white font-bold text-xl">Progress Dashboard</h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Mastered', value: mastered, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-950/30 border-emerald-500/30' },
            { label: 'In Progress', value: inProgress, icon: Circle, color: 'text-amber-400', bg: 'bg-amber-950/20 border-amber-500/30' },
            { label: 'Available', value: available, icon: Circle, color: 'text-blue-400', bg: 'bg-blue-950/30 border-blue-500/30' },
            { label: 'Locked', value: locked, icon: Lock, color: 'text-[#475569]', bg: 'bg-[#1e293b] border-[#334155]' },
          ].map(item => {
            const Icon = item.icon
            return (
              <div key={item.label} className={`rounded-xl border p-4 ${item.bg}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className={item.color} />
                  <span className="text-[#64748b] text-xs">{item.label}</span>
                </div>
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-[#475569] text-xs">{total > 0 ? Math.round(item.value / total * 100) : 0}% of {total}</p>
              </div>
            )
          })}
        </div>

        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">Overall Mastery</h2>
            <span className="text-[#94a3b8] text-sm">{mastered}/{total}</span>
          </div>
          <div className="h-3 bg-[#0f172a] rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500"
              style={{ width: `${total > 0 ? (mastered / total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[#475569] text-xs">{total > 0 ? Math.round((mastered / total) * 100) : 0}% complete — {total - mastered} skills remaining</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} className="text-blue-400" />
              <span className="text-[#64748b] text-xs">Total Sessions</span>
            </div>
            <p className="text-2xl font-bold text-white">{totalSessions}</p>
          </div>
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart2 size={14} className="text-purple-400" />
              <span className="text-[#64748b] text-xs">Avg. Accuracy</span>
            </div>
            <p className="text-2xl font-bold text-white">{Math.round(avgAccuracy * 100)}%</p>
          </div>
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} className="text-amber-400" />
              <span className="text-[#64748b] text-xs">Skills Mastered</span>
            </div>
            <p className="text-2xl font-bold text-white">{mastered}</p>
          </div>
        </div>

        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5 mb-6">
          <h2 className="text-white font-semibold mb-4">Skill Status Breakdown</h2>
          <div className="space-y-2">
            {graph.nodes.map(node => {
              const statusConfig = {
                locked: { color: 'text-[#475569]', bar: 'bg-[#334155]', label: 'Locked' },
                available: { color: 'text-blue-400', bar: 'bg-blue-500', label: 'Available' },
                in_progress: { color: 'text-amber-400', bar: 'bg-amber-500', label: 'In Progress' },
                mastered: { color: 'text-emerald-400', bar: 'bg-emerald-500', label: 'Mastered' },
              }[node.status]
              return (
                <div key={node.id} className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-[#94a3b8] text-sm truncate">{node.label}</span>
                  </div>
                  <span className={`text-xs shrink-0 ${statusConfig.color}`}>{statusConfig.label}</span>
                  {node.masteryData && (
                    <span className="text-[#475569] text-xs shrink-0">
                      {Math.round(node.masteryData.lastAccuracy * 100)}% acc
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {recentSessions.length > 0 && (
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Recent Sessions</h2>
            <div className="space-y-2">
              {recentSessions.map((s, i) => {
                const ModeIcon = modeIcons[s.mode]
                const skillNode = graph.nodes.find(n => n.id === s.skillId)
                return (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-[#1e293b] last:border-0">
                    <ModeIcon size={14} className={modeColors[s.mode]} />
                    <span className="text-[#94a3b8] text-sm flex-1 truncate">{skillNode?.label ?? s.skillId}</span>
                    <span className={`text-xs font-medium ${s.accuracy >= 0.9 ? 'text-emerald-400' : 'text-amber-400'}`}>{Math.round(s.accuracy * 100)}%</span>
                    <span className={`text-xs ${s.gatesPassed ? 'text-emerald-400' : 'text-[#475569]'}`}>
                      {s.gatesPassed ? '✓ Gate' : '○'}
                    </span>
                    <span className="text-[#334155] text-xs">{new Date(s.completedAt).toLocaleDateString()}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
