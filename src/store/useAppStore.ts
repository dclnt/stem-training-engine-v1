import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SkillGraph, SkillNode, SessionResult, MasteryRecord, AppSettings, DepthLevel } from '../types'

interface AppState {
  graphs: SkillGraph[]
  activeGraphId: string | null
  sessionHistory: SessionResult[]
  activeSkillId: string | null
  appSettings: AppSettings

  addGraph: (graph: SkillGraph) => void
  setActiveGraph: (id: string) => void
  setActiveSkill: (id: string | null) => void
  setDepthLevel: (level: DepthLevel) => void
  recordSessionResult: (result: SessionResult) => void
  updateSkillStatus: (graphId: string, skillId: string, updates: Partial<SkillNode>) => void
  getActiveGraph: () => SkillGraph | null
  getActiveSkill: () => SkillNode | null
  getMasteryRecord: (skillId: string) => MasteryRecord | null
  getAvailableSkills: () => SkillNode[]
  traceRegression: (graphId: string, skillId: string) => SkillNode | null
  removeGraph: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      graphs: [],
      activeGraphId: null,
      sessionHistory: [],
      activeSkillId: null,
      appSettings: { depthLevel: 'intermediate' },

      addGraph: (graph) =>
        // Replace the entire graphs array — each new upload is a fresh session.
        // Prevents old Python/Calculus/unrelated graphs from polluting the current session.
        set({ graphs: [graph], activeGraphId: graph.id, activeSkillId: null }),

      setActiveGraph: (id) => set({ activeGraphId: id, activeSkillId: null }),

      setActiveSkill: (id) => set({ activeSkillId: id }),

      setDepthLevel: (level) => set(s => ({ appSettings: { ...s.appSettings, depthLevel: level } })),

      removeGraph: (id) =>
        set(s => ({
          graphs: s.graphs.filter(g => g.id !== id),
          activeGraphId: s.activeGraphId === id
            ? (s.graphs.find(g => g.id !== id)?.id ?? null)
            : s.activeGraphId,
        })),

      recordSessionResult: (result) => {
        set(s => ({ sessionHistory: [result, ...s.sessionHistory] }))
        const { graphs, activeGraphId } = get()
        if (!activeGraphId) return
        set(s => ({
          graphs: s.graphs.map(g => {
            if (g.id !== activeGraphId) return g
            return {
              ...g,
              nodes: g.nodes.map(n => {
                if (n.id !== result.skillId) return n
                const masteryData: MasteryRecord = {
                  skillId: result.skillId,
                  attempts: (n.masteryData?.attempts ?? 0) + 1,
                  lastAccuracy: result.accuracy,
                  bestTime: result.avgSolveTime < (n.masteryData?.bestTime ?? Infinity)
                    ? result.avgSolveTime
                    : (n.masteryData?.bestTime ?? result.avgSolveTime),
                  gatesPassed: result.gatesPassed,
                  passedAt: result.gatesPassed ? result.completedAt : (n.masteryData?.passedAt ?? null),
                }
                const newStatus = result.gatesPassed ? 'mastered' : 'in_progress'
                return { ...n, status: newStatus, masteryData }
              }),
            }
          }),
        }))
        if (result.gatesPassed) {
          set(s => ({
            graphs: s.graphs.map(g => {
              if (g.id !== activeGraphId) return g
              const updatedNodes = g.nodes
              return {
                ...g,
                nodes: updatedNodes.map(n => {
                  if (n.status !== 'locked') return n
                  const prereqsMet = n.prerequisites.every(pid => {
                    const prereq = updatedNodes.find(x => x.id === pid)
                    return prereq?.status === 'mastered'
                  })
                  return prereqsMet ? { ...n, status: 'available' } : n
                }),
              }
            }),
          }))
        }
      },

      updateSkillStatus: (graphId, skillId, updates) =>
        set(s => ({
          graphs: s.graphs.map(g => {
            if (g.id !== graphId) return g
            return {
              ...g,
              nodes: g.nodes.map(n => (n.id === skillId ? { ...n, ...updates } : n)),
            }
          }),
        })),

      getActiveGraph: () => {
        const { graphs, activeGraphId } = get()
        return graphs.find(g => g.id === activeGraphId) ?? null
      },

      getActiveSkill: () => {
        const graph = get().getActiveGraph()
        if (!graph) return null
        return graph.nodes.find(n => n.id === get().activeSkillId) ?? null
      },

      getMasteryRecord: (skillId) => {
        const graph = get().getActiveGraph()
        return graph?.nodes.find(n => n.id === skillId)?.masteryData ?? null
      },

      getAvailableSkills: () => {
        const graph = get().getActiveGraph()
        return graph?.nodes.filter(n => n.status === 'available' || n.status === 'in_progress') ?? []
      },

      traceRegression: (graphId, failedSkillId) => {
        const graph = get().graphs.find(g => g.id === graphId)
        if (!graph) return null
        const failed = graph.nodes.find(n => n.id === failedSkillId)
        if (!failed || failed.prerequisites.length === 0) return null
        for (const prereqId of failed.prerequisites) {
          const prereq = graph.nodes.find(n => n.id === prereqId)
          if (prereq && prereq.masteryData?.gatesPassed !== true) return prereq
        }
        return null
      },
    }),
    { name: 'stem-training-store' }
  )
)
