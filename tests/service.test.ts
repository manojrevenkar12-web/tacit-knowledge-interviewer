import { afterAll, beforeAll, expect, test } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp, seedDemo } from '../src/product/service/app.ts'
import { openDb, type Db } from '../src/product/service/db.ts'
import { SimulatedModels } from '../src/world/models.ts'
import { world } from './helpers.ts'

let db: Db
let app: FastifyInstance
const w = world('service')
const km = { 'x-api-key': 'km-demo-key' }
const viewer = { 'x-api-key': 'viewer-demo-key' }

beforeAll(async () => {
  db = await openDb('', undefined)
  await seedDemo(db, 'demo/seed.json')
  app = await buildApp(db, { fetch: new SimulatedModels(w, w.cfg.models).fetch as typeof fetch })
})
afterAll(async () => {
  await app.close()
  await db.close()
})

test('the demo campaign loads, and the memory serves it with statuses and provenance', async () => {
  const ivs = (await app.inject({ method: 'GET', url: '/api/interviews', headers: viewer })).json()
  expect(ivs.length).toBeGreaterThanOrEqual(10)
  const graph = (await app.inject({ method: 'GET', url: '/api/graph?topic=drying', headers: viewer })).json() as { status: string; expert: string; minute: number }[]
  expect(graph.length).toBeGreaterThan(3)
  expect(new Set(graph.map((c) => c.status)).has('single source')).toBe(true)
  const sim = (await app.inject({ method: 'GET', url: '/api/graph/similar?q=' + encodeURIComponent('Trocknung offener Sack Stunden'), headers: viewer })).json()
  expect(sim[0].similarity).toBeGreaterThan(0)
})

test('an interview through the API: the plan picks the expert, each answer returns the next question and the claims kept', async () => {
  expect((await app.inject({ method: 'POST', url: '/api/interviews', headers: viewer, payload: { expert: 'E1' } })).statusCode).toBe(403)
  const plan = (await app.inject({ method: 'GET', url: '/api/plan', headers: viewer })).json()
  expect(plan.atRisk.length).toBeGreaterThan(10)
  const start = (await app.inject({ method: 'POST', url: '/api/interviews', headers: km, payload: { expert: 'E2', focus: ['hydraulics'] } })).json()
  w.startInterviewAs(start.interviewId, 'E2')
  let q = start.question
  let kept = 0
  let turns = 0
  while (q) {
    const a = w.respond(q)
    const r = await app.inject({ method: 'POST', url: `/api/interviews/${start.interviewId}/answer`, headers: km, payload: { turn: q.turn, text: a.text, minute: a.minute } })
    expect(r.statusCode).toBe(200)
    kept += r.json().claims.length
    q = r.json().question
    turns++
  }
  expect(turns).toBeGreaterThan(4)
  expect(kept).toBeGreaterThan(2)
  const again = await app.inject({ method: 'POST', url: `/api/interviews/${start.interviewId}/answer`, headers: km, payload: { turn: 1, text: 'noch einmal', minute: 1 } })
  expect(again.statusCode).toBe(409)
  const detail = (await app.inject({ method: 'GET', url: `/api/interviews/${start.interviewId}`, headers: viewer })).json()
  expect(detail.done).toBe(true)
  expect(detail.turns.every((t: { why: string }) => t.why.length > 0)).toBe(true)
  const calls = (await db.query<{ n: number; routes: string[] }>('select count(*)::int as n, array_agg(distinct route) as routes from ledger')).rows[0]
  expect(calls.n).toBeGreaterThan(turns)
  expect(calls.routes).toEqual(expect.arrayContaining(['phrase', 'extract']))
})

test('a key is needed', async () => {
  expect((await app.inject({ method: 'GET', url: '/api/graph' })).statusCode).toBe(401)
})
