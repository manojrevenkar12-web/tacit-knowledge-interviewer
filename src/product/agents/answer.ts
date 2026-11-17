import { z } from 'zod'
import { readText } from '../../config.ts'
import { EXPERT_NAMES, ORG } from '../people.ts'
import type { Gateway } from '../llm/gateway.ts'
import type { GraphClaim, KnowledgeGraph } from '../pipeline/graph.ts'
import { entitiesIn, numbersIn, type Glossary } from '../pipeline/normalize.ts'
import { HybridIndex } from '../pipeline/search.ts'

export interface AnswerSettings {
  k: number
  minLexical: number
  /** Least overlap a cited claim needs with what the question asks, identifiers left out. */
  minCited: number
  dims: number
  rrfK: number
}

export interface MemoryAnswer {
  questionId: string
  abstain: boolean
  text: string
  cites: GraphClaim[]
  /** Added by code: conflicts between experts and knowledge with only one source. */
  warnings: string[]
  reason: string
}

const SYSTEM = readText('prompts/answer.md')
const Out = z.object({ answer: z.string(), cites: z.array(z.string()), abstain: z.boolean() })

function docText(c: GraphClaim): string {
  const t = ORG.topics.find((x) => x.id === c.topic)
  return `${c.statement} ${c.quote} ${c.entities.join(' ')} ${t?.de ?? ''} ${t?.en ?? ''}`
}

/** The question without its identifiers: what it asks, not what it is about. */
function asks(question: string, g: Glossary): string {
  let q = question
  q = q.replace(/\b(?:SGM|WZ|Werkzeug|PA|PP|RB|Robo)[\s-]*\d[\w-]*/gi, ' ').replace(/\bPOM[\s-]*C\b/gi, ' ')
  for (const names of [...Object.values(g.customers), ...Object.values(g.materials)]) for (const n of names) q = q.split(n).join(' ')
  return q
}

/**
 * Answers from the knowledge graph. Code finds the claims, refuses when nothing fits, checks that every cited claim was
 * offered and every number in the answer is in a cited claim, and writes the warnings itself.
 */
export async function answerFromGraph(gw: Gateway, g: Glossary, graph: KnowledgeGraph, s: AnswerSettings, q: { id: string; text: string }): Promise<MemoryAnswer> {
  const live = graph.live()
  const abstain = (reason: string): MemoryAnswer => ({ questionId: q.id, abstain: true, text: 'Dazu ist noch kein Wissen erfasst. Die Frage geht an die Interviewplanung.', cites: [], warnings: [], reason })
  if (!live.length) return abstain('the memory is empty')
  const want = entitiesIn(q.text, g)
  const index = new HybridIndex(live.map((c) => ({ id: c.id, text: docText(c) })), s)
  const byId = new Map(live.map((c) => [c.id, c]))
  const hits = index.search(q.text, s.k, want.length ? (id) => want.every((e) => byId.get(id)!.entities.includes(e)) : undefined)
  if (!hits.length || hits[0].lexical < s.minLexical) return abstain(want.length ? `nothing captured about ${want.join(', ')} that fits` : 'no captured claim fits the question')
  const offered = new Map<string, GraphClaim>()
  for (const h of hits) {
    const c = byId.get(h.id)!
    offered.set(c.id, c)
    for (const o of c.conflictsWith) if (byId.has(o)) offered.set(o, byId.get(o)!)
  }
  const out = await gw.json(
    'answer',
    SYSTEM,
    JSON.stringify({ questionId: q.id, question: q.text, claims: [...offered.values()].map((c) => ({ id: c.id, interviewId: c.interviewId, turn: c.turn, statement: c.statement, quote: c.quote, value: c.value, unit: c.unit, expert: c.expert, status: c.status })) }),
    Out,
  )
  if (out.value.abstain || !out.value.cites.length) return abstain('the model found no claim that answers it')
  const cites = out.value.cites.map((id) => offered.get(id))
  if (cites.some((c) => !c)) return abstain('the model cited a claim it was not given')
  const cited = cites as GraphClaim[]
  if (want.length && cited.some((c) => !want.some((e) => c.entities.includes(e)))) return abstain('a cited claim is about something else')
  // Sharing a machine or a customer is not enough: each cited claim must also match what the question asks.
  const ids = new Set(cited.map((c) => c.id))
  const what = index.search(asks(q.text, g), cited.length, (id) => ids.has(id))
  const weak = cited.filter((c) => (what.find((h) => h.id === c.id)?.lexical ?? 0) < s.minCited)
  if (weak.length && weak.length === cited.length) return abstain('no cited claim matches what the question asks')
  const allowed = new Set(cited.flatMap((c) => numbersIn(c.quote)))
  const stray = numbersIn(out.value.answer).filter((n) => !allowed.has(n))
  if (stray.length) return abstain(`the answer has numbers no cited claim has: ${stray.join(', ')}`)
  const warnings: string[] = []
  for (const c of cited) {
    for (const o of c.conflictsWith.map((id) => byId.get(id)).filter(Boolean) as GraphClaim[]) {
      const w = `Widerspruch: ${EXPERT_NAMES[c.expert] ?? c.expert} sagt ${c.value} ${c.unit}, ${EXPERT_NAMES[o.expert] ?? o.expert} sagt ${o.value} ${o.unit}. Bitte klären, bevor danach gearbeitet wird.`
      if (!warnings.some((x) => x.includes(`${o.value} ${o.unit}`) && x.includes(`${c.value} ${c.unit}`))) warnings.push(w)
    }
    if (c.status === 'single source') warnings.push(`Nur eine Quelle: ${EXPERT_NAMES[c.expert] ?? c.expert}, Interview ${c.interviewId}, Minute ${Math.round(c.minute)}.`)
  }
  return { questionId: q.id, abstain: false, text: out.value.answer, cites: cited, warnings: [...new Set(warnings)], reason: `answered from ${cited.length} claim(s)` }
}

export interface TranscriptChunk {
  id: string
  interviewId: string
  turn: number
  text: string
}

const RAG = readText('prompts/answer_rag.md')
const RagOut = z.object({ answer: z.string(), source: z.string().nullable(), abstain: z.boolean() })

/** The common baseline: search the raw transcripts and let the model answer from the passages. */
export async function answerFromTranscripts(gw: Gateway, chunks: TranscriptChunk[], s: AnswerSettings, q: { id: string; text: string }) {
  const index = new HybridIndex(chunks.map((c) => ({ id: c.id, text: c.text })), s)
  const hits = index.search(q.text, s.k)
  const byId = new Map(chunks.map((c) => [c.id, c]))
  const out = await gw.json('answer_rag', RAG, JSON.stringify({ questionId: q.id, question: q.text, chunks: hits.map((h) => byId.get(h.id)) }), RagOut)
  return { questionId: q.id, abstain: out.value.abstain, text: out.value.answer, source: out.value.source ? (byId.get(out.value.source) ?? null) : null }
}
