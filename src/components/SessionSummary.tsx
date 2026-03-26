import { useState } from 'react'
import { CheckCircle, XCircle, ChevronDown, ChevronUp, ArrowRight, RotateCcw, LayoutGrid } from 'lucide-react'

export interface SessionSummaryProps {
  skillLabel: string
  accuracy: number        // 0–1
  avgSolveTime: number    // seconds
  targetSCT: number       // seconds
  gatesPassed: boolean
  accuracyGate: boolean
  timeGate: boolean
  totalProblems: number
  correctCount: number
  mode: 'drill' | 'advance' | 'force_hanon'
  onAction: (action: 'retry' | 'graph' | 'next') => void
  nextSkillLabel?: string
}

function howItWent(accuracyGate: boolean, timeGate: boolean): string {
  if (accuracyGate && timeGate) return 'Strong session — accuracy and speed both cleared.'
  if (accuracyGate && !timeGate) return 'Accuracy is solid, but speed needs more reps.'
  if (!accuracyGate && timeGate) return 'Fast, but accuracy needs work. Slow down and focus on correctness.'
  return 'More practice needed. Try again at a slower pace.'
}

function whatNext(gatesPassed: boolean, mode: string, nextSkillLabel?: string): string {
  if (mode === 'force_hanon') return 'Return to your skill graph.'
  if (gatesPassed && nextSkillLabel) return `Move on to "${nextSkillLabel}".`
  if (gatesPassed) return "You've unlocked the next skill in the graph."
  return 'Run it again to improve — or drill a prerequisite if speed is the issue.'
}

export default function SessionSummary({
  skillLabel,
  accuracy,
  avgSolveTime,
  targetSCT,
  gatesPassed,
  accuracyGate,
  timeGate,
  totalProblems,
  correctCount,
  mode,
  onAction,
  nextSkillLabel,
}: SessionSummaryProps) {
  const [showTech, setShowTech] = useState(false)

  const modeLabel = mode === 'force_hanon' ? 'Force Hanon' : mode === 'advance' ? 'Advance' : 'Drill'
  const accentClass = gatesPassed
    ? 'bg-emerald-950/30 border-emerald-500/30'
    : mode === 'force_hanon'
    ? 'bg-blue-950/30 border-blue-500/30'
    : 'bg-amber-950/20 border-amber-500/30'

  return (
    <div className="max-w-md w-full mx-auto">
      {/* Plain-language front */}
      <div className={`rounded-2xl border p-6 mb-4 ${accentClass}`}>
        {gatesPassed
          ? <CheckCircle size={36} className="text-emerald-400 mx-auto mb-4" />
          : mode === 'force_hanon'
          ? <CheckCircle size={36} className="text-blue-400 mx-auto mb-4" />
          : <XCircle size={36} className="text-amber-400 mx-auto mb-4" />}

        <div className="space-y-3">
          <div>
            <p className="text-[#64748b] text-xs uppercase tracking-widest mb-0.5">What you trained</p>
            <p className="text-white font-semibold">{skillLabel}</p>
          </div>
          <div>
            <p className="text-[#64748b] text-xs uppercase tracking-widest mb-0.5">How it went</p>
            <p className="text-[#cbd5e1] text-sm">{howItWent(accuracyGate, timeGate)}</p>
          </div>
          <div>
            <p className="text-[#64748b] text-xs uppercase tracking-widest mb-0.5">What's next</p>
            <p className="text-[#cbd5e1] text-sm">{whatNext(gatesPassed, mode, nextSkillLabel)}</p>
          </div>
        </div>
      </div>

      {/* Technical toggle */}
      <button
        onClick={() => setShowTech(v => !v)}
        className="w-full flex items-center justify-between text-[#64748b] hover:text-[#94a3b8] text-xs px-3 py-2 rounded-xl border border-[#1e293b] hover:border-[#334155] transition-colors mb-3"
      >
        <span>Technical details</span>
        {showTech ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showTech && (
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4 mb-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-[#64748b]">Accuracy</span>
            <span className="text-white font-mono">{correctCount}/{totalProblems} ({Math.round(accuracy * 100)}%)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748b]">Avg solve time</span>
            <span className="text-white font-mono">{avgSolveTime.toFixed(1)}s vs. target {targetSCT}s</span>
          </div>
          {mode !== 'force_hanon' && (
            <>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Accuracy gate (≥90%)</span>
                {accuracyGate
                  ? <span className="text-emerald-400">✓ Passed</span>
                  : <span className="text-red-400">✗ Failed</span>}
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Speed gate (≤SCT)</span>
                {timeGate
                  ? <span className="text-emerald-400">✓ Passed</span>
                  : <span className="text-red-400">✗ Failed</span>}
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className="text-[#64748b]">Mode</span>
            <span className="text-[#94a3b8]">{modeLabel}</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => onAction('graph')}
          className="flex-1 flex items-center justify-center gap-1.5 border border-[#334155] text-[#94a3b8] hover:text-white py-2.5 rounded-xl text-sm transition-colors"
        >
          <LayoutGrid size={14} />
          {mode === 'force_hanon' ? 'Back to Graph' : 'View Graph'}
        </button>
        {mode !== 'force_hanon' && (
          <button
            onClick={() => onAction('retry')}
            className="flex-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <RotateCcw size={14} />
            {gatesPassed ? 'Drill Again' : 'Try Again'}
          </button>
        )}
        {gatesPassed && mode !== 'force_hanon' && nextSkillLabel && (
          <button
            onClick={() => onAction('next')}
            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Next
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
