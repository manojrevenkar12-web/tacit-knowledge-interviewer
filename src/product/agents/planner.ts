import type { ExpertProfile, TopicProfile } from '../../wire.ts'
import type { KnowledgeGraph } from '../pipeline/graph.ts'

export interface PlannerSettings {
  sessionsPerExpertMax: number
  priorPerTopic: number
  stayFactor: number
}

export interface Session {
  expert: string
  focus: string[]
  why: string
}

/** How soon an expert's knowledge walks out of the door. */
export function urgency(e: ExpertProfile): number {
  return e.leavesInMonths === null ? 0.5 : 12 / (e.leavesInMonths + 2)
}

/**
 * Knowledge at risk: for each expert and topic, how much is probably still in their head (a prior, less what the
 * graph already holds from them, less again for topics already worked through), weighted by how soon they leave and
 * whether the customer marked the topic as critical. The next session goes where the most is at stake.
 */
export function atRisk(experts: ExpertProfile[], topics: TopicProfile[], graph: KnowledgeGraph, done: Session[], s: PlannerSettings) {
  const focused = (e: string, t: string) => done.some((d) => d.expert === e && d.focus.includes(t))
  const cov = graph.coverage()
  const rows: { expert: string; topic: string; risk: number; remaining: number }[] = []
  for (const e of experts) {
    for (const t of e.topics) {
      const captured = [...(cov.get(e.id)?.get(t) ?? [])].length
      const claims = graph.live().filter((c) => c.expert === e.id && c.topic === t).length
      // A topic that was the focus of a session still holds some: tacit knowledge comes out to the questions not yet asked.
      const seen = focused(e.id, t) ? s.stayFactor : 1
      const remaining = Math.max(0, s.priorPerTopic - claims) * seen * (captured >= 5 ? 0.5 : 1)
      const crit = topics.find((x) => x.id === t)?.critical ? 1.5 : 1
      rows.push({ expert: e.id, topic: t, risk: urgency(e) * crit * remaining, remaining })
    }
  }
  return rows.sort((a, b) => b.risk - a.risk || a.expert.localeCompare(b.expert) || a.topic.localeCompare(b.topic))
}

export function riskPlanner(experts: ExpertProfile[], topics: TopicProfile[], graph: KnowledgeGraph, done: Session[], s: PlannerSettings): Session {
  const rows = atRisk(experts, topics, graph, done, s)
  const count = (id: string) => done.filter((d) => d.expert === id).length
  const byExpert = new Map<string, number>()
  for (const e of experts) {
    if (count(e.id) >= s.sessionsPerExpertMax) continue
    const top = rows.filter((r) => r.expert === e.id).slice(0, 2)
    byExpert.set(e.id, top.reduce((a, r) => a + r.risk, 0))
  }
  const [expert] = [...byExpert.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  const focus = rows.filter((r) => r.expert === expert).slice(0, 2).map((r) => r.topic)
  return { expert, focus, why: `most knowledge at risk: ${focus.join(', ')} (score ${byExpert.get(expert)!.toFixed(1)})` }
}

/** Without a risk weighting: everyone in turn, in alphabetical order of surname, the way a calendar fills up. */
export function roundRobin(experts: ExpertProfile[], done: Session[]): Session {
  const order = [...experts].sort((a, b) => a.name.split(' ').at(-1)!.localeCompare(b.name.split(' ').at(-1)!, 'de'))
  const e = order[done.length % order.length]
  return { expert: e.id, focus: [], why: 'next in turn' }
}
