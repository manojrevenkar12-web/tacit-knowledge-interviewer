import { expect, test } from 'vitest'
import { z } from 'zod'
import { Interviewer } from '../src/product/interview/brain.ts'
import { Gateway } from '../src/product/llm/gateway.ts'
import { ORG } from '../src/product/people.ts'
import { SimulatedModels } from '../src/world/models.ts'
import { g, pcfg, world } from './helpers.ts'

const down = (async () => new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 503, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch

test('an overloaded model is tried again before the route moves on', async () => {
  const w = world('outage-1')
  const sim = new SimulatedModels(w, w.cfg.models).fetch as typeof fetch
  let calls = 0
  const flaky = (async (url: string, init: RequestInit) => (++calls === 1 ? down(url, init) : sim(url, init))) as typeof fetch
  const gw = new Gateway({ ...pcfg, routes: { phrase: ['gpt-4.1-mini'] } }, { fetch: flaky })
  const out = await gw.json('phrase', '# task: phrase', JSON.stringify({ interviewId: 'iv-1', turn: 1, topic: 'Materialtrocknung', move: 'open', about: null }), z.object({ question: z.string().min(8) }))
  expect(out.model).toBe('gpt-4.1-mini')
  expect(gw.ledger.map((e) => e.ok)).toEqual([false, true])
})

test('with every model down the interview goes on: template questions, and the answers are kept unread', async () => {
  const gw = new Gateway(pcfg, { fetch: down })
  const iv = new Interviewer(gw, g, ORG.topics, { ...pcfg.interview, policy: 'gap', confirm: true, fixedQuestionnaire: pcfg.fixedQuestionnaire, smallTalk: pcfg.smallTalk })
  const expert = ORG.experts.find((e) => e.id === 'E2')!
  const first = await iv.start('iv-down', expert, ['hydraulics'])
  expect(first.text).toBe('Wie läuft bei Ihnen das Thema Hydraulik-Wartung ab?')
  const next = await iv.answer('iv-down', { interviewId: 'iv-down', turn: first.turn, text: 'Bei einer Öltemperatur über 55 Grad prüfen wir sofort den Kühler.', minute: 1, tired: false })
  expect(next).not.toBeNull()
  const st = await iv.state('iv-down')
  expect(st.turns[0]).toMatchObject({ unread: true, claims: [] })
  expect(st.topics.hydraulics.empties).toBe(0)
  expect(gw.ledger.every((e) => !e.ok)).toBe(true)
})
