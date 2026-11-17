/**
 * Identifiers from speech. Speech-to-text writes "SGM sieben", "Werkzeug 4711" or "PA sechs GF dreißig"; the
 * knowledge graph needs SGM-07, WZ-4711, PA6-GF30. Identifiers decide: a mention counts only when it parses to an
 * identifier in the company's master data.
 */

export interface Glossary {
  machines: string[]
  tools: string[]
  materials: Record<string, string[]>
  robots: string[]
  customers: Record<string, string[]>
}

const UNITS: Record<string, number> = { null: 0, ein: 1, eins: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19 }
const TENS: Record<string, number> = { zwanzig: 20, dreißig: 30, vierzig: 40, fünfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90 }

/** A German number word ("fünfundsiebzig", "dreitausend", "zweitausendfünfhundert") to its value, or null. */
export function parseGermanNumber(word: string): number | null {
  let w = word.toLowerCase()
  if (!w) return null
  let total = 0
  const th = w.indexOf('tausend')
  if (th >= 0) {
    const head = w.slice(0, th)
    const n = head ? parseGermanNumber(head) : 1
    if (n === null) return null
    total += n * 1000
    w = w.slice(th + 7)
    if (!w) return total
  }
  const hu = w.indexOf('hundert')
  if (hu >= 0) {
    const head = w.slice(0, hu)
    const n = head ? parseGermanNumber(head) : 1
    if (n === null) return null
    total += n * 100
    w = w.slice(hu + 7)
    if (!w) return total
  }
  if (w in UNITS) return total + UNITS[w]
  if (w in TENS) return total + TENS[w]
  const und = w.indexOf('und')
  if (und > 0) {
    const o = UNITS[w.slice(0, und)]
    const t = TENS[w.slice(und + 3)]
    if (o !== undefined && t !== undefined) return total + o + t
  }
  return null
}

/** Every number in a text, written as digits or as German words. */
export function numbersIn(text: string): number[] {
  const out: number[] = []
  for (const tok of text.split(/[\s,;:()]+/)) {
    const t = tok.replace(/[.?!]+$/, '')
    if (/^\d+([.,]\d+)?$/.test(t)) out.push(Number(t.replace(',', '.')))
    else if (/^[a-zäöüß]+$/i.test(t) && t.length > 2) {
      const n = parseGermanNumber(t)
      if (n !== null) out.push(n)
    }
  }
  return out
}

function num(s: string): number | null {
  return /^\d+$/.test(s) ? Number(s) : parseGermanNumber(s)
}

/** The identifiers a piece of text mentions. */
export function entitiesIn(text: string, g: Glossary): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(/\bSGM[\s-]*(\d{1,2}|[a-zäöüß]+)\b/gi)) {
    const n = num(m[1])
    const id = n !== null ? `SGM-${String(n).padStart(2, '0')}` : null
    if (id && g.machines.includes(id)) found.add(id)
  }
  for (const m of text.matchAll(/\b(?:WZ|Werkzeug)[\s-]*(\d{2})\s?(\d{2})\b/gi)) {
    const id = `WZ-${m[1]}${m[2]}`
    if (g.tools.includes(id)) found.add(id)
  }
  for (const m of text.matchAll(/\bPA[\s-]*(\d|[a-zäöüß]+)[\s-]*GF[\s-]*(\d{2}|[a-zäöüß]+)\b/gi)) {
    const id = `PA${num(m[1])}-GF${num(m[2])}`
    if (id in g.materials) found.add(id)
  }
  for (const m of text.matchAll(/\bPP[\s-]*T[\s-]*(\d{2}|[a-zäöüß]+)\b/gi)) {
    const id = `PP-T${num(m[1])}`
    if (id in g.materials) found.add(id)
  }
  if (/\bPOM[\s-]*C\b/i.test(text)) found.add('POM-C')
  for (const [id, names] of Object.entries(g.materials)) if (names.some((n) => new RegExp(`\\b${n}\\b`).test(text))) found.add(id)
  for (const m of text.matchAll(/\b(?:RB|Robo)[\s-]*(\d|[a-zäöüß]+)\b/gi)) {
    const n = num(m[1])
    if (n !== null && g.robots.includes(`RB-${n}`)) found.add(`RB-${n}`)
  }
  for (const [id, names] of Object.entries(g.customers)) if (names.some((n) => text.includes(n))) found.add(id)
  return [...found].sort()
}
