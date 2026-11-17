import { readJson } from '../config.ts'
import { answerFromGraph, answerFromTranscripts, type TranscriptChunk } from '../product/agents/answer.ts'
import { riskPlanner, roundRobin, type Session } from '../product/agents/planner.ts'
import { glossary, productConfig, type ProductConfig } from '../product/build.ts'
import { Interviewer, type Policy } from '../product/interview/brain.ts'
import { Gateway } from '../product/llm/gateway.ts'
import { KnowledgeGraph } from '../product/pipeline/graph.ts'
import { ORG } from '../product/people.ts'
import { worldConfig } from '../world/load.ts'
import { SimulatedModels } from '../world/models.ts'
import { World, type WorldConfig } from '../world/world.ts'
import type { Question } from '../wire.ts'

export interface Design {
  name: string
  label: string
  interviewer: Policy
  confirm: boolean
  planner: 'risk' | 'round_robin'
  answers: 'graph' | 'transcripts'
}

export type Outcome = 'right' | 'flagged' | 'wrong' | 'honest_gap' | 'missed'

export interface AnswerRecord {
  questionId: string
  gold: string | null
  outcome: Outcome
  abstain: boolean
}

export interface DesignRun {
  design: string
  seed: string
  world: World
  graph: KnowledgeGraph
  chunks: TranscriptChunk[]
  sessions: (Session & { interviewId: string; minutes: number; turns: number; claims: number; unread: number })[]
  answers: AnswerRecord[]
  expertMinutes: number
  modelMicros: number
  voiceMicros: number
  turnsByMove: Record<string, number>
  transcript: { interviewId: string; turn: number; topic: string; move: string; why: string; question: string; minute: number }[]
}

export const designs = (): Design[] => readJson<{ designs: Design[] }>('config/designs.json').designs

/** One design over one simulated company: an interview campaign, then the questions new staff ask. */
export async function runDesign(seed: string, design: Design, pcfg: ProductConfig = productConfig(), over: Partial<WorldConfig> = {}): Promise<DesignRun> {
  const world = new World(worldConfig(seed, over))
  const models = new SimulatedModels(world, world.cfg.models)
  const gw = new Gateway(pcfg, { fetch: models.fetch as typeof fetch })
  const g = glossary()
  const interviewer = new Interviewer(gw, g, ORG.topics, { ...pcfg.interview, minutes: world.cfg.interviewMinutes, policy: design.interviewer, confirm: design.confirm, fixedQuestionnaire: pcfg.fixedQuestionnaire, smallTalk: pcfg.smallTalk })
  const graph = new KnowledgeGraph()
  const sessions: DesignRun['sessions'] = []
  const chunks: TranscriptChunk[] = []
  const turnsByMove: Record<string, number> = {}
  const transcript: DesignRun['transcript'] = []
  let expertMinutes = 0
  let ttsChars = 0
  while (expertMinutes < world.cfg.expertHours * 60 && sessions.length < world.cfg.maxSessions) {
    const plan = design.planner === 'risk' ? riskPlanner(ORG.experts, ORG.topics, graph, sessions, pcfg.planner) : roundRobin(ORG.experts, sessions)
    const expert = ORG.experts.find((e) => e.id === plan.expert)!
    const id = world.startInterview(expert.id)
    let q: Question | null = await interviewer.start(id, expert, plan.focus)
    let minute = 0
    while (q) {
      const a = world.respond(q)
      ttsChars += q.text.length
      turnsByMove[q.move] = (turnsByMove[q.move] ?? 0) + 1
      minute = a.minute
      chunks.push({ id: `${id}#${q.turn}`, interviewId: id, turn: q.turn, text: `${q.text} ${a.text}` })
      q = await interviewer.answer(id, a)
    }
    const st = await interviewer.state(id)
    graph.add(...st.claims)
    for (const t of st.turns) transcript.push({ interviewId: id, turn: t.question.turn, topic: t.question.topic, move: t.question.move, why: t.plan.why, question: t.question.text, minute: t.answer.minute })
    expertMinutes += minute
    sessions.push({ ...plan, interviewId: id, minutes: minute, turns: st.turns.length + 1, claims: st.claims.length, unread: st.turns.filter((t) => t.unread).length })
  }
  const answers: AnswerRecord[] = []
  for (const q of world.staffQuestions()) {
    let outcome: Outcome
    let abstain: boolean
    if (design.answers === 'graph') {
      const a = await answerFromGraph(gw, g, graph, pcfg.answer, q).catch(() => null)
      abstain = !a || a.abstain
      outcome = judgeGraph(world, graph, q.gold, a)
    } else {
      const a = await answerFromTranscripts(gw, chunks, pcfg.answer, q).catch(() => null)
      abstain = !a || a.abstain
      outcome = judgeTranscript(world, q.gold, a)
    }
    answers.push({ questionId: q.id, gold: q.gold, outcome, abstain })
  }
  const voiceMicros = Math.ceil(expertMinutes * pcfg.voice.sttMicrosPerMinute + (ttsChars / 1000) * pcfg.voice.ttsMicrosPerKChar)
  return { design: design.name, seed, world, graph, chunks, sessions, answers, expertMinutes, modelMicros: gw.micros(), voiceMicros, turnsByMove, transcript }
}

/** Knowledge the graph holds with the right value, as a live claim. */
export function capturedRight(world: World, graph: KnowledgeGraph): Set<string> {
  const out = new Set<string>()
  for (const c of graph.live()) {
    const s = world.spanOf(c.interviewId, c.turn, c.quote)
    if (s?.kuId && !s.wrongValue) out.add(s.kuId)
  }
  return out
}

function judgeGraph(world: World, graph: KnowledgeGraph, gold: string | null, a: Awaited<ReturnType<typeof answerFromGraph>> | null): Outcome {
  const known = gold !== null && capturedRight(world, graph).has(gold)
  if (!a || a.abstain) return known ? 'missed' : 'honest_gap'
  const spans = a.cites.map((c) => world.spanOf(c.interviewId, c.turn, c.quote))
  const onGold = spans.filter((s) => s?.kuId === gold)
  if (!gold || !onGold.length) return 'wrong'
  const conflict = a.warnings.some((w) => w.startsWith('Widerspruch'))
  if (onGold.some((s) => s!.wrongValue)) return conflict ? 'flagged' : 'wrong'
  return conflict ? 'flagged' : 'right'
}

function judgeTranscript(world: World, gold: string | null, a: Awaited<ReturnType<typeof answerFromTranscripts>> | null): Outcome {
  const known = gold !== null && world.spans.some((s) => s.kuId === gold && !s.wrongValue)
  if (!a || a.abstain) return known ? 'missed' : 'honest_gap'
  if (!a.source || !gold) return 'wrong'
  const s = world.spans.find((x) => x.interviewId === a.source!.interviewId && x.turn === a.source!.turn && x.kuId === gold)
  if (!s) return 'wrong'
  const said = world.texts.get(`${s.interviewId}|${s.turn}`)!.slice(s.start, s.end)
  return a.text.includes(said.replace(/^(Nein, warten Sie, das stimmt nicht ganz\.|Ja, das passt so\.)\s*/, '').slice(0, 20)) && !s.wrongValue ? 'right' : 'wrong'
}
