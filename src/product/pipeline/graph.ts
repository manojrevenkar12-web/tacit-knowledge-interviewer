import type { Claim } from './claims.ts'

export type ClaimStatus = 'corroborated' | 'single source' | 'conflict' | 'superseded'

export interface GraphClaim extends Claim {
  status: ClaimStatus
  /** Other experts who said the same. */
  alsoSaidBy: string[]
  /** Claims with the same subject and a different value. */
  conflictsWith: string[]
  supersededBy: string | null
}

/** What a value is about: the topic, the identifiers, the unit and the condition. Two claims with one key and two values disagree. */
function sameWords(a: string, b: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  return n(a) === n(b)
}

export function subjectKey(c: Claim): string | null {
  if (c.value === null || !c.unit) return null
  return [c.topic, c.entities.join('+'), c.unit, (c.condition ?? '').toLowerCase().trim()].join('|')
}

/**
 * The knowledge graph: claims with provenance, linked by what they are about. Code decides what corroborates, what
 * conflicts and what an expert corrected; nothing is merged away, so every answer can cite who said it and when.
 */
export class KnowledgeGraph {
  readonly claims = new Map<string, GraphClaim>()

  /**
   * Add claims. An expert saying the same thing again (often in answer to a check) is not a second claim: it marks the
   * first one as checked.
   */
  add(...cs: Claim[]): void {
    for (const c of cs) {
      const same = [...this.claims.values()].find((o) => o.expert === c.expert && o.id !== c.id && (sameWords(o.quote, c.quote) || (subjectKey(o) !== null && subjectKey(o) === subjectKey(c) && o.value === c.value)))
      if (same) {
        same.confirmed ||= c.confirmed
        continue
      }
      this.claims.set(c.id, { ...c, status: 'single source', alsoSaidBy: [], conflictsWith: [], supersededBy: null })
    }
    this.relink()
  }

  private relink(): void {
    const all = [...this.claims.values()]
    for (const c of all) Object.assign(c, { alsoSaidBy: [], conflictsWith: [], supersededBy: null, status: 'single source' as ClaimStatus })
    const bySubject = new Map<string, GraphClaim[]>()
    for (const c of all) {
      const k = subjectKey(c)
      if (k) bySubject.set(k, [...(bySubject.get(k) ?? []), c])
    }
    for (const group of bySubject.values()) {
      // An expert's later answer to a confirm question replaces what the same expert said before.
      for (const c of group) {
        const later = group.filter((o) => o.expert === c.expert && o.id !== c.id && (o.interviewId > c.interviewId || (o.interviewId === c.interviewId && o.turn > c.turn)))
        const fix = later.find((o) => o.confirmed)
        if (fix && fix.value !== c.value) c.supersededBy = fix.id
      }
      const live = group.filter((c) => !c.supersededBy)
      for (const c of live) {
        c.alsoSaidBy = [...new Set(live.filter((o) => o.expert !== c.expert && o.value === c.value).map((o) => o.expert))]
        c.conflictsWith = live.filter((o) => o.value !== c.value).map((o) => o.id)
      }
    }
    // Claims without a value corroborate when another expert's quote names the same identifiers on the same topic with the same type.
    for (const c of all) {
      if (subjectKey(c)) continue
      c.alsoSaidBy = [...new Set(all.filter((o) => o.expert !== c.expert && !subjectKey(o) && o.topic === c.topic && o.type === c.type && o.entities.length > 0 && o.entities.join() === c.entities.join()).map((o) => o.expert))]
    }
    for (const c of all) c.status = c.supersededBy ? 'superseded' : c.conflictsWith.length ? 'conflict' : c.alsoSaidBy.length || c.confirmed ? 'corroborated' : 'single source'
  }

  live(): GraphClaim[] {
    return [...this.claims.values()].filter((c) => c.status !== 'superseded')
  }

  /** How much each expert has given on each topic, and of which kinds. */
  coverage(): Map<string, Map<string, Set<string>>> {
    const m = new Map<string, Map<string, Set<string>>>()
    for (const c of this.live()) {
      const e = m.get(c.expert) ?? new Map<string, Set<string>>()
      m.set(c.expert, e)
      const t = e.get(c.topic) ?? new Set<string>()
      e.set(c.topic, t)
      t.add(c.type)
    }
    return m
  }
}
