import { describe, expect, test } from 'vitest'
import { hasSubstance, measures, type Claim } from '../src/product/pipeline/claims.ts'
import { KnowledgeGraph } from '../src/product/pipeline/graph.ts'
import { entitiesIn, numbersIn, parseGermanNumber } from '../src/product/pipeline/normalize.ts'
import { tokens } from '../src/product/pipeline/search.ts'
import { g, pcfg } from './helpers.ts'

describe('identifiers from speech', () => {
  test('spoken machine, mould, material, robot and customer names become identifiers', () => {
    expect(entitiesIn('Die SGM sieben, das Werkzeug 4711, PA sechs GF dreißig, RB zwei und Brenner', g)).toEqual(['KD-1001', 'PA6-GF30', 'RB-2', 'SGM-07', 'WZ-4711'])
    expect(entitiesIn('WZ 22 90 und PP T 20 an der SGM 11', g)).toEqual(['PP-T20', 'SGM-11', 'WZ-2290'])
  })
  test('a number that is not a known identifier names nothing', () => {
    expect(entitiesIn('SGM neun und Werkzeug 1234', g)).toEqual([])
  })
  test('German number words', () => {
    expect(parseGermanNumber('fünfundsiebzig')).toBe(75)
    expect(parseGermanNumber('zweitausendfünfhundert')).toBe(2500)
    expect(parseGermanNumber('Werkzeug')).toBeNull()
    expect(numbersIn('sechs Stunden bei achtzig Grad, 45 Minuten')).toEqual([6, 80, 45])
  })
  test('a value is read with its unit from the words: "sechs Stunden bei achtzig Grad" is 6 h, and 80 °C', () => {
    expect(measures('trocknen wir sechs Stunden bei achtzig Grad.')).toEqual([{ value: 6, unit: 'h' }, { value: 80, unit: '°C' }])
  })
})

test('small talk is not knowledge', () => {
  for (const s of ['Das hat sich über die Jahre so eingespielt.', 'Mehr fällt mir dazu gerade nicht ein.', 'Na ja, da gibt es verschiedene Meinungen im Team.']) expect(hasSubstance(s, g, pcfg.smallTalk)).toBe(false)
  for (const s of ['Farben immer von hell nach dunkel planen, nie umgekehrt.', 'Offene Störungen kommen ins Übergabebuch, nicht nur mündlich.', 'Der Trockner wird immer eine Schicht vorher eingeschaltet.']) expect(hasSubstance(s, g, pcfg.smallTalk)).toBe(true)
})

test('German search words: participles and compounds meet their base forms', () => {
  expect(tokens('angefahren')).toEqual(tokens('anfahren'))
  expect(tokens('Mahlgutanteil')).toContain(tokens('Mahlgut').at(-1))
})

function claim(over: Partial<Claim>): Claim {
  const v = over.value === undefined ? 6 : over.value
  return { quote: `PA6-GF30 trocknen wir ${v} Stunden (${over.condition ?? 'opened bag'}, ${over.expert ?? 'E1'}).`, id: 'c', expert: 'E1', interviewId: 'iv1', turn: 1, minute: 1, topic: 'drying', type: 'threshold', statement: '', entities: ['PA6-GF30'], value: 6, unit: 'h', condition: 'opened bag', confirmed: false, ...over }
}

describe('the knowledge graph', () => {
  test('two experts, one value: corroborated. Two values, same subject: a conflict. Another condition: no conflict', () => {
    const k = new KnowledgeGraph()
    k.add(claim({ id: 'a' }), claim({ id: 'b', expert: 'E3', interviewId: 'iv2' }), claim({ id: 'c', expert: 'E5', interviewId: 'iv3', value: 5 }), claim({ id: 'd', expert: 'E3', interviewId: 'iv2', turn: 2, value: 3, condition: 'fresh bag' }))
    const s = Object.fromEntries([...k.claims.values()].map((c) => [c.id, c.status]))
    expect(s).toEqual({ a: 'conflict', b: 'conflict', c: 'conflict', d: 'single source' })
    expect(k.claims.get('c')!.conflictsWith.sort()).toEqual(['a', 'b'])
    expect(k.claims.get('a')!.alsoSaidBy).toEqual(['E3'])
  })
  test("an expert's answer to a check replaces what the same expert said before", () => {
    const k = new KnowledgeGraph()
    k.add(claim({ id: 'early', value: 7 }), claim({ id: 'fixed', turn: 4, value: 6, confirmed: true }))
    expect(k.claims.get('early')!.status).toBe('superseded')
    expect(k.claims.get('fixed')!.status).toBe('corroborated')
    expect(k.live().map((c) => c.id)).toEqual(['fixed'])
  })
  test('the same expert saying the same thing again marks it checked instead of adding a second claim', () => {
    const k = new KnowledgeGraph()
    k.add(claim({ id: 'first' }), claim({ id: 'again', turn: 3, confirmed: true }))
    expect([...k.claims.keys()]).toEqual(['first'])
    expect(k.claims.get('first')!.status).toBe('corroborated')
  })
})
