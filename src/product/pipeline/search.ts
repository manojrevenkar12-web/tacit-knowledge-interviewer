/** Hybrid search for German and English text: BM25 on stemmed words and cosine on hashed embeddings, fused by rank. */

const STOP = new Set(
  'der die das den dem des ein eine einen einem einer und oder aber wir ich sie es ist sind wird werden bei mit von zu zum zur im in an auf für aus nach vor über unter wie was wann wer wo warum welche welcher welches muss müssen darf dürfen kann können man nicht nur auch noch immer sehr so dann da the a an and or of to in on is are be for with what when who how why which'.split(' '),
)

/**
 * Words for search. German needs two small things beyond lower-casing: participles lose their "ge" ("angefahren" →
 * "anfahren") and long compounds also count by their first six letters ("Mahlgutanteil" meets "Mahlgut").
 */
export function tokens(text: string): string[] {
  const out: string[] = []
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 2 || STOP.has(raw)) continue
    const t = raw.replace(/^(an|auf|ab|ein|aus|vor|zu|nach|mit)ge(\p{L}{3,})/u, '$1$2')
    const stem = t.length > 5 ? t.replace(/(ungen|ung|en|er|es|e|n|s)$/, '') : t
    out.push(stem)
    if (stem.length >= 9) out.push(`${stem.slice(0, 6)}~`)
    if (stem.length >= 6 && stem.length < 9) out.push(`${stem.slice(0, 6)}~`)
  }
  return out
}

function fnv(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** A deterministic stand-in for an embedding model: hashed words and character trigrams, normalised. */
export function embed(text: string, dims: number): number[] {
  const v = new Array<number>(dims).fill(0)
  for (const t of tokens(text)) {
    v[fnv(`w:${t}`) % dims] += 1
    const p = `^${t}$`
    for (let i = 0; i + 3 <= p.length; i++) v[fnv(`c:${p.slice(i, i + 3)}`) % dims] += 0.3
  }
  const n = Math.hypot(...v) || 1
  return v.map((x) => x / n)
}

export interface Doc {
  id: string
  text: string
}

export interface Hit {
  id: string
  score: number
  lexical: number
  semantic: number
}

export class HybridIndex {
  private readonly docs: { id: string; toks: string[]; vec: number[] }[]
  private readonly df = new Map<string, number>()
  private readonly avg: number

  constructor(
    docs: Doc[],
    private readonly cfg: { dims: number; rrfK: number },
  ) {
    this.docs = docs.map((d) => ({ id: d.id, toks: tokens(d.text), vec: embed(d.text, cfg.dims) }))
    for (const d of this.docs) for (const t of new Set(d.toks)) this.df.set(t, (this.df.get(t) ?? 0) + 1)
    this.avg = this.docs.reduce((s, d) => s + d.toks.length, 0) / Math.max(1, this.docs.length)
  }

  search(query: string, k: number, only?: (id: string) => boolean): Hit[] {
    const q = new Set(tokens(query))
    const qv = embed(query, this.cfg.dims)
    const N = this.docs.length
    const scored = this.docs
      .filter((d) => !only || only(d.id))
      .map((d) => {
        let lex = 0
        for (const t of q) {
          const tf = d.toks.filter((x) => x === t).length
          if (!tf) continue
          const df = this.df.get(t) ?? 0
          lex += (Math.log(1 + (N - df + 0.5) / (df + 0.5)) * tf * 2.2) / (tf + 1.2 * (0.25 + (0.75 * d.toks.length) / this.avg))
        }
        let sem = 0
        for (let i = 0; i < qv.length; i++) sem += qv[i] * d.vec[i]
        return { id: d.id, lexical: lex, semantic: sem }
      })
    const lr = [...scored].sort((a, b) => b.lexical - a.lexical || a.id.localeCompare(b.id)).map((s) => s.id)
    const sr = [...scored].sort((a, b) => b.semantic - a.semantic || a.id.localeCompare(b.id)).map((s) => s.id)
    return scored
      .map((s) => ({ ...s, score: 1 / (this.cfg.rrfK + lr.indexOf(s.id) + 1) + 1 / (this.cfg.rrfK + sr.indexOf(s.id) + 1) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, k)
  }
}
