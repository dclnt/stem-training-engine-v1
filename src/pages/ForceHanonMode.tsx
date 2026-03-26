import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, ArrowLeft, ChevronRight, Loader, XCircle, CheckCircle, Timer } from 'lucide-react'
import { llmService } from '../services/llmService'
import { useAppStore } from '../store/useAppStore'
import type { DrillSet, DrillProblem, SkillNode } from '../types'
import ContentRenderer from '../components/ContentRenderer'
import TempoIndicator from '../components/TempoIndicator'
import SessionSummary from '../components/SessionSummary'

type HanonPhase = 'setup' | 'loading' | 'drilling' | 'results'
type TempoStage = 'untimed' | 'comfortable' | 'target' | 'fluency'

const TEMPO_LABELS: Record<TempoStage, { label: string; color: string }> = {
  untimed:     { label: 'Untimed',         color: 'text-blue-400' },
  comfortable: { label: 'Comfortable',     color: 'text-amber-400' },
  target:      { label: 'Target Tempo',    color: 'text-orange-400' },
  fluency:     { label: 'Fluency Pace',    color: 'text-red-400' },
}

const TEMPO_STAGES: TempoStage[] = ['untimed', 'comfortable', 'target', 'fluency']

interface Answer { problem: DrillProblem; userAnswer: string; timeMs: number; correct: boolean }

function buildSyntheticSkill(label: string): SkillNode {
  return {
    id: `force-${label.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}`,
    label,
    description: `Force Hanon drill: ${label}`,
    prerequisites: [],
    status: 'available',
    masteryData: null,
    estimatedSCT: 60,
    depth: 0,
  }
}

export default function ForceHanonMode() {
  const navigate = useNavigate()
  const { getActiveGraph, recordSessionResult, appSettings } = useAppStore()
  const graph = getActiveGraph()

  // Setup state
  const [customSkill, setCustomSkill] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string>('')
  const [useCustom, setUseCustom] = useState(!graph)
  const [startTempo, setStartTempo] = useState<TempoStage>('untimed')
  const [repCount, setRepCount] = useState<5 | 10 | 15 | 20>(10)
  const [variationMode, setVariationMode] = useState(true)

  // Session state
  const [phase, setPhase] = useState<HanonPhase>('setup')
  const [drillSet, setDrillSet] = useState<DrillSet | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [problems, setProblems] = useState<DrillProblem[]>([])
  const [problemIndex, setProblemIndex] = useState(0)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [sessionResult, setSessionResult] = useState<{ accuracy: number; avgTime: number } | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeElapsed(0)
    setTimerActive(true)
    timerRef.current = setInterval(() => setTimeElapsed(t => t + 100), 100)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerActive(false)
  }, [])

  useEffect(() => {
    if (phase === 'drilling' && drillSet) {
      if (startTempo !== 'untimed') startTimer()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [problemIndex, phase, drillSet, startTempo, startTimer])

  function getTargetSkill(): SkillNode {
    if (useCustom || !graph) {
      return buildSyntheticSkill(customSkill.trim() || 'Custom Skill')
    }
    const node = graph.nodes.find(n => n.id === selectedNodeId) ?? graph.nodes[0]
    return node
  }

  async function handleStart() {
    setPhase('loading')
    setLoadError(null)
    const skill = getTargetSkill()
    const sourceContext = graph
      ? [
          `SUBJECT: ${graph.sourceTitle}`,
          `SUMMARY: ${graph.sourceSummary}`,
          graph.sourceContent ? `SOURCE EXCERPT:\n${graph.sourceContent.slice(0, 1200)}` : '',
        ].filter(Boolean).join('\n')
      : undefined
    try {
      const ds = await llmService.generateDrillSet(skill, null, sourceContext, appSettings?.depthLevel ?? 'intermediate')
      // Build the problem list respecting rep count and variation mode
      let pool = ds.problems
      if (!variationMode) {
        pool = pool.filter(p => p.variationType === 'standard')
        if (pool.length === 0) pool = ds.problems // fallback if no standard
      }
      // Expand or trim to match repCount
      const expanded: DrillProblem[] = []
      while (expanded.length < repCount) {
        expanded.push(...pool)
      }
      setProblems(expanded.slice(0, repCount))
      setDrillSet(ds)
      setProblemIndex(0)
      setPhase('drilling')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setLoadError(
        msg === 'API_KEY_MISSING'
          ? 'API key required to generate drill problems.'
          : 'Could not generate drill problems. Please try again.'
      )
      setPhase('setup')
    }
  }

  async function submitAnswer() {
    const problem = problems[problemIndex]
    if (!problem) return
    stopTimer()
    const correct = llmService.evaluateAnswer(currentAnswer, problem.answer)
    setAnswers(prev => [...prev, { problem, userAnswer: currentAnswer, timeMs: timeElapsed, correct }])
    setShowAnswer(true)
  }

  async function nextProblem() {
    setShowAnswer(false)
    setCurrentAnswer('')
    setTimeElapsed(0)
    if (problemIndex < problems.length - 1) {
      setProblemIndex(i => i + 1)
      if (startTempo !== 'untimed') startTimer()
    } else {
      // Session complete
      const allAnswers = [...answers]
      const correctCount = allAnswers.filter(a => a.correct).length
      const accuracy = allAnswers.length > 0 ? correctCount / allAnswers.length : 0
      const avgTime = allAnswers.length > 0
        ? allAnswers.reduce((s, a) => s + a.timeMs, 0) / allAnswers.length / 1000
        : 0
      setSessionResult({ accuracy, avgTime })
      // Record in history (no gates, no skill status update)
      recordSessionResult({
        skillId: getTargetSkill().id,
        mode: 'force_hanon',
        accuracy,
        avgSolveTime: avgTime,
        gatesPassed: false,
        completedAt: Date.now(),
      })
      setPhase('results')
    }
  }

  const skill = getTargetSkill()
  const currentProblem = problems[problemIndex]
  const timeLimit = drillSet && startTempo !== 'untimed'
    ? startTempo === 'comfortable' ? drillSet.targetSCT * 1.5
    : startTempo === 'target' ? drillSet.targetSCT
    : drillSet.targetSCT * 0.8
    : null
  const recentAnswers = answers
  const recentCorrect = recentAnswers.filter(a => a.correct).length

  // ── Results screen ─────────────────────────────────────────────────────────
  if (phase === 'results' && sessionResult) {
    const correctCount = answers.filter(a => a.correct).length
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
        <SessionSummary
          skillLabel={skill.label}
          accuracy={sessionResult.accuracy}
          avgSolveTime={sessionResult.avgTime}
          targetSCT={drillSet?.targetSCT ?? 60}
          gatesPassed={false}
          accuracyGate={sessionResult.accuracy >= 0.9}
          timeGate={sessionResult.avgTime <= (drillSet?.targetSCT ?? 60)}
          totalProblems={answers.length}
          correctCount={correctCount}
          mode="force_hanon"
          onAction={action => {
            if (action === 'graph') navigate('/graph')
          }}
        />
      </div>
    )
  }

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center gap-3">
        <Loader size={24} className="text-amber-400 animate-spin" />
        <p className="text-[#94a3b8] text-sm">Generating drill problems...</p>
      </div>
    )
  }

  // ── Drilling screen ─────────────────────────────────────────────────────────
  if (phase === 'drilling' && currentProblem) {
    const timeOver = timeLimit !== null && timeElapsed / 1000 > timeLimit
    return (
      <div className="min-h-screen bg-[#0f172a] px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/graph')} className="text-[#475569] hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </button>
            <Zap size={18} className="text-amber-400" />
            <span className="text-white font-semibold">Force Hanon</span>
            <span className="text-[#475569] text-sm">— {skill.label}</span>
            <span className={`ml-auto text-xs font-medium shrink-0 ${TEMPO_LABELS[startTempo].color}`}>
              {TEMPO_LABELS[startTempo].label}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-[#1e293b] rounded-full mb-6 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${((problemIndex + 1) / problems.length) * 100}%` }}
            />
          </div>

          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <span className="text-[#475569] text-sm font-mono">{problemIndex + 1} / {problems.length}</span>
              <div className="flex items-center gap-4">
                {recentAnswers.length > 0 && (
                  <span className={`text-sm font-medium ${recentCorrect / recentAnswers.length >= 0.9 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {recentCorrect}/{recentAnswers.length}
                  </span>
                )}
                {startTempo !== 'untimed' && (
                  <div className="flex items-center gap-1.5">
                    <Timer size={14} className={timeOver ? 'text-red-400' : timerActive ? 'text-amber-400' : 'text-[#475569]'} />
                    <span className={`font-mono text-sm ${timeOver ? 'text-red-400' : 'text-[#94a3b8]'}`}>
                      {(timeElapsed / 1000).toFixed(1)}s
                      {timeLimit && <span className="text-[#475569]"> / {timeLimit.toFixed(0)}s</span>}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#0f172a] rounded-xl p-4 mb-1">
              <ContentRenderer content={currentProblem.prompt} className="text-white font-medium" />
            </div>
            <TempoIndicator
              elapsedMs={timeElapsed}
              targetMs={timeLimit ? timeLimit * 1000 : 0}
            />

            {!showAnswer ? (
              <div className="flex gap-3 mt-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={currentAnswer}
                  onChange={e => setCurrentAnswer(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && currentAnswer.trim() && submitAnswer()}
                  placeholder="Your answer..."
                  className="flex-1 bg-[#0f172a] border border-[#334155] focus:border-amber-500/50 rounded-xl px-4 py-3 text-white placeholder-[#475569] text-sm outline-none"
                />
                <button
                  onClick={submitAnswer}
                  disabled={!currentAnswer.trim()}
                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white px-5 py-3 rounded-xl transition-colors font-medium text-sm"
                >
                  Submit
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <div className={`rounded-xl p-4 mb-4 ${answers[answers.length - 1]?.correct ? 'bg-emerald-950/30 border border-emerald-500/30' : 'bg-red-950/20 border border-red-500/30'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {answers[answers.length - 1]?.correct
                      ? <CheckCircle size={16} className="text-emerald-400" />
                      : <XCircle size={16} className="text-red-400" />}
                    <span className="text-white text-sm font-medium">
                      {answers[answers.length - 1]?.correct ? 'Correct!' : 'Incorrect'}
                    </span>
                    {startTempo !== 'untimed' && (
                      <span className="text-[#64748b] text-xs ml-auto">{(timeElapsed / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  <p className="text-[#94a3b8] text-sm">
                    Answer: <ContentRenderer content={currentProblem.answer} inline className="text-white font-medium" />
                  </p>
                  {!answers[answers.length - 1]?.correct && (
                    <ContentRenderer content={currentProblem.hint} inline className="text-[#64748b] text-xs mt-1 block" />
                  )}
                </div>
                <button
                  onClick={nextProblem}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {problemIndex < problems.length - 1 ? 'Next Problem' : 'Finish Session'}
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Setup screen ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f172a] px-4 py-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate('/graph')} className="text-[#475569] hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <Zap size={18} className="text-amber-400" />
          <span className="text-white font-semibold">Force Hanon</span>
          <span className="text-[#64748b] text-xs ml-1">— bypass the progression tree</span>
        </div>

        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6 space-y-6">

          {/* Skill selector */}
          <div>
            <p className="text-[#94a3b8] text-sm font-medium mb-3">What skill do you want to drill?</p>
            {graph && (
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setUseCustom(false)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${!useCustom ? 'bg-amber-600 border-amber-500 text-white' : 'border-[#334155] text-[#64748b] hover:text-white'}`}
                >
                  From graph
                </button>
                <button
                  onClick={() => setUseCustom(true)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${useCustom ? 'bg-amber-600 border-amber-500 text-white' : 'border-[#334155] text-[#64748b] hover:text-white'}`}
                >
                  Enter manually
                </button>
              </div>
            )}
            {!useCustom && graph ? (
              <select
                value={selectedNodeId}
                onChange={e => setSelectedNodeId(e.target.value)}
                className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber-500/50"
              >
                <option value="">— select a skill —</option>
                {graph.nodes.map(n => (
                  <option key={n.id} value={n.id}>{n.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={customSkill}
                onChange={e => setCustomSkill(e.target.value)}
                placeholder="e.g. destructured assignments, matrix multiplication..."
                className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-3 text-white placeholder-[#475569] text-sm outline-none focus:border-amber-500/50"
              />
            )}
          </div>

          {/* Starting tempo */}
          <div>
            <p className="text-[#94a3b8] text-sm font-medium mb-3">Starting tempo</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TEMPO_STAGES.map(t => (
                <button
                  key={t}
                  onClick={() => setStartTempo(t)}
                  className={`text-xs py-2 px-3 rounded-lg border transition-colors ${
                    startTempo === t
                      ? `${TEMPO_LABELS[t].color} border-current bg-opacity-10`
                      : 'border-[#334155] text-[#64748b] hover:text-white'
                  }`}
                >
                  {TEMPO_LABELS[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Rep count */}
          <div>
            <p className="text-[#94a3b8] text-sm font-medium mb-3">Rep count</p>
            <div className="flex gap-2">
              {([5, 10, 15, 20] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setRepCount(n)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                    repCount === n
                      ? 'bg-amber-600 border-amber-500 text-white font-medium'
                      : 'border-[#334155] text-[#64748b] hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Variation mode */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#94a3b8] text-sm font-medium">Variation mode</p>
              <p className="text-[#475569] text-xs mt-0.5">Rotate through symbolic, numeric, inverse, applied, and standard variants</p>
            </div>
            <button
              onClick={() => setVariationMode(v => !v)}
              className={`w-12 h-6 rounded-full transition-colors relative ${variationMode ? 'bg-amber-600' : 'bg-[#334155]'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${variationMode ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          {loadError && <p className="text-red-400 text-sm">{loadError}</p>}

          <button
            onClick={handleStart}
            disabled={(!useCustom && !selectedNodeId && !!graph) || (useCustom && !customSkill.trim())}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Zap size={18} />
            Start Drill →
          </button>
        </div>
      </div>
    </div>
  )
}
