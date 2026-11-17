import type { ExpertProfile, KuType, Move, TopicProfile } from '../../wire.ts'
import type { Claim } from '../pipeline/claims.ts'
import { subjectKey } from '../pipeline/graph.ts'

export interface InterviewSettings {
  minutes: number
  wrapAtMinute: number
  closeTopicAfterEmpty: number
  minScore: number
  typeWeight: Record<KuType, number>
  yield: Record<string, Record<KuType, number>>
  criticalTopicFactor: number
  focusTopicFactor: number
  /** Questions asked from a template when no model can word them. */
  fallbackQuestions: Record<Move, string>
}

export interface TopicState {
  asked: Move[]
  found: Set<KuType>
  empties: number
  closed: boolean
}

export interface Plan {
  topic: string
  move: Move
  about?: { param: string; value: number; entity: string | null }
  why: string
}

export interface PlanInput {
  expert: ExpertProfile
  topics: TopicProfile[]
  focus: string[]
  minute: number
  state: Record<string, TopicState>
  /** Values the expert stated that have not been checked yet. */
  unchecked: Claim[]
  confirm: boolean
}

const TYPES: KuType[] = ['procedure', 'threshold', 'rule', 'exception', 'rationale', 'contact']

/**
 * The gap-driven policy: stay on a topic while some kind of knowledge is still missing and a question is likely to
 * bring it out; check every stated number once; move on when two answers in a row add nothing. The model only words
 * the question.
 */
export function nextMove(inp: PlanInput, s: InterviewSettings): Plan {
  if (inp.minute >= s.wrapAtMinute) return { topic: inp.focus[0] ?? inp.expert.topics[0], move: 'wrap', why: 'time is up' }
  if (inp.confirm && inp.unchecked.length) {
    const c = inp.unchecked[0]
    return { topic: c.topic, move: 'confirm', about: { param: subjectKey(c)!, value: c.value!, entity: c.entities[0] ?? null }, why: `check the stated ${c.value} ${c.unit}` }
  }
  const order = [...inp.focus, ...inp.expert.topics.filter((t) => !inp.focus.includes(t))]
  for (const topic of order) {
    const st = inp.state[topic]
    if (st?.closed) continue
    const asked = st?.asked ?? []
    const found = st?.found ?? new Set<KuType>()
    const critical = inp.topics.find((t) => t.id === topic)?.critical ? s.criticalTopicFactor : 1
    const focus = inp.focus.includes(topic) ? s.focusTopicFactor : 1
    let best: { move: Move; score: number } | null = null
    for (const move of Object.keys(s.yield) as Move[]) {
      if (asked.includes(move)) continue
      const gain = TYPES.filter((t) => !found.has(t)).reduce((a, t) => a + s.typeWeight[t] * s.yield[move][t], 0)
      // Open first: it is cheap and tells us what the expert volunteers.
      const score = (gain + (move === 'open' && !asked.length ? 1 : 0)) * critical * focus
      if (!best || score > best.score) best = { move, score }
    }
    if (best && best.score / (critical * focus) >= s.minScore && (st?.empties ?? 0) < s.closeTopicAfterEmpty) return { topic, move: best.move, why: `${topic}: still missing ${TYPES.filter((t) => !found.has(t)).join(', ')}` }
    if (st) st.closed = true
  }
  return { topic: order[0], move: 'wrap', why: 'every topic is covered or exhausted' }
}

/** The classic knowledge questionnaire: the same questions on every topic of the role, in order. */
export function fixedMove(inp: PlanInput, list: Move[], s: InterviewSettings): Plan {
  if (inp.minute >= s.wrapAtMinute) return { topic: inp.expert.topics[0], move: 'wrap', why: 'time is up' }
  const order = [...inp.focus, ...inp.expert.topics.filter((t) => !inp.focus.includes(t))]
  for (const topic of order) {
    const asked = inp.state[topic]?.asked ?? []
    const move = list.find((m) => !asked.includes(m))
    if (move) return { topic, move, why: 'next question on the form' }
  }
  return { topic: order[0], move: 'wrap', why: 'form complete' }
}
