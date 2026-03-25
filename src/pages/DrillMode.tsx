import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, ArrowLeft, Timer, ChevronRight, Loader, CheckCircle, XCircle, Link2, Shuffle } from 'lucide-react'
import { llmService } from '../services/llmService'
import { useAppStore } from '../store/useAppStore'
import type { DrillSet, DrillProblem } from '../types'
import ContentRenderer from '../components/ContentRenderer'

type DrillPhase = 'isolated' | 'speed_ramp' | 'chaining' | 'results'
type TempoStage = 'untimed' | 'comfortable' | 'target' | 'fluency'

const TEMPO_LABELS: Record<TempoStage, { label: string; color: string; desc: string }> = {
  untimed: { label: 'Untimed', color: 'text-blue-400', desc: 'Focus on accuracy — no time pressure' },
  comfortable: { label: 'Comfortable Pace', color: 'text-amber-400', desc: 'Relaxed time limit' },
  target: { label: 'Target Tempo', color: 'text-orange-400', desc: 'Match the standard completion time' },
  fluency: { label: 'Fluency Pace', color: 'text-red-400', desc: 'Push for maximum speed + accuracy' },
}

const TEMPO_STAGES: TempoStage[] = ['untimed', 'comfortable', 'target', 'fluency']

interface Answer {
  problem: DrillProblem
  userAnswer: string
  timeMs: number
  correct: boolean
}

export default function DrillMode() {
  const navigate = useNavigate()
  const { getActiveSkill, getActiveGraph, recordSessionResult } = useAppStore()
  const skill = getActiveSkill()
  const graph = getActiveGraph()

  const [drillSet, setDrillSet] = useState<DrillSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [phase, setPhase] = useState<DrillPhase>('isolated')
  const [tempoStage, setTempoStage] = useState<TempoStage>('untimed')
  const [tempoStageIndex, setTempoStageIndex] = useState(0)
  const [problemIndex, setProblemIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>()
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [sessionAnswers, setSessionAnswers] = useState<{ problem: DrillProblem; userAnswer: string; timeMs: number }[]>([])
  const [sessionResult, setSessionResult] = useState<{ accuracy: number; avgTime: number; gatesPassed: boolean } | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!skill || !graph) return
    setLoadError(null)
    setLoading(true)
    const prevNode = skill.prerequisites[0]
      ? graph.nodes.find(n => n.id === skill.prerequisites[0]) ?? null
      : null
    const sourceContext = [
      `SUBJECT: ${graph.sourceTitle}`,
      `SUMMARY: ${graph.sourceSummary}`,
      graph.sourceContent ? `SOURCE EXCERPT (match this domain exactly):\n${graph.sourceContent.slice(0, 1200)}` : '',
    ].filter(Boolean).join('\n')
    llmService.generateDrillSet(skill, prevNode, sourceContext)
      .then(ds => { setDrillSet(ds); setLoading(false) })
      .catch(err => {
        const msg = err instanceof Error ? err.message : ''
        setLoadError(
          msg === 'API_KEY_MISSING'
            ? 'An API key is required to generate drill problems. Add VITE_ANTHROPIC_API_KEY to your environment.'
            : 'Could not generate drill problems for this skill. Please try again.'
        )
        setLoading(false)
      })
  }, [skill, graph, retryKey])

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
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    if (!loading && drillSet) {
      if (tempoStage !== 'untimed') startTimer()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [loading, problemIndex, phase, tempoStage, drillSet, startTimer])

  if (!skill) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <p className="text-[#94a3b8]">No skill selected.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center gap-3">
        <Loader size={24} className="text-amber-400 animate-spin" />
        <p className="text-[#94a3b8] text-sm">Generating drill problems...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#1e293b] border border-red-500/30 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <XCircle size={24} className="text-red-400" />
          </div>
          <h2 className="text-white font-semibold text-lg mb-2">Drill Problems Unavailable</h2>
          <p className="text-[#94a3b8] text-sm mb-6">{loadError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/graph')}
              className="border border-[#334155] text-[#94a3b8] hover:text-white px-4 py-2 rounded-xl transition-colors text-sm"
            >
              Back to Graph
            </button>
            <button
              onClick={() => setRetryKey(k => k + 1)}
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!drillSet) return null

  const currentProblems = phase === 'chaining'
    ? [...drillSet.problems.slice(0, 5), ...drillSet.chainingProblems.slice(0, 5)]
    : drillSet.problems

  const currentProblem = currentProblems[problemIndex]
  const targetTime = currentProblem?.targetSeconds ?? drillSet.targetSCT

  const timeLimit = tempoStage === 'untimed' ? null
    : tempoStage === 'comfortable' ? targetTime * 1.5
    : tempoStage === 'target' ? targetTime
    : targetTime * 0.8

  const timeOver = timeLimit !== null && timeElapsed / 1000 > timeLimit

  async function submitAnswer() {
    if (!currentProblem) return
    stopTimer()
    const correct = llmService.evaluateAnswer(currentAnswer, currentProblem.answer)
    const entry = { problem: currentProblem, userAnswer: currentAnswer, timeMs: timeElapsed }
    setAnswers(prev => [...(prev ?? []), { ...entry, correct }])
    setSessionAnswers(prev => [...prev, entry])
    setShowAnswer(true)
  }

  async function nextProblem() {
    setShowAnswer(false)
    setCurrentAnswer('')
    setTimeElapsed(0)

    if (problemIndex < currentProblems.length - 1) {
      setProblemIndex(i => i + 1)
      if (tempoStage !== 'untimed') startTimer()
    } else {
      if (phase === 'isolated' && tempoStageIndex < TEMPO_STAGES.length - 1) {
        const nextStageIndex = tempoStageIndex + 1
        setTempoStageIndex(nextStageIndex)
        setTempoStage(TEMPO_STAGES[nextStageIndex])
        setProblemIndex(0)
        setAnswers([])
      } else if (phase === 'isolated' && drillSet!.chainingProblems.length > 0) {
        setPhase('chaining')
        setProblemIndex(0)
        setAnswers([])
        startTimer()
      } else {
        await finishSession()
      }
    }
  }

  async function finishSession() {
    const result = await llmService.evaluateSession(skill!.id, sessionAnswers)
    setSessionResult({ accuracy: result.accuracy, avgTime: result.avgSolveTime, gatesPassed: result.gatesPassed })
    recordSessionResult(result)
    setPhase('results')
  }

  if (phase === 'results' && sessionResult) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className={`rounded-2xl border p-6 mb-4 ${sessionResult.gatesPassed ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-amber-950/20 border-amber-500/30'}`}>
            {sessionResult.gatesPassed
              ? <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
              : <XCircle size={40} className="text-amber-400 mx-auto mb-3" />}
            <h2 className="text-white text-xl font-bold text-center mb-1">
              {sessionResult.gatesPassed ? 'Mastery Gates Passed!' : 'Keep Drilling'}
            </h2>
            <p className="text-[#94a3b8] text-sm text-center mb-4">
              {sessionResult.gatesPassed
                ? 'Both accuracy ≥90% and time ≤ SCT achieved. This skill is mastered.'
                : 'Practice more to reach both accuracy and speed thresholds.'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0f172a] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{Math.round(sessionResult.accuracy * 100)}%</p>
                <p className="text-[#64748b] text-xs">Accuracy</p>
                <p className="text-xs mt-1">{sessionResult.accuracy >= 0.9 ? <span className="text-emerald-400">✓ Gate passed</span> : <span className="text-red-400">✗ Need ≥90%</span>}</p>
              </div>
              <div className="bg-[#0f172a] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{sessionResult.avgTime.toFixed(1)}s</p>
                <p className="text-[#64748b] text-xs">Avg. Time</p>
                <p className="text-xs mt-1">{sessionResult.avgTime <= drillSet.targetSCT ? <span className="text-emerald-400">✓ Gate passed</span> : <span className="text-red-400">✗ Need ≤{drillSet.targetSCT}s</span>}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/graph')} className="flex-1 border border-[#334155] text-[#94a3b8] hover:text-white py-2.5 rounded-xl text-sm transition-colors">Back to Graph</button>
            <button onClick={() => { setPhase('isolated'); setTempoStageIndex(0); setTempoStage('untimed'); setProblemIndex(0); setAnswers([]); setSessionAnswers([]); setSessionResult(null) }} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">Drill Again</button>
          </div>
        </div>
      </div>
    )
  }

  const answersArr = answers ?? []
  const recentCorrect = answersArr.filter(a => a.correct).length
  const recentTotal = answersArr.length
  const tempoInfo = TEMPO_LABELS[tempoStage]

  return (
    <div className="min-h-screen bg-[#0f172a] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/graph')} className="text-[#475569] hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <Zap size={18} className="text-amber-400" />
          <span className="text-white font-semibold">Drill Mode</span>
          <span className="text-[#475569] text-sm">— {skill.label}</span>
          {phase === 'chaining' && (
            <span className="ml-auto flex items-center gap-1 text-xs text-blue-400 bg-blue-950/30 border border-blue-500/30 px-2 py-1 rounded-full">
              <Link2 size={10} />
              Chaining
            </span>
          )}
        </div>

        <div className="flex gap-2 items-center mb-4">
          {TEMPO_STAGES.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i < tempoStageIndex ? 'bg-emerald-500' : i === tempoStageIndex ? 'bg-amber-400' : 'bg-[#1e293b]'
              }`}
            />
          ))}
          <span className={`text-xs font-medium shrink-0 ${tempoInfo.color}`}>{tempoInfo.label}</span>
        </div>

        <p className="text-[#64748b] text-xs mb-5">{tempoInfo.desc}</p>

        {currentProblem && (
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className="text-[#475569] text-sm font-mono">
                  {problemIndex + 1} / {currentProblems.length}
                </span>
                {phase === 'chaining' && (
                  <span className="flex items-center gap-1 text-xs text-blue-400">
                    <Shuffle size={10} />
                    {currentProblem.skillId !== skill.id ? 'Prerequisite skill' : 'Current skill'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                {recentTotal > 0 && (
                  <span className={`text-sm font-medium ${recentCorrect / recentTotal >= 0.9 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {recentCorrect}/{recentTotal}
                  </span>
                )}
                {tempoStage !== 'untimed' && (
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

            <div className="bg-[#0f172a] rounded-xl p-4 mb-5">
              <ContentRenderer content={currentProblem.prompt} className="text-white font-medium" />
            </div>

            {!showAnswer ? (
              <div className="flex gap-3">
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
              <div>
                <div className={`rounded-xl p-4 mb-4 ${answersArr[answersArr.length - 1]?.correct ? 'bg-emerald-950/30 border border-emerald-500/30' : 'bg-red-950/20 border border-red-500/30'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {answersArr[answersArr.length - 1]?.correct
                      ? <CheckCircle size={16} className="text-emerald-400" />
                      : <XCircle size={16} className="text-red-400" />}
                    <span className="text-white text-sm font-medium">
                      {answersArr[answersArr.length - 1]?.correct ? 'Correct!' : 'Incorrect'}
                    </span>
                    {tempoStage !== 'untimed' && (
                      <span className="text-[#64748b] text-xs ml-auto">{(timeElapsed / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  <p className="text-[#94a3b8] text-sm">
                    Answer:{' '}
                    <ContentRenderer content={currentProblem.answer} inline className="text-white font-medium" />
                  </p>
                  {!answersArr[answersArr.length - 1]?.correct && (
                    <ContentRenderer content={currentProblem.hint} inline className="text-[#64748b] text-xs mt-1 block" />
                  )}
                </div>
                <button
                  onClick={nextProblem}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  Next Problem
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
