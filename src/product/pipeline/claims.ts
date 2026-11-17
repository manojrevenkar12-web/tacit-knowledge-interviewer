import { z } from 'zod'
import { readText } from '../../config.ts'
import type { KuType } from '../../wire.ts'
import type { Gateway } from '../llm/gateway.ts'
import { entitiesIn, numbersIn, type Glossary } from './normalize.ts'

export const Extracted = z.object({
  claims: z
    .array(
      z.object({
        type: z.enum(['procedure', 'threshold', 'rule', 'exception', 'rationale', 'contact']),
        quote: z.string().min(8),
        statement_en: z.string().min(5),
        entities_said: z.array(z.string()).default([]),
        value: z.number().nullable(),
        unit: z.string().nullable(),
        condition: z.string().nullable(),
      }),
    )
    .max(8),
})

/** One piece of knowledge as the graph holds it, with where it was said. */
export interface Claim {
  id: string
  expert: string
  interviewId: string
  turn: number
  minute: number
  topic: string
  type: KuType
  statement: string
  quote: string
  entities: string[]
  value: number | null
  unit: string | null
  condition: string | null
  /** Said in answer to a confirm question. */
  confirmed: boolean
}

const UNIT_WORDS: [RegExp, string][] = [
  [/^(stunden|stunde|h)$/i, 'h'],
  [/^(grad|°c)$/i, '°C'],
  [/^(prozent|%)$/i, '%'],
  [/^(minuten|minute|min)$/i, 'min'],
  [/^(kilo|kg|kilogramm)$/i, 'kg'],
  [/^bar$/i, 'bar'],
  [/^(tonnen|t)$/i, 't'],
  [/^euro$/i, 'EUR'],
  [/^schuss$/i, 'Schuss'],
  [/^teile$/i, 'Teile'],
  [/^betriebsstunden$/i, 'h'],
]

/** Number–unit pairs as they stand in the text: "6 Stunden", "achtzig Grad". */
export function measures(text: string): { value: number; unit: string }[] {
  const toks = text.split(/[\s,;:()]+/).map((t) => t.replace(/[.?!]+$/, ''))
  const out: { value: number; unit: string }[] = []
  for (let i = 0; i < toks.length - 1; i++) {
    const n = numbersIn(toks[i])
    if (n.length !== 1) continue
    const unit = UNIT_WORDS.find(([re]) => re.test(toks[i + 1]))?.[1]
    if (unit) out.push({ value: n[0], unit })
  }
  return out
}

function normUnit(u: string | null): string | null {
  if (!u) return null
  return UNIT_WORDS.find(([re]) => re.test(u.trim()))?.[1] ?? u.trim()
}

const SYSTEM = readText('prompts/extract.md')

export interface SmallTalk {
  functionWords: string[]
  genericNouns: string[]
}

/**
 * Knowledge names things. A quote with no identifier, no measure and no noun of substance ("Das hat sich über die
 * Jahre so eingespielt.") is small talk, whatever the reader made of it.
 */
export function hasSubstance(quote: string, g: Glossary, st: SmallTalk): boolean {
  if (entitiesIn(quote, g).length || measures(quote).length) return true
  const words = quote.split(/[^\p{L}\p{N}-]+/u).filter(Boolean)
  const nouns = words.filter((w, i) => /^\p{Lu}/u.test(w) && !st.genericNouns.includes(w) && (i > 0 || !st.functionWords.includes(w)))
  return nouns.length > 0
}

export interface TurnInput {
  interviewId: string
  expert: string
  turn: number
  minute: number
  topic: string
  question: string
  answer: string
  confirm: boolean
}

/**
 * The model proposes claims with quotes; code keeps only quotes that are in the answer, takes identifiers and numbers
 * from the quote itself, and drops the model's reading where the words say otherwise.
 */
export async function readTurn(gw: Gateway, g: Glossary, st: SmallTalk, t: TurnInput): Promise<{ claims: Claim[]; dropped: string[]; model: string }> {
  const user = `Interview-ID: ${t.interviewId}\nTurn: ${t.turn}\nTopic: ${t.topic}\n\nQuestion: ${t.question}\n\nAnswer (speech-to-text): ${t.answer}`
  const out = await gw.json('extract', SYSTEM, user, Extracted)
  const dropped: string[] = []
  const claims: Claim[] = []
  for (const [i, c] of out.value.claims.entries()) {
    if (!t.answer.includes(c.quote) || !hasSubstance(c.quote, g, st)) {
      dropped.push(c.quote)
      continue
    }
    const pairs = measures(c.quote)
    const unit = normUnit(c.unit)
    let value: number | null = null
    let u: string | null = null
    const byValue = pairs.find((p) => p.value === c.value)
    const byUnit = pairs.find((p) => p.unit === unit)
    const chosen = byValue ?? byUnit ?? (c.value !== null ? pairs[0] : undefined)
    if (chosen) [value, u] = [chosen.value, chosen.unit]
    claims.push({
      id: `${t.interviewId}#${t.turn}.${i}`,
      expert: t.expert,
      interviewId: t.interviewId,
      turn: t.turn,
      minute: t.minute,
      topic: t.topic,
      type: c.type,
      statement: c.statement_en,
      quote: c.quote,
      entities: entitiesIn(c.quote, g),
      value,
      unit: u,
      condition: c.condition,
      confirmed: t.confirm,
    })
  }
  return { claims, dropped, model: out.model }
}
