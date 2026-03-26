export type SkillStatus = 'locked' | 'available' | 'in_progress' | 'mastered'
export type SessionMode = 'learn' | 'drill' | 'advance' | 'force_hanon'
export type DepthLevel = 'beginner' | 'intermediate' | 'advanced' | 'graduate'

export interface AppSettings {
  depthLevel: DepthLevel
}
export type DrillPhase = 'isolated' | 'speed_ramp' | 'chaining' | 'variation'
export type CAPhase =
  | 'overview'
  | 'modeling'
  | 'diagnostic'
  | 'coaching'
  | 'articulation'
  | 'reflection'
  | 'exploration'

export interface SkillNode {
  id: string
  label: string
  description: string
  prerequisites: string[]
  status: SkillStatus
  masteryData: MasteryRecord | null
  estimatedSCT: number // seconds
  depth: number
  x?: number
  y?: number
}

export interface SkillGraph {
  id: string
  sourceTitle: string
  sourceType: 'youtube' | 'url' | 'file' | 'text'
  sourceSummary: string
  sourceContent?: string   // first ~2000 chars of the user's original material; used to anchor Learn/Drill to the correct domain
  nodes: SkillNode[]
  createdAt: number
}

export interface MasteryRecord {
  skillId: string
  attempts: number
  lastAccuracy: number
  bestTime: number | null
  gatesPassed: boolean
  passedAt: number | null
}

export interface DrillProblem {
  id: string
  skillId: string
  prompt: string
  answer: string
  hint: string
  variationType: 'standard' | 'symbolic' | 'numeric' | 'inverse' | 'applied'
  targetSeconds: number
}

export interface SessionResult {
  skillId: string
  mode: SessionMode
  accuracy: number
  avgSolveTime: number
  gatesPassed: boolean
  completedAt: number
}

export interface CAContent {
  overview: string
  workedExample: string
  expertAnnotations: string[]
  coachingHints: string[]
  articulationPrompt: string
  reflectionComparison: string
  explorationSeed: string
}

export interface DrillSet {
  problems: DrillProblem[]
  chainingProblems: DrillProblem[]
  targetSCT: number
  tempoStages: number[]
}

export interface SourceInput {
  type: 'youtube' | 'url' | 'file' | 'text'
  value: string
  filename?: string
  fileContent?: string  // actual text from FileReader or OCR; used by topic detection + Claude
}
