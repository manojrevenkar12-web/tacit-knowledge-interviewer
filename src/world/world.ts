import { Keyed } from '../keyed.ts'
import type { Answer, ExpertProfile, Question, StaffQuestion, TopicProfile } from '../wire.ts'
import { ENTITIES, EXPERTS, FILLER, KNOWLEDGE, TOPICS, UNKNOWN_QUESTIONS, type KuTemplate } from './company.ts'
import { germanNumber } from './speech.ts'

export interface WorldConfig {
  seed: string
  /** Chance that a second person also holds a piece of knowledge. */
  secondHolder: number
  /** Chance a holder states a threshold wrongly from memory (corrects it when asked to confirm). */
  misremember: number
  /** Chance a second holder still works with an outdated value. */
  outdated: number
  /** Chance speech-to-text writes a number as German words. */
  spokenNumber: number
  tacitJitter: number
  movePower: Record<string, number>
  cueMatch: number
  fatigueAfterMin: number
  minutes: { question: number; sentence: number; filler: number }
  maxPerAnswer: number
  confirmCorrects: number
  staffQuestions: number
  unknownQuestions: number
  interviewMinutes: number
  /** The campaign: hours of expert time the customer gives, and at most this many sessions. */
  expertHours: number
  maxSessions: number
  models: Record<string, ModelNoise>
}

export interface ModelNoise {
  outage: number
  dropClaim: number
  bendQuote: number
  misreadValue: number
  fillerClaim: number
  wrongType: number
  extraCite: number
  missCite: number
  inventWhenEmpty: number
  ragInvent: number
}

/** One piece of knowledge as it is in this company: its value, who holds it, how hidden it is. */
export interface Ku extends KuTemplate {
  value: number | null
  holders: string[]
  tacitHere: number
  /** Holder → what they say the value is when not asked to confirm. */
  stated: Record<string, number | null>
  /** Holder whose value is out of date, if any. */
  outdatedHolder: string | null
}

/** Where a piece of knowledge sits in a transcript: the world's record of what was said. */
export interface Span {
  interviewId: string
  turn: number
  kuId: string | null
  start: number
  end: number
  valueStated: number | null
  wrongValue: boolean
}

interface InterviewState {
  expert: string
  minute: number
  turn: number
}


export class World {
  readonly k: Keyed
  readonly kus: Ku[]
  readonly spans: Span[] = []
  /** What speech-to-text wrote for each answer, by interview and turn. */
  readonly texts = new Map<string, string>()
  /** Staff question id → the knowledge it asks about. */
  readonly gold = new Map<string, string | null>()
  private readonly interviews = new Map<string, InterviewState>()
  /** expert → knowledge ids already said (to anyone, in any interview). */
  private readonly said = new Map<string, Set<string>>()
  /** expert → param → corrected after a confirm question. */
  private readonly corrected = new Map<string, Set<string>>()
  private interviewCount = 0

  constructor(readonly cfg: WorldConfig) {
    this.k = new Keyed(cfg.seed)
    this.kus = KNOWLEDGE.map((t) => this.instantiate(t))
  }

  get experts(): ExpertProfile[] {
    return EXPERTS
  }

  get topics(): TopicProfile[] {
    return TOPICS
  }

  private instantiate(t: KuTemplate): Ku {
    const k = this.k
    let value: number | null = null
    if (t.range) {
      const [lo, hi, step] = t.range
      const n = Math.round((hi - lo) / step)
      value = lo + step * k.int(0, n, t.id, 'v')
    }
    const pool = EXPERTS.filter((e) => e.topics.includes(t.topic))
    // Critical knowledge tends to sit with the people about to leave.
    const leaving = pool.filter((e) => e.leavesInMonths !== null)
    const first = t.critical && leaving.length && k.chance(0.7, t.id, 'lv') ? k.pick(leaving, t.id, 'h1l') : k.pick(pool, t.id, 'h1')
    const holders = [first.id]
    const others = pool.filter((e) => e.id !== first.id)
    if (others.length && k.chance(this.cfg.secondHolder, t.id, 'h2?')) holders.push(k.pick(others, t.id, 'h2').id)
    const tacitHere = Math.min(0.95, Math.max(0.05, t.tacit + k.between(-this.cfg.tacitJitter, this.cfg.tacitJitter, t.id, 'tj')))
    const stated: Record<string, number | null> = {}
    let outdatedHolder: string | null = null
    for (const [i, h] of holders.entries()) {
      stated[h] = value
      if (value === null || !t.range) continue
      const step = t.range[2]
      if (i === 1 && k.chance(this.cfg.outdated, t.id, 'old')) {
        outdatedHolder = h
        stated[h] = value - step >= t.range[0] ? value - step : value + step
      } else if (k.chance(this.cfg.misremember, t.id, h, 'mis')) {
        stated[h] = value + step <= t.range[1] ? value + step : value - step
      }
    }
    return { ...t, value, holders, tacitHere, stated, outdatedHolder }
  }

  ku(id: string): Ku | undefined {
    return this.kus.find((x) => x.id === id)
  }

  startInterview(expert: string): string {
    const id = `${this.cfg.seed}-iv${String(++this.interviewCount).padStart(2, '0')}-${expert}`
    this.interviews.set(id, { expert, minute: 0, turn: 0 })
    return id
  }

  /** Take part in an interview someone else named. */
  startInterviewAs(id: string, expert: string): void {
    this.interviews.set(id, { expert, minute: 0, turn: 0 })
  }

  private spoken(entity: string, key: string): string {
    const e = ENTITIES.find((x) => x.id === entity)!
    return this.k.pick(e.spoken, key, 'spoken')
  }

  private number(v: number, key: string): string {
    return this.k.chance(this.cfg.spokenNumber, key, 'num') ? germanNumber(v) : String(v)
  }

  private sentence(ku: Ku, value: number | null, key: string): string {
    let s = ku.de
    ku.entities.forEach((e, i) => (s = s.replace(`{E${i}}`, this.spoken(e, `${key}|${i}`))))
    if (value !== null) s = s.replace('{v}', this.number(value, key))
    return s
  }

  /** The expert answers. Knowledge comes out when the question fits it, less as the interview wears on. */
  respond(q: Question): Answer {
    const st = this.interviews.get(q.interviewId)
    if (!st) throw new Error(`no interview ${q.interviewId}`)
    st.turn = q.turn
    const cfg = this.cfg
    const key = `${q.interviewId}|${q.turn}`
    const expert = EXPERTS.find((e) => e.id === st.expert)!
    const said = this.said.get(expert.id) ?? new Set<string>()
    this.said.set(expert.id, said)
    const fixed = this.corrected.get(expert.id) ?? new Set<string>()
    this.corrected.set(expert.id, fixed)
    const parts: { text: string; ku: Ku | null; value: number | null; wrong: boolean }[] = []
    st.minute += cfg.minutes.question

    if (q.move === 'wrap') {
      parts.push({ text: 'Gern, das war es von meiner Seite.', ku: null, value: null, wrong: false })
    } else if (!expert.topics.includes(q.topic) && !this.kus.some((x) => x.topic === q.topic && x.holders.includes(expert.id))) {
      parts.push({ text: 'Damit habe ich wenig zu tun, da fragen Sie besser die Kollegen.', ku: null, value: null, wrong: false })
    } else {
      if (q.move === 'confirm' && q.about) {
        // The expert hears the value and what it was about, and finds what they meant.
        const a = q.about
        const target = this.kus.find((x) => x.topic === q.topic && x.holders.includes(expert.id) && x.value !== null && (x.stated[expert.id] === a.value || x.value === a.value) && (a.entity === null || x.entities.includes(a.entity)))
        if (target && target.value !== null) {
          const was = target.stated[expert.id]
          const misremembered = was !== target.value && target.outdatedHolder !== expert.id
          if (misremembered && !fixed.has(target.id) && this.k.chance(cfg.confirmCorrects, key, 'fix')) {
            fixed.add(target.id)
            parts.push({ text: `Nein, warten Sie, das stimmt nicht ganz. ${this.sentence(target, target.value, `${key}|fix`)}`, ku: target, value: target.value, wrong: false })
          } else {
            const v = fixed.has(target.id) ? target.value : was
            parts.push({ text: `Ja, das passt so. ${this.sentence(target, v, `${key}|again`)}`, ku: target, value: v, wrong: v !== target.value })
          }
        }
      }
      const fatigue = st.minute > cfg.fatigueAfterMin ? Math.max(0.3, 1 - (st.minute - cfg.fatigueAfterMin) / 20) : 1
      const candidates = this.kus.filter((x) => x.topic === q.topic && x.holders.includes(expert.id) && !said.has(x.id) && !parts.some((p) => p.ku === x))
      const surfaced = candidates
        .map((x) => {
          const p = (x.cue === q.move ? cfg.cueMatch : (1 - x.tacitHere) * (cfg.movePower[q.move] ?? 0.2)) * fatigue
          return { x, draw: this.k.u(key, x.id, 'surface'), p }
        })
        .filter((c) => c.draw < c.p)
        .sort((a, b) => a.draw - b.draw)
        .slice(0, cfg.maxPerAnswer)
      for (const { x } of surfaced) {
        const v = x.value === null ? null : fixed.has(x.id) ? x.value : x.stated[expert.id]
        parts.push({ text: this.sentence(x, v, `${key}|${x.id}`), ku: x, value: v, wrong: v !== x.value })
      }
      if (!parts.length) parts.push({ text: this.k.pick(['Mehr fällt mir dazu gerade nicht ein.', 'Hm, da wüsste ich jetzt nichts Besonderes.', 'Das läuft eigentlich ganz normal.'], key, 'none'), ku: null, value: null, wrong: false })
      if (this.k.chance(0.45, key, 'filler')) parts.splice(this.k.int(0, parts.length, key, 'fpos'), 0, { text: this.k.pick(FILLER, key, 'f'), ku: null, value: null, wrong: false })
    }
    let text = ''
    for (const p of parts) {
      const start = text.length ? text.length + 1 : 0
      text = text ? `${text} ${p.text}` : p.text
      this.spans.push({ interviewId: q.interviewId, turn: q.turn, kuId: p.ku?.id ?? null, start, end: text.length, valueStated: p.value, wrongValue: p.wrong })
      if (p.ku) said.add(p.ku.id)
      st.minute += p.ku ? cfg.minutes.sentence : cfg.minutes.filler
    }
    this.texts.set(`${q.interviewId}|${q.turn}`, text)
    return { interviewId: q.interviewId, turn: q.turn, text, minute: Math.round(st.minute * 100) / 100, tired: fatigue(st.minute, cfg) < 0.35 }
  }

  /** The span of a transcript that a quote comes from. */
  spanOf(interviewId: string, turn: number, quote: string): Span | null {
    const text = this.texts.get(`${interviewId}|${turn}`)
    if (text === undefined) return null
    const at = text.indexOf(quote)
    if (at < 0) return null
    const end = at + quote.length
    return this.spans.find((s) => s.interviewId === interviewId && s.turn === turn && at >= s.start && end <= s.end) ?? null
  }

  /** What new colleagues ask during the period: most about real knowledge, some about things nobody knows. */
  staffQuestions(): (StaffQuestion & { gold: string | null })[] {
    const names = ['Lea (Azubi)', 'Marco (neuer Einrichter)', 'Aylin (neue Schichtleiterin)', 'Jan (Werkstudent Qualität)', 'Nina (neue Einkäuferin)']
    const known = [...this.kus].sort((a, b) => this.k.u(a.id, 'ask') - this.k.u(b.id, 'ask')).slice(0, this.cfg.staffQuestions)
    const unknown = [...UNKNOWN_QUESTIONS].sort((a, b) => this.k.u(a.id, 'ask') - this.k.u(b.id, 'ask')).slice(0, this.cfg.unknownQuestions)
    const out = [
      ...known.map((x) => ({ id: `${this.cfg.seed}-q-${x.id}`, text: x.ask, askedBy: this.k.pick(names, x.id, 'who'), gold: x.id })),
      ...unknown.map((x) => ({ id: `${this.cfg.seed}-q-${x.id}`, text: x.text, askedBy: this.k.pick(names, x.id, 'who'), gold: null })),
    ].sort((a, b) => this.k.u(a.id, 'order') - this.k.u(b.id, 'order'))
    for (const q of out) this.gold.set(q.id, q.gold)
    return out
  }
}

function fatigue(minute: number, cfg: WorldConfig): number {
  return minute > cfg.fatigueAfterMin ? Math.max(0.3, 1 - (minute - cfg.fatigueAfterMin) / 20) : 1
}
