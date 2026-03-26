import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, ArrowLeft, Timer, CheckCircle, XCircle, Loader, AlertTriangle, ArrowRight } from 'lucide-react'
import { llmService } from '../services/llmService'
import { useAppStore } from '../store/useAppStore'
import type { DrillProblem, DrillSet } from '../types'
import SessionSummary from '../components/SessionSummary'

type AdvancePhase = 'diagnostic' | 'assessment' | 'passed' | 'failed' | 'regressing'

interface Answer { problem: DrillProblem; userAnswer: string; timeMs: number; correct: boolean }

export default function AdvanceMode() {
  const navigate = useNavigate()
  const { getActiveSkill, getActiveGraph, recordSessionResult, traceRegression, setActiveSkill, appSettings } = useAppStore()
  const skill = getActiveSkill()
  const graph = getActiveGraph()

  const [drillSet, setDrillSet] = useState<DrillSet | null>(null)
  const [phase, setPhase] = useState<AdvancePhase>('diagnostic')
  const [loading, setLoading] = useState(true)
  const [problemIndex, setProblemIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [regressionTarget, setRegressionTarget] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!skill || !graph) return
    const prevNode = skill.prerequisites[0]
      ? graph.nodes.find(n => n.id === skill.prerequisites[0]) ?? null
      : null
    const sourceContext = graph ? `${graph.sourceTitle}: ${graph.sourceSummary}` : undefined
    llmService.generateDrillSet(skill, prevNode, sourceContext, appSettings?.depthLevel ?? 'intermediate').then(ds => {
      setDrillSet(ds)
      setLoading(false)
      startTimer()
    })
  }, [skill, graph])

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

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  useEffect(() => {
    if (phase === 'assessment' && !loading && drillSet) {
      startTimer()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [problemIndex, phase, loading, drillSet, startTimer])

  if (!skill || !graph) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <p className="text-[#94a3b8]">No skill selected.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center gap-3">
        <Loader size={24} className="text-emerald-400 animate-spin" />
        <p className="text-[#94a3b8] text-sm">Preparing mastery assessment...</p>
      </div>
    )
  }

  if (!drillSet) return null

  const assessmentProblems = [
    ...drillSet.problems.slice(0, 5),
    ...drillSet.chainingProblems.slice(0, 3),
  ]

  const currentProblem = assessmentProblems[problemIndex]
  const timeLimit = drillSet.targetSCT

  async function submitAnswer() {
    if (!currentProblem) return
    stopTimer()
    const correct = llmService.evaluateAnswer(currentAnswer, currentProblem.answer)
    setAnswers(prev => [...prev, { problem: currentProblem, userAnswer: currentAnswer, timeMs: timeElapsed, correct }])
    setShowAnswer(true)
  }

  async function nextProblem() {
    setShowAnswer(false)
    setCurrentAnswer('')
    setTimeElapsed(0)
    if (problemIndex < assessmentProblems.length - 1) {
      setProblemIndex(i => i + 1)
    } else {
      await finalizeAssessment()
    }
  }

  async function finalizeAssessment() {
    const allAnswers = [...answers]
    const result = await llmService.evaluateSession(skill!.id, allAnswers.map(a => ({ problem: a.problem, userAnswer: a.userAnswer, timeMs: a.timeMs })))
    recordSessionResult(result)
    if (result.gatesPassed) {
      setPhase('passed')
    } else {
      const regNode = traceRegression(graph!.id, skill!.id)
      setRegressionTarget(regNode?.id ?? null)
      setPhase('failed')
    }
  }

  const correct = answers.filter(a => a.correct).length
  const total = answers.length
  const accuracy = total > 0 ? correct / total : 0

  if (phase === 'diagnostic') {
    return (
      <div className="min-h-screen bg-[#0f172a] px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => navigate('/graph')} className="text-[#475569] hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </button>
            <TrendingUp size={18} className="text-emerald-400" />
            <span className="text-white font-semibold">Advance Mode</span>
            <span className="text-[#475569] text-sm">— {skill.label}</span>
          </div>
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <TrendingUp size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-white text-xl font-bold mb-2">Mastery Gate Assessment</h2>
            <p className="text-[#94a3b8] text-sm mb-6 max-w-sm mx-auto">
              You'll answer {assessmentProblems.length} problems under time pressure. Both gates must pass to advance:
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6 max-w-sm mx-auto text-left">
              <div className="bg-[#0f172a] rounded-xl p-4">
                <p className="text-emerald-400 font-bold text-lg">≥ 90%</p>
                <p className="text-[#64748b] text-xs">Accuracy gate</p>
              </div>
              <div className="bg-[#0f172a] rounded-xl p-4">
                <p className="text-emerald-400 font-bold text-lg">≤ {drillSet.targetSCT}s</p>
                <p className="text-[#64748b] text-xs">Speed gate (avg)</p>
              </div>
            </div>
            {skill.prerequisites.length > 0 && (
              <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 mb-6 text-sm text-amber-300 max-w-sm mx-auto">
                This assessment includes prerequisite skills: <strong>{skill.prerequisites.join(', ')}</strong>
              </div>
            )}
            <button
              onClick={() => setPhase('assessment')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors flex items-center gap-2 mx-auto"
            >
              Start Assessment
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'passed' || phase === 'failed') {
    const avgTime = answers.length > 0 ? answers.reduce((s, a) => s + a.timeMs, 0) / answers.length / 1000 : 0
    const accuracyGate = accuracy >= 0.9
    const timeGate = avgTime <= drillSet.targetSCT
    const nextNode = graph.nodes.find(n => n.prerequisites.includes(skill.id) && n.status === 'available')
    const regrNode = regressionTarget ? graph.nodes.find(n => n.id === regressionTarget) : null
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4 gap-4">
        <SessionSummary
          skillLabel={skill.label}
          accuracy={accuracy}
          avgSolveTime={avgTime}
          targetSCT={drillSet.targetSCT}
          gatesPassed={phase === 'passed'}
          accuracyGate={accuracyGate}
          timeGate={timeGate}
          totalProblems={answers.length}
          correctCount={answers.filter(a => a.correct).length}
          mode="advance"
          nextSkillLabel={nextNode?.label}
          onAction={action => {
            if (action === 'graph') navigate('/graph')
            else if (action === 'retry') { setPhase('diagnostic'); setProblemIndex(0); setAnswers([]) }
            else if (action === 'next' && nextNode) { setActiveSkill(nextNode.id); navigate('/session/advance') }
          }}
        />
        {regrNode && (
          <div className="max-w-md w-full bg-blue-950/30 border border-blue-500/20 rounded-xl p-4 text-sm">
            <p className="text-blue-400 font-medium mb-1">Adaptive Regression Detected</p>
            <p className="text-[#94a3b8] mb-3">Prerequisite gap: <strong className="text-white">{regrNode.label}</strong>. Drill this first.</p>
            <button
              onClick={() => { setActiveSkill(regrNode.id); navigate('/session/drill') }}
              className="bg-amber-600 hover:bg-amber-500 text-white text-sm px-4 py-2 rounded-xl transition-colors"
            >
              Drill {regrNode.label}
            </button>
          </div>
        )}
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
          <TrendingUp size={18} className="text-emerald-400" />
          <span className="text-white font-semibold">Advance Mode</span>
          <span className="ml-auto text-[#475569] text-sm">{problemIndex + 1} / {assessmentProblems.length}</span>
        </div>

        <div className="h-1.5 bg-[#1e293b] rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-blue-500 rounded-full transition-all"
            style={{ width: `${((problemIndex) / assessmentProblems.length) * 100}%` }}
          />
        </div>

        {currentProblem && (
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="text-sm text-[#64748b]">
                Skill: <span className="text-[#94a3b8]">{currentProblem.skillId}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Timer size={14} className={timerActive ? 'text-emerald-400' : 'text-[#475569]'} />
                <span className={`font-mono text-sm ${timeElapsed / 1000 > timeLimit ? 'text-red-400' : 'text-[#94a3b8]'}`}>
                  {(timeElapsed / 1000).toFixed(1)}s
                  <span className="text-[#475569]"> / {timeLimit}s</span>
                </span>
              </div>
            </div>

            <div className="bg-[#0f172a] rounded-xl p-4 mb-5">
              <p className="text-white font-medium">{currentProblem.prompt}</p>
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
                  className="flex-1 bg-[#0f172a] border border-[#334155] focus:border-emerald-500/50 rounded-xl px-4 py-3 text-white placeholder-[#475569] text-sm outline-none"
                />
                <button
                  onClick={submitAnswer}
                  disabled={!currentAnswer.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-5 py-3 rounded-xl transition-colors font-medium text-sm"
                >
                  Submit
                </button>
              </div>
            ) : (
              <div>
                <div className={`rounded-xl p-4 mb-4 ${answers[answers.length - 1]?.correct ? 'bg-emerald-950/30 border border-emerald-500/30' : 'bg-red-950/20 border border-red-500/30'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {answers[answers.length - 1]?.correct
                      ? <CheckCircle size={16} className="text-emerald-400" />
                      : <XCircle size={16} className="text-red-400" />}
                    <span className="text-white text-sm font-medium">
                      {answers[answers.length - 1]?.correct ? 'Correct' : 'Incorrect'}
                    </span>
                    <span className="text-[#64748b] text-xs ml-auto">{(timeElapsed / 1000).toFixed(1)}s</span>
                  </div>
                  <p className="text-[#94a3b8] text-sm">Answer: <span className="text-white">{currentProblem.answer}</span></p>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[#64748b] text-xs">{answers.filter(a => a.correct).length}/{answers.length} correct so far</span>
                </div>
                <button
                  onClick={nextProblem}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {problemIndex < assessmentProblems.length - 1 ? 'Next Problem' : 'See Results'}
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
