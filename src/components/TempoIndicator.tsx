interface TempoIndicatorProps {
  elapsedMs: number
  targetMs: number  // 0 = untimed — render nothing
}

export default function TempoIndicator({ elapsedMs, targetMs }: TempoIndicatorProps) {
  if (!targetMs) return null

  const pct = Math.min((elapsedMs / targetMs) * 100, 100)
  const colorClass =
    pct < 70 ? 'bg-emerald-500' :
    pct < 90 ? 'bg-amber-400' :
    'bg-red-500'

  return (
    <div className="mt-3 mb-1">
      <div className="h-1.5 w-full bg-[#0f172a] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-100 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-right text-[#475569] text-xs mt-1">
        {(elapsedMs / 1000).toFixed(1)}s
        <span className="text-[#334155]"> / target {(targetMs / 1000).toFixed(0)}s</span>
      </p>
    </div>
  )
}
