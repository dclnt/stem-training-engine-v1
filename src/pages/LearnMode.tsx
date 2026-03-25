import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, Lightbulb, Eye, MessageSquare, RotateCcw, Compass, Loader, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { llmService } from '../services/llmService'
import { useAppStore } from '../store/useAppStore'
import type { CAContent, CAPhase } from '../types'
import ContentRenderer from '../components/ContentRenderer'

const PHASES: { key: CAPhase; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'overview', label: 'Global Overview', icon: <Compass size={14} />, color: 'text-blue-400' },
  { key: 'modeling', label: 'Expert Modeling', icon: <Eye size={14} />, color: 'text-purple-400' },
  { key: 'coaching', label: 'Coached Practice', icon: <Lightbulb size={14} />, color: 'text-amber-400' },
  { key: 'articulation', label: 'Articulation', icon: <MessageSquare size={14} />, color: 'text-emerald-400' },
  { key: 'reflection', label: 'Reflection', icon: <RotateCcw size={14} />, color: 'text-pink-400' },
  { key: 'exploration', label: 'Exploration', icon: <Compass size={14} />, color: 'text-cyan-400' },
]

export default function LearnMode() {
  const navigate = useNavigate()
  const { getActiveSkill, getActiveGraph, recordSessionResult } = useAppStore()
  const skill = getActiveSkill()
  const graph = getActiveGraph()

  const [caContent, setCaContent] = useState<CAContent | null>(null)
  const [phase, setPhase] = useState<CAPhase>('overview')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [articleAnswer, setArticleAnswer] = useState('')
  const [hintIndex, setHintIndex] = useState(0)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (!skill) return
    setLoadError(null)
    setLoading(true)
    const sourceContext = graph
      ? [
          `SUBJECT: ${graph.sourceTitle}`,
          `SUMMARY: ${graph.sourceSummary}`,
          graph.sourceContent ? `SOURCE EXCERPT (match this domain exactly):\n${graph.sourceContent.slice(0, 1200)}` : '',
        ].filter(Boolean).join('\n')
      : undefined
    llmService.generateCAContent(skill, sourceContext)
      .then(c => { setCaContent(c); setLoading(false) })
      .catch(err => {
        const msg = err instanceof Error ? err.message : ''
        setLoadError(
          msg === 'API_KEY_MISSING'
            ? 'An API key is required to generate lesson content. Add VITE_ANTHROPIC_API_KEY to your environment.'
            : 'Could not load lesson content for this skill. Please try again.'
        )
        setLoading(false)
      })
  }, [skill, retryKey])

  if (!skill || !graph) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <p className="text-[#94a3b8]">No skill selected.</p>
      </div>
    )
  }

  const phaseIndex = PHASES.findIndex(p => p.key === phase)

  function advance() {
    if (phaseIndex < PHASES.length - 1) {
      setPhase(PHASES[phaseIndex + 1].key)
    } else {
      recordSessionResult({
        skillId: skill!.id,
        mode: 'learn',
        accuracy: 1,
        avgSolveTime: 0,
        gatesPassed: false,
        completedAt: Date.now(),
      })
      setCompleted(true)
    }
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Learn Session Complete</h2>
          <p className="text-[#94a3b8] mb-6">You've completed the full Cognitive Apprenticeship arc for <strong className="text-white">{skill.label}</strong>. Use Drill mode to build automaticity.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/graph')} className="border border-[#334155] text-[#94a3b8] hover:text-white px-4 py-2 rounded-xl transition-colors text-sm">Back to Graph</button>
            <button onClick={() => navigate('/session/drill')} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium">Start Drill Mode</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f172a] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/graph')} className="text-[#475569] hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-purple-400" />
            <span className="text-white font-semibold">Learn Mode</span>
            <span className="text-[#475569] text-sm">— {skill.label}</span>
          </div>
        </div>

        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {PHASES.map((p, i) => (
            <div
              key={p.key}
              className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                i < phaseIndex
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
                  : i === phaseIndex
                  ? 'bg-[#1e293b] border-[#475569] text-white'
                  : 'border-[#1e293b] text-[#334155]'
              }`}
            >
              {p.icon}
              <span className="hidden sm:inline">{p.label}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader size={24} className="text-blue-400 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="bg-[#1e293b] border border-red-500/30 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} className="text-red-400" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">Lesson Content Unavailable</h2>
            <p className="text-[#94a3b8] text-sm mb-6">{loadError}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate('/graph')} className="border border-[#334155] text-[#94a3b8] hover:text-white px-4 py-2 rounded-xl transition-colors text-sm">
                Back to Graph
              </button>
              <button onClick={() => setRetryKey(k => k + 1)} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium">
                Retry
              </button>
            </div>
          </div>
        ) : caContent ? (
          <PhaseContent
            phase={phase}
            content={caContent}
            skillLabel={skill.label}
            hintIndex={hintIndex}
            onShowHint={() => setHintIndex(i => Math.min(i + 1, caContent.coachingHints.length - 1))}
            articleAnswer={articleAnswer}
            onArticleChange={setArticleAnswer}
            onAdvance={advance}
            isLast={phaseIndex === PHASES.length - 1}
          />
        ) : null}
      </div>
    </div>
  )
}

interface PhaseContentProps {
  phase: CAPhase
  content: CAContent
  skillLabel: string
  hintIndex: number
  onShowHint: () => void
  articleAnswer: string
  onArticleChange: (v: string) => void
  onAdvance: () => void
  isLast: boolean
}

/**
 * Parses a workedExample string into individual numbered steps.
 * Lines starting with "1. ", "2. " etc. begin a new step;
 * continuation lines are appended to the current step.
 */
function parseSteps(text: string): string[] {
  const lines = text.split('\n')
  const steps: string[] = []
  let current = ''
  for (const line of lines) {
    const m = line.match(/^\s*\d+\.\s+(.+)/)
    if (m) {
      if (current) steps.push(current.trim())
      current = m[1]
    } else if (current && line.trim()) {
      current += ' ' + line.trim()
    }
  }
  if (current) steps.push(current.trim())
  return steps
}

function PhaseContent({ phase, content, skillLabel, hintIndex, onShowHint, articleAnswer, onArticleChange, onAdvance, isLast }: PhaseContentProps) {
  const sectionClass = 'bg-[#1e293b] border border-[#334155] rounded-2xl p-6 mb-4'

  // Overview: split off the first sentence as the "core idea" callout
  const overviewMatch = content.overview.match(/^([\s\S]+?[.!?])\s*([\s\S]*)$/)
  const overviewFirst = overviewMatch ? overviewMatch[1].trim() : content.overview
  const overviewRest  = overviewMatch ? overviewMatch[2].trim() : ''

  // Expert Modeling: parse numbered steps from workedExample
  const modelingSteps = parseSteps(content.workedExample)

  return (
    <div>
      {phase === 'overview' && (
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-4">
            <Compass size={18} className="text-blue-400" />
            <h2 className="text-white font-semibold">Global Overview — {skillLabel}</h2>
          </div>
          {/* Core idea callout */}
          <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-4 mb-4">
            <p className="text-blue-400 text-xs uppercase tracking-widest font-semibold mb-2">Core Idea</p>
            <ContentRenderer content={overviewFirst} className="text-blue-100 font-medium leading-relaxed" />
          </div>
          {overviewRest && (
            <ContentRenderer content={overviewRest} className="text-[#cbd5e1] leading-relaxed" />
          )}
        </div>
      )}

      {phase === 'modeling' && (
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-4">
            <Eye size={18} className="text-purple-400" />
            <h2 className="text-white font-semibold">Expert Modeling</h2>
          </div>
          {/* Numbered step cards */}
          {modelingSteps.length > 0 ? (
            <div className="space-y-3 mb-4">
              {modelingSteps.map((step, i) => (
                <div key={i} className="flex gap-3 items-start bg-[#0f172a] border border-[#334155] rounded-xl p-4">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                    <span className="text-purple-400 text-xs font-bold">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <ContentRenderer content={step} className="text-[#cbd5e1] leading-relaxed" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1 mb-4">
              <ContentRenderer content={content.workedExample} className="text-[#cbd5e1] leading-relaxed" />
            </div>
          )}
          <div className="border-t border-[#334155] pt-4">
            <p className="text-[#64748b] text-xs uppercase tracking-widest mb-3">Expert annotations</p>
            <ul className="space-y-2">
              {content.expertAnnotations.map((ann, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#94a3b8]">
                  <span className="text-purple-400 mt-0.5">◆</span>
                  <ContentRenderer content={ann} inline className="leading-relaxed" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {phase === 'coaching' && (
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={18} className="text-amber-400" />
            <h2 className="text-white font-semibold">Coached Practice</h2>
          </div>
          <p className="text-[#94a3b8] text-sm mb-4">Work through a practice problem. Reveal hints one at a time.</p>
          <div className="space-y-3">
            {content.coachingHints.slice(0, hintIndex + 1).map((hint, i) => (
              <div key={i} className="flex gap-3 items-start bg-amber-950/20 border border-amber-500/20 rounded-xl p-4">
                <div className="shrink-0 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <span className="text-amber-400 text-xs font-bold">{i + 1}</span>
                </div>
                <p className="text-amber-300 text-sm leading-relaxed">{hint}</p>
              </div>
            ))}
          </div>
          {hintIndex < content.coachingHints.length - 1 && (
            <button
              onClick={onShowHint}
              className="mt-3 text-amber-400 hover:text-amber-300 text-sm border border-amber-500/30 hover:border-amber-500/50 px-4 py-2 rounded-xl transition-colors"
            >
              Show next hint →
            </button>
          )}
        </div>
      )}

      {phase === 'articulation' && (
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-emerald-400" />
            <h2 className="text-white font-semibold">Articulation</h2>
          </div>
          <p className="text-[#94a3b8] text-sm mb-4">{content.articulationPrompt}</p>
          <textarea
            value={articleAnswer}
            onChange={e => onArticleChange(e.target.value)}
            rows={5}
            placeholder="Type your explanation here..."
            className="w-full bg-[#0f172a] border border-[#334155] focus:border-emerald-500/50 rounded-xl px-4 py-3 text-white placeholder-[#475569] text-sm resize-none outline-none"
          />
        </div>
      )}

      {phase === 'reflection' && (
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-4">
            <RotateCcw size={18} className="text-pink-400" />
            <h2 className="text-white font-semibold">Reflection</h2>
          </div>
          <div className="space-y-1"><ContentRenderer content={content.reflectionComparison} className="text-[#cbd5e1] leading-relaxed" /></div>
        </div>
      )}

      {phase === 'exploration' && (
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-4">
            <Compass size={18} className="text-cyan-400" />
            <h2 className="text-white font-semibold">Exploration</h2>
          </div>
          <div className="space-y-1"><ContentRenderer content={content.explorationSeed} className="text-[#cbd5e1] leading-relaxed" /></div>
        </div>
      )}

      <button
        onClick={onAdvance}
        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {isLast ? 'Complete Learn Session' : (
          <>
            Continue
            <ChevronRight size={18} />
          </>
        )}
      </button>
    </div>
  )
}
