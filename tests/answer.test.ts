import { expect, test } from 'vitest'
import { answerFromGraph } from '../src/product/agents/answer.ts'
import { Gateway } from '../src/product/llm/gateway.ts'
import type { Claim } from '../src/product/pipeline/claims.ts'
import { KnowledgeGraph } from '../src/product/pipeline/graph.ts'
import { g, pcfg } from './helpers.ts'

function model(reply: (body: { claims: { id: string }[] }) => unknown) {
  return (async (_u: unknown, init?: RequestInit) => {
    const req = JSON.parse(String(init?.body))
    const body = JSON.parse(req.messages[1].content)
    return new Response(JSON.stringify({ id: 'x', object: 'chat.completion', created: 0, model: req.model, choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(reply(body)) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}

/** Other knowledge in the memory, so that words have their usual weight. */
const background: Claim[] = [
  ['h1', 'hydraulics', 'Das Hydrauliköl wechseln wir alle 3000 Betriebsstunden.'],
  ['t1', 'toolchange', 'Beim Werkzeugwechsel blasen wir zuerst die Kühlwasserleitungen aus.'],
  ['x1', 'handover', 'Bei der Schichtübergabe laufen wir jede Maschine einmal gemeinsam ab.'],
  ['c3', 'colour', 'Farben immer von hell nach dunkel planen, nie umgekehrt.'],
  ['m3', 'mouldtemp', 'Die Temperiergeräte prüfen wir jeden Montag auf den Wasserstand.'],
].map(([id, topic, quote]) => ({ id, expert: 'E2', interviewId: 'iv0', turn: 1, minute: 1, topic, type: 'procedure', statement: quote, quote, entities: [], value: null, unit: null, condition: null, confirmed: false }) as Claim)

const c = (over: Partial<Claim>): Claim => ({ id: 'a', expert: 'E3', interviewId: 'iv1', turn: 1, minute: 4, topic: 'drying', type: 'threshold', statement: 'PA6-GF30 from an opened bag is dried for 6 h at 80 °C.', quote: 'PA6-GF30 aus einem offenen Sack trocknen wir 6 Stunden bei achtzig Grad.', entities: ['PA6-GF30'], value: 6, unit: 'h', condition: 'opened bag', confirmed: false, ...over })

test('an answer cites its claims, and code writes the warnings: a conflict between experts and a single source', async () => {
  const k = new KnowledgeGraph()
  k.add(...background, c({}), c({ id: 'b', expert: 'E5', interviewId: 'iv2', value: 5, quote: 'PA6-GF30 aus einem offenen Sack trocknen wir 5 Stunden bei achtzig Grad.' }))
  const gw = new Gateway(pcfg, { fetch: model(() => ({ answer: 'Hakan Yılmaz: 6 Stunden bei achtzig Grad.', cites: ['a'], abstain: false })) })
  const a = await answerFromGraph(gw, g, k, pcfg.answer, { id: 'q', text: 'Wie lange muss PA6-GF30 aus einem offenen Sack getrocknet werden?' })
  expect(a.abstain).toBe(false)
  expect(a.cites.map((x) => x.id)).toEqual(['a'])
  expect(a.warnings[0]).toMatch(/^Widerspruch: Hakan Yılmaz sagt 6 h, Jürgen Albers sagt 5 h/)
})

test('a number in the answer that no cited claim has, or a claim that does not fit, makes it say "not captured"', async () => {
  const k = new KnowledgeGraph()
  k.add(...background, c({}), c({ id: 'r', topic: 'regrind', entities: ['KD-1001'], type: 'rule', value: null, unit: null, condition: null, quote: 'Bei Teilen für Brenner darf gar kein Mahlgut rein, das steht im Vertrag.', statement: 'No regrind for Brenner Automotive.' }))
  const invent = new Gateway(pcfg, { fetch: model(() => ({ answer: 'Etwa 7 Stunden.', cites: ['a'], abstain: false })) })
  expect((await answerFromGraph(invent, g, k, pcfg.answer, { id: 'q', text: 'Wie lange muss PA6-GF30 aus einem offenen Sack getrocknet werden?' })).reason).toMatch(/numbers no cited claim has: 7/)
  const offTopic = new Gateway(pcfg, { fetch: model(() => ({ answer: 'Kein Mahlgut.', cites: ['r'], abstain: false })) })
  const a = await answerFromGraph(offTopic, g, k, pcfg.answer, { id: 'q', text: 'Welche Reklamationsquote hat Brenner Automotive?' })
  expect(a.abstain).toBe(true)
})

test('nothing captured about the question: no model call, an honest gap', async () => {
  let called = false
  const gw = new Gateway(pcfg, { fetch: model(() => ((called = true), {})) })
  const k = new KnowledgeGraph()
  k.add(...background, c({}))
  const a = await answerFromGraph(gw, g, k, pcfg.answer, { id: 'q', text: 'Welches Schmierfett nehmen wir für die Führungen vom RB-2?' })
  expect(a.abstain).toBe(true)
  expect(called).toBe(false)
})
