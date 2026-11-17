import { Annotation, Command, END, MemorySaver, START, StateGraph, interrupt, type BaseCheckpointSaver } from '@langchain/langgraph'
import { z } from 'zod'
import { readText } from '../../config.ts'
import type { Answer, ExpertProfile, KuType, Move, Question, TopicProfile } from '../../wire.ts'
import { readTurn, type Claim, type SmallTalk } from '../pipeline/claims.ts'
import { subjectKey } from '../pipeline/graph.ts'
import type { Glossary } from '../pipeline/normalize.ts'
import type { Gateway } from '../llm/gateway.ts'
import { fixedMove, nextMove, type InterviewSettings, type Plan, type TopicState } from './policy.ts'

export type Policy = 'gap' | 'fixed' | 'model'

export interface InterviewerSettings extends InterviewSettings {
  smallTalk: SmallTalk
  policy: Policy
  confirm: boolean
  fixedQuestionnaire: Move[]
}

interface TopicRecord {
  asked: Move[]
  found: KuType[]
  empties: number
  closed: boolean
}

export interface Turn {
  question: Question
  answer: Answer
  plan: Plan
  claims: string[]
  dropped: string[]
}

const State = Annotation.Root({
  interviewId: Annotation<string>(),
  expert: Annotation<ExpertProfile>(),
  focus: Annotation<string[]>(),
  minute: Annotation<number>(),
  turn: Annotation<number>(),
  topics: Annotation<Record<string, TopicRecord>>(),
  unchecked: Annotation<Claim[]>(),
  checked: Annotation<string[]>(),
  plan: Annotation<Plan | null>(),
  question: Annotation<Question | null>(),
  answer: Annotation<Answer | null>(),
  done: Annotation<boolean>(),
  claims: Annotation<Claim[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  turns: Annotation<Turn[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
})
type S = typeof State.State

const PHRASE = readText('prompts/phrase.md')
const FREE = readText('prompts/interview_free.md')
const Phrased = z.object({ question: z.string().min(8) })
const Free = z.object({ topic: z.string(), move: z.enum(['open', 'example', 'failure', 'numbers', 'why', 'newcomer', 'who', 'wrap']), question: z.string().min(8) })

/**
 * One interview as a LangGraph: plan the next question (code), word it (model), ask (the graph pauses until the
 * expert has answered, by voice or text), read the answer into claims, and plan again. Checkpointed per interview, so
 * a dropped call resumes where it stopped.
 */
export class Interviewer {
  private readonly graph

  constructor(
    private readonly gw: Gateway,
    private readonly glossary: Glossary,
    private readonly topics: TopicProfile[],
    private readonly s: InterviewerSettings,
    checkpointer: BaseCheckpointSaver = new MemorySaver(),
  ) {
    this.graph = new StateGraph(State)
      .addNode('choose', (st: S) => this.plan(st))
      .addNode('word', (st: S) => this.word(st))
      .addNode('ask', (st: S) => this.ask(st))
      .addNode('listen', (st: S) => this.read(st))
      .addEdge(START, 'choose')
      .addEdge('choose', 'word')
      .addEdge('word', 'ask')
      .addConditionalEdges('ask', (st: S) => (st.done ? END : 'listen'), ['listen', END])
      .addEdge('listen', 'choose')
      .compile({ checkpointer })
  }

  private cfg(id: string) {
    return { configurable: { thread_id: id }, recursionLimit: 400 }
  }

  /** Start an interview; returns the first question. */
  async start(interviewId: string, expert: ExpertProfile, focus: string[]): Promise<Question> {
    const r = await this.graph.invoke({ interviewId, expert, focus, minute: 0, turn: 0, topics: {}, unchecked: [], checked: [], plan: null, question: null, answer: null, done: false }, this.cfg(interviewId))
    return this.pending(r)
  }

  /** Give the expert's answer; returns the next question, or null when the interview is over. */
  async answer(interviewId: string, a: Answer): Promise<Question | null> {
    const r = await this.graph.invoke(new Command({ resume: a }), this.cfg(interviewId))
    return r.done ? null : this.pending(r)
  }

  async state(interviewId: string): Promise<S> {
    return (await this.graph.getState(this.cfg(interviewId))).values as S
  }

  private pending(r: Record<string, unknown>): Question {
    const i = (r.__interrupt__ as { value: Question }[] | undefined)?.[0]
    if (!i) throw new Error('the interview did not stop at a question')
    return i.value
  }

  private async plan(st: S): Promise<Partial<S>> {
    const topicState: Record<string, TopicState> = Object.fromEntries(Object.entries(st.topics).map(([k, v]) => [k, { ...v, found: new Set(v.found) }]))
    const input = { expert: st.expert, topics: this.topics, focus: st.focus, minute: st.minute, state: topicState, unchecked: st.unchecked, confirm: this.s.confirm }
    const turn = st.turn + 1
    if (this.s.policy === 'model') {
      if (st.minute >= this.s.wrapAtMinute) return { plan: { topic: st.expert.topics[0], move: 'wrap', why: 'time is up' }, question: null, turn }
      const transcript = st.turns.map((t) => `I: ${t.question.text}\nE: ${t.answer.text}`).join('\n')
      const out = await this.gw.json('interview_free', FREE, JSON.stringify({ interviewId: st.interviewId, turn, topics: st.expert.topics, transcript }), Free)
      const topic = st.expert.topics.includes(out.value.topic) ? out.value.topic : st.expert.topics[0]
      const plan: Plan = { topic, move: out.value.move, why: `chosen by ${out.model}` }
      return { plan, turn, question: { interviewId: st.interviewId, turn, topic, move: plan.move, text: out.value.question } }
    }
    const plan = this.s.policy === 'fixed' ? fixedMove(input, this.s.fixedQuestionnaire, this.s) : nextMove(input, this.s)
    const topics = { ...st.topics }
    for (const [k, v] of Object.entries(topicState)) topics[k] = { ...v, found: [...v.found] }
    return { plan, turn, topics, question: null }
  }

  private async word(st: S): Promise<Partial<S>> {
    if (st.question && st.question.turn === st.turn) return {}
    const p = st.plan!
    const topic = this.topics.find((t) => t.id === p.topic)
    const out = await this.gw.json('phrase', PHRASE, JSON.stringify({ interviewId: st.interviewId, turn: st.turn, topic: topic?.de ?? p.topic, move: p.move, about: p.about ?? null }), Phrased)
    return { question: { interviewId: st.interviewId, turn: st.turn, topic: p.topic, move: p.move, about: p.about, text: out.value.question } }
  }

  private ask(st: S): Partial<S> {
    const answer = interrupt(st.question!) as Answer
    return { answer, minute: answer.minute, done: st.plan!.move === 'wrap' || answer.minute >= this.s.minutes }
  }

  private async read(st: S): Promise<Partial<S>> {
    const q = st.question!
    const a = st.answer!
    const r = await readTurn(this.gw, this.glossary, this.s.smallTalk, { interviewId: st.interviewId, expert: st.expert.id, turn: q.turn, minute: a.minute, topic: q.topic, question: q.text, answer: a.text, confirm: q.move === 'confirm' })
    const topics = { ...st.topics }
    const t = topics[q.topic] ?? { asked: [], found: [], empties: 0, closed: false }
    const fresh = r.claims.filter((c) => !st.claims.some((o) => o.quote === c.quote))
    topics[q.topic] = { ...t, asked: [...t.asked, q.move], found: [...new Set([...t.found, ...fresh.map((c) => c.type)])], empties: fresh.length ? 0 : t.empties + 1 }
    let unchecked = st.unchecked
    let checked = st.checked
    if (q.move === 'confirm' && q.about) {
      unchecked = unchecked.filter((c) => subjectKey(c) !== q.about!.param)
      checked = [...checked, q.about.param]
    } else {
      for (const c of fresh) {
        const k = subjectKey(c)
        if (k && !checked.includes(k) && !unchecked.some((u) => subjectKey(u) === k)) unchecked = [...unchecked, c]
      }
    }
    return { claims: r.claims, topics, unchecked, checked, turns: [{ question: q, answer: a, plan: st.plan!, claims: r.claims.map((c) => c.id), dropped: r.dropped }] }
  }
}
