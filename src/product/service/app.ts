import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { readJson, ROOT } from '../../config.ts'
import type { Question } from '../../wire.ts'
import { answerFromGraph } from '../agents/answer.ts'
import { atRisk, riskPlanner, type Session } from '../agents/planner.ts'
import { glossary, productConfig } from '../build.ts'
import { Interviewer } from '../interview/brain.ts'
import { Gateway } from '../llm/gateway.ts'
import type { Claim } from '../pipeline/claims.ts'
import { KnowledgeGraph } from '../pipeline/graph.ts'
import { embed } from '../pipeline/search.ts'
import { ORG } from '../people.ts'
import type { Db } from './db.ts'

interface ServiceConfig {
  port: number
  keys: Record<string, 'manager' | 'viewer'>
  seedFile: string
}

type Row = Record<string, unknown>

export function claimFromRow(r: Row): Claim {
  return {
    id: String(r.claim_id),
    expert: String(r.expert),
    interviewId: String(r.interview_id),
    turn: Number(r.turn),
    minute: Number(r.minute),
    topic: String(r.topic),
    type: r.type as Claim['type'],
    statement: String(r.statement),
    quote: String(r.quote),
    entities: r.entities as string[],
    value: r.value === null ? null : Number(r.value),
    unit: (r.unit as string | null) ?? null,
    condition: (r.condition as string | null) ?? null,
    confirmed: Boolean(r.confirmed),
  }
}

export async function saveClaims(db: Db, claims: Claim[]): Promise<void> {
  for (const c of claims) {
    await db.query(
      `insert into claims (claim_id, interview_id, turn, expert, minute, topic, type, statement, quote, entities, value, unit, condition, confirmed, embedding)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) on conflict (claim_id) do nothing`,
      [c.id, c.interviewId, c.turn, c.expert, c.minute, c.topic, c.type, c.statement, c.quote, JSON.stringify(c.entities), c.value, c.unit, c.condition, c.confirmed, JSON.stringify(embed(`${c.statement} ${c.quote}`, 512))],
    )
  }
}

export async function loadGraph(db: Db): Promise<KnowledgeGraph> {
  const g = new KnowledgeGraph()
  g.add(...(await db.query<Row>('select * from claims order by interview_id, turn, claim_id')).rows.map(claimFromRow))
  return g
}

/** Load a recorded campaign into an empty database: interviews, turns and claims. No truth from the world. */
export async function seedDemo(db: Db, file: string): Promise<number> {
  const n = await db.query<{ n: number }>('select count(*)::int as n from interviews')
  if (n.rows[0].n > 0 || !existsSync(join(ROOT, file))) return 0
  const seed = JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as { interviews: { interviewId: string; expert: string; focus: string[]; minutes: number; turns: { turn: number; topic: string; move: string; why: string; question: string; answer: string; minute: number }[] }[]; claims: Claim[]; questions: { question: string; abstained: boolean; answer: string; cites: string[]; warnings: string[] }[] }
  for (const iv of seed.interviews) {
    await db.query('insert into interviews (interview_id, expert, focus, minutes, done) values ($1,$2,$3,$4,true)', [iv.interviewId, iv.expert, JSON.stringify(iv.focus), iv.minutes])
    for (const t of iv.turns) await db.query('insert into turns (interview_id, turn, topic, move, why, question, answer, minute) values ($1,$2,$3,$4,$5,$6,$7,$8)', [iv.interviewId, t.turn, t.topic, t.move, t.why, t.question, t.answer, t.minute])
  }
  await saveClaims(db, seed.claims)
  for (const q of seed.questions) await db.query('insert into questions (question, abstained, answer, cites, warnings) values ($1,$2,$3,$4,$5)', [q.question, q.abstained, q.answer, JSON.stringify(q.cites), JSON.stringify(q.warnings)])
  return seed.interviews.length
}

export async function buildApp(db: Db, opts: { fetch?: typeof fetch; baseURL?: string; apiKey?: string } = {}): Promise<FastifyInstance> {
  const cfg = readJson<ServiceConfig>('config/service.json')
  const pcfg = productConfig()
  const g = glossary()
  const baseURL = opts.baseURL ?? process.env.OPENAI_BASE_URL
  const gw = baseURL || opts.fetch ? new Gateway({ ...pcfg, baseURL: baseURL ?? pcfg.baseURL }, { fetch: opts.fetch, apiKey: opts.apiKey ?? process.env.OPENAI_API_KEY }) : null
  const interviewer = gw ? new Interviewer(gw, g, ORG.topics, { ...pcfg.interview, policy: 'gap', confirm: true, fixedQuestionnaire: pcfg.fixedQuestionnaire, smallTalk: pcfg.smallTalk }) : null
  let graph = await loadGraph(db)
  const app = Fastify({ logger: false })

  app.get('/healthz', async () => ({ ok: true, models: gw ? 'configured' : 'not configured', claims: graph.claims.size }))
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return
    const role = cfg.keys[String(req.headers['x-api-key'] ?? '')]
    if (!role) return reply.code(401).send({ error: 'missing or unknown X-Api-Key' })
    if (req.method !== 'GET' && role !== 'manager') return reply.code(403).send({ error: 'this key may only read' })
  })
  // Every model call the gateway made while answering a request lands in the ledger table once.
  let flushed = 0
  app.addHook('onResponse', async () => {
    if (!gw || gw.ledger.length === flushed) return
    const fresh = gw.ledger.slice(flushed)
    flushed = gw.ledger.length
    for (const e of fresh)
      await db.query('insert into ledger (route, model, ok, prompt_tokens, completion_tokens, micros) values ($1,$2,$3,$4,$5,$6)', [e.route, e.model, e.ok, e.promptTokens, e.completionTokens, e.micros])
  })
  const needModels = (reply: FastifyReply) => reply.code(503).send({ error: 'no model endpoint configured: set OPENAI_BASE_URL' })

  app.get('/api/org', async () => ORG)

  app.get('/api/plan', async () => {
    const done = (await db.query<{ expert: string; focus: string[] }>('select expert, focus from interviews')).rows.map((r) => ({ expert: r.expert, focus: r.focus, why: '' }) as Session)
    return { next: riskPlanner(ORG.experts, ORG.topics, graph, done, pcfg.planner), atRisk: atRisk(ORG.experts, ORG.topics, graph, done, pcfg.planner) }
  })

  app.post('/api/interviews', async (req, reply) => {
    if (!interviewer) return needModels(reply)
    const body = z.object({ expert: z.string(), focus: z.array(z.string()).optional() }).safeParse(req.body)
    const expert = body.success ? ORG.experts.find((e) => e.id === body.data.expert) : undefined
    if (!body.success || !expert) return reply.code(400).send({ error: 'name an expert from the org chart: {"expert": "E1"}' })
    const count = (await db.query<{ n: number }>('select count(*)::int as n from interviews')).rows[0].n
    const id = `iv-${String(count + 1).padStart(3, '0')}-${expert.id}`
    const focus = body.data.focus ?? []
    await db.query('insert into interviews (interview_id, expert, focus) values ($1,$2,$3)', [id, expert.id, JSON.stringify(focus)])
    const q = await interviewer.start(id, expert, focus)
    const st = await interviewer.state(id)
    await db.query('insert into turns (interview_id, turn, topic, move, why, question) values ($1,$2,$3,$4,$5,$6)', [id, q.turn, q.topic, q.move, st.plan?.why ?? '', q.text])
    return { interviewId: id, question: q }
  })

  app.post('/api/interviews/:id/answer', async (req, reply) => {
    if (!interviewer) return needModels(reply)
    const id = (req.params as { id: string }).id
    const body = z.object({ turn: z.number().int(), text: z.string().min(1), minute: z.number().nonnegative() }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'send {"turn", "text", "minute"}' })
    const open = await db.query<{ answer: string | null }>('select answer from turns where interview_id = $1 and turn = $2', [id, body.data.turn])
    if (!open.rows[0]) return reply.code(404).send({ error: 'no such question' })
    if (open.rows[0].answer !== null) return reply.code(409).send({ error: 'this question has an answer already' })
    await db.query('update turns set answer = $3, minute = $4 where interview_id = $1 and turn = $2', [id, body.data.turn, body.data.text, body.data.minute])
    const before = (await interviewer.state(id)).claims.length
    let next: Question | null
    try {
      next = await interviewer.answer(id, { interviewId: id, turn: body.data.turn, text: body.data.text, minute: body.data.minute, tired: false })
    } catch {
      return reply.code(404).send({ error: 'this interview is not running on this server' })
    }
    const st = await interviewer.state(id)
    const fresh = st.claims.slice(before)
    await saveClaims(db, fresh)
    graph = await loadGraph(db)
    if (next) await db.query('insert into turns (interview_id, turn, topic, move, why, question) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [id, next.turn, next.topic, next.move, st.plan?.why ?? '', next.text])
    else await db.query('update interviews set done = true, minutes = $2 where interview_id = $1', [id, body.data.minute])
    return { question: next, claims: fresh }
  })

  app.get('/api/interviews', async () => (await db.query<Row>(`select i.*, (select count(*)::int from claims c where c.interview_id = i.interview_id) as claims, (select count(*)::int from turns t where t.interview_id = i.interview_id) as turns from interviews i order by started_at desc, interview_id desc`)).rows)

  app.get('/api/interviews/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id
    const iv = (await db.query<Row>('select * from interviews where interview_id = $1', [id])).rows[0]
    if (!iv) return reply.code(404).send({ error: 'no such interview' })
    const turns = (await db.query<Row>('select * from turns where interview_id = $1 order by turn', [id])).rows
    const claims = [...graph.claims.values()].filter((c) => c.interviewId === id)
    return { ...iv, turns, claims }
  })

  app.get('/api/graph', async (req) => {
    const { topic, expert } = req.query as { topic?: string; expert?: string }
    return [...graph.claims.values()].filter((c) => (!topic || c.topic === topic) && (!expert || c.expert === expert)).sort((a, b) => a.topic.localeCompare(b.topic) || a.id.localeCompare(b.id))
  })

  app.get('/api/graph/similar', async (req) => {
    const q = String((req.query as { q?: string }).q ?? '')
    const r = await db.query<{ claim_id: string; quote: string; similarity: number }>('select claim_id, quote, 1 - (embedding <=> $1) as similarity from claims order by embedding <=> $1, claim_id limit 5', [JSON.stringify(embed(q, 512))])
    return r.rows.map((x) => ({ ...x, similarity: Math.round(Number(x.similarity) * 1000) / 1000 }))
  })

  app.post('/api/ask', async (req: FastifyRequest, reply) => {
    if (!gw) return needModels(reply)
    const body = z.object({ question: z.string().min(5) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'send {"question": "..."}' })
    const a = await answerFromGraph(gw, g, graph, pcfg.answer, { id: `ask-${Date.now()}`, text: body.data.question }).catch((e: Error) => e)
    if (a instanceof Error) return reply.code(503).send({ error: `the models did not answer: ${a.message}` })
    await db.query('insert into questions (question, abstained, answer, cites, warnings) values ($1,$2,$3,$4,$5)', [body.data.question, a.abstain, a.text, JSON.stringify(a.cites.map((c) => c.id)), JSON.stringify(a.warnings)])
    return a
  })

  app.get('/api/questions', async () => (await db.query<Row>('select * from questions order by id desc limit 100')).rows)

  app.get('/api/results', async () => {
    const read = (f: string) => (existsSync(join(ROOT, f)) ? JSON.parse(readFileSync(join(ROOT, f), 'utf8')) : null)
    const strip = (r: { seeds: string[]; designs: { name: string; label: string; metrics: unknown }[] } | null) => (r ? { seeds: r.seeds, designs: r.designs.map(({ name, label, metrics }) => ({ name, label, metrics })) } : null)
    return { dev: strip(read('reports/dev.json')), heldout: strip(read('reports/heldout.json')), gate: read('reports/gate.json') }
  })

  return app
}
