import { expect, test } from 'vitest'
import { nextMove, type TopicState } from '../src/product/interview/policy.ts'
import { ORG } from '../src/product/people.ts'
import type { Claim } from '../src/product/pipeline/claims.ts'
import { pcfg } from './helpers.ts'

const expert = ORG.experts.find((e) => e.id === 'E1')!
const base = { expert, topics: ORG.topics, focus: ['startup'], minute: 3, state: {} as Record<string, TopicState>, unchecked: [] as Claim[], confirm: true }

test('the interview opens a focus topic, then asks for what is still missing', () => {
  expect(nextMove(base, pcfg.interview)).toMatchObject({ topic: 'startup', move: 'open' })
  const state = { startup: { asked: ['open'], found: new Set(['procedure']), empties: 0, closed: false } } as Record<string, TopicState>
  expect(nextMove({ ...base, state }, pcfg.interview)).toMatchObject({ topic: 'startup', move: 'failure' })
})

test('a stated number is checked before anything else, once', () => {
  const c = { id: 'x', expert: 'E1', interviewId: 'iv', turn: 2, minute: 2, topic: 'startup', type: 'threshold', statement: '', quote: '', entities: ['SGM-07'], value: 12, unit: 'Schuss', condition: null, confirmed: false } as Claim
  expect(nextMove({ ...base, unchecked: [c] }, pcfg.interview)).toMatchObject({ move: 'confirm', about: { value: 12, entity: 'SGM-07' } })
  expect(nextMove({ ...base, unchecked: [c], confirm: false }, pcfg.interview).move).not.toBe('confirm')
})

test('two answers in a row with nothing new close a topic; time up ends the interview', () => {
  const state = { startup: { asked: ['open', 'failure'], found: new Set(), empties: 2, closed: false } } as unknown as Record<string, TopicState>
  expect(nextMove({ ...base, state }, pcfg.interview).topic).not.toBe('startup')
  expect(nextMove({ ...base, minute: 29 }, pcfg.interview).move).toBe('wrap')
})
