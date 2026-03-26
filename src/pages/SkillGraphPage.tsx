import { useNavigate } from 'react-router-dom'
import { Lock, CheckCircle, Circle, ArrowRight, BookOpen, Zap, TrendingUp, Trash2, Plus } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { SkillNode } from '../types'

const STATUS_CONFIG = {
  locked: { icon: Lock, color: 'text-[#475569]', bg: 'bg-[#1e293b]', border: 'border-[#334155]', label: 'Locked' },
  available: { icon: Circle, color: 'text-blue-400', bg: 'bg-blue-950/40', border: 'border-blue-500/40', label: 'Available' },
  in_progress: { icon: ArrowRight, color: 'text-amber-400', bg: 'bg-amber-950/30', border: 'border-amber-500/40', label: 'In Progress' },
  mastered: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-500/40', label: 'Mastered' },
}

const MODE_ICONS = { learn: BookOpen, drill: Zap, advance: TrendingUp }

function SkillCard({ node, onClick }: { node: SkillNode; onClick: () => void }) {
  const cfg = STATUS_CONFIG[node.status]
  const Icon = cfg.icon
  return (
    <button
      onClick={onClick}
      disabled={node.status === 'locked'}
      className={`w-full text-left p-4 rounded-xl border transition-all ${cfg.bg} ${cfg.border} ${
        node.status !== 'locked'
          ? 'hover:brightness-110 cursor-pointer'
          : 'opacity-50 cursor-not-allowed'
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon size={18} className={`mt-0.5 shrink-0 ${cfg.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">{node.label}</p>
          <p className="text-[#64748b] text-xs mt-0.5 line-clamp-2">{node.description}</p>
          {node.masteryData && (
            <div className="flex gap-3 mt-2">
              <span className="text-[#94a3b8] text-xs">
                Accuracy: <span className={node.masteryData.lastAccuracy >= 0.9 ? 'text-emerald-400' : 'text-amber-400'}>
                  {Math.round(node.masteryData.lastAccuracy * 100)}%
                </span>
              </span>
              {node.masteryData.bestTime && (
                <span className="text-[#94a3b8] text-xs">
                  Best: <span className="text-blue-400">{node.masteryData.bestTime.toFixed(1)}s</span>
                </span>
              )}
            </div>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.border} bg-transparent shrink-0`}>
          {cfg.label}
        </span>
      </div>
    </button>
  )
}

export default function SkillGraphPage() {
  const navigate = useNavigate()
  const { getActiveGraph, graphs, setActiveGraph, removeGraph, setActiveSkill } = useAppStore()
  const graph = getActiveGraph()

  function launchSession(node: SkillNode, mode: 'learn' | 'drill' | 'advance') {
    setActiveSkill(node.id)
    navigate(`/session/${mode}`)
  }

  if (!graph) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-center px-4">
        <p className="text-[#94a3b8] text-lg mb-4">No skill graph loaded yet.</p>
        <button
          onClick={() => navigate('/')}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={18} />
          Add your first source
        </button>
      </div>
    )
  }

  const byDepth = graph.nodes.reduce<Record<number, SkillNode[]>>((acc, n) => {
    ;(acc[n.depth] ??= []).push(n)
    return acc
  }, {})

  const mastered = graph.nodes.filter(n => n.status === 'mastered').length
  const total = graph.nodes.length
  const progress = Math.round((mastered / total) * 100)

  return (
    <div className="min-h-screen bg-[#0f172a] px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{graph.sourceTitle}</h1>
            <p className="text-[#94a3b8] text-sm mt-1">{graph.sourceSummary}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/session/force-hanon')}
              className="text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/60 px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-1.5"
              title="Force Hanon — bypass progression and drill any skill"
            >
              <Zap size={14} />
              Force Hanon
            </button>
            <button
              onClick={() => navigate('/')}
              className="text-[#94a3b8] hover:text-white border border-[#334155] hover:border-[#475569] px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-1.5"
            >
              <Plus size={14} />
              New
            </button>
            <button
              onClick={() => removeGraph(graph.id)}
              className="text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 px-3 py-2 rounded-xl text-sm transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {graphs.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {graphs.map(g => (
              <button
                key={g.id}
                onClick={() => setActiveGraph(g.id)}
                className={`shrink-0 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  g.id === graph.id
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'border-[#334155] text-[#94a3b8] hover:text-white bg-[#1e293b]'
                }`}
              >
                {g.sourceTitle}
              </button>
            ))}
          </div>
        )}

        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#94a3b8] text-sm">Overall Mastery</span>
            <span className="text-white font-semibold text-sm">{mastered}/{total} skills</span>
          </div>
          <div className="h-2 bg-[#0f172a] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[#475569] text-xs mt-1">{progress}% complete</p>
        </div>

        <div className="space-y-8">
          {Object.entries(byDepth)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([depth, nodes]) => (
              <div key={depth}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[#475569] text-xs font-mono">LEVEL {Number(depth) + 1}</span>
                  <div className="flex-1 h-px bg-[#1e293b]" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {nodes.map(node => (
                    <div key={node.id}>
                      <SkillCard node={node} onClick={() => {}} />
                      {node.status !== 'locked' && (
                        <div className="flex gap-2 mt-2 pl-1">
                          {(['learn', 'drill', 'advance'] as const).map(mode => {
                            const Icon = MODE_ICONS[mode]
                            const colors = {
                              learn: 'text-purple-400 border-purple-500/30 hover:bg-purple-950/30',
                              drill: 'text-amber-400 border-amber-500/30 hover:bg-amber-950/30',
                              advance: 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-950/30',
                            }
                            return (
                              <button
                                key={mode}
                                onClick={() => launchSession(node, mode)}
                                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${colors[mode]}`}
                              >
                                <Icon size={12} />
                                {mode}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
