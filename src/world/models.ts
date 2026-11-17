import { Keyed } from '../keyed.ts'
import { EXPERTS, TOPICS } from './company.ts'
import type { ModelNoise, World } from './world.ts'

/**
 * The language models of the simulation behind an OpenAI-compatible endpoint. They read what they are sent and make
 * the mistakes models make, keyed by the request so every design that sends the same request gets the same answer.
 */

const MOVE_DE: Record<string, (topic: string) => string> = {
  open: (t) => `Wie läuft bei Ihnen das Thema ${t} ab?`,
  example: (t) => `Können Sie mir ein konkretes Beispiel geben, wann es bei ${t} zuletzt schwierig war?`,
  failure: (t) => `Was geht bei ${t} typischerweise schief, und woran merken Sie das?`,
  numbers: (t) => `Auf welche Werte und Einstellungen achten Sie bei ${t}?`,
  why: (t) => `Warum machen Sie das bei ${t} genau so?`,
  newcomer: (t) => `Was würden Sie einem neuen Kollegen zu ${t} sagen, das in keinem Handbuch steht?`,
  who: (t) => `Wen rufen Sie bei ${t} an, wenn Sie nicht weiterkommen?`,
  wrap: () => 'Vielen Dank für Ihre Zeit. Gibt es zum Schluss noch etwas, das Ihr Nachfolger unbedingt wissen sollte?',
}

function bend(q: string): string {
  return q.includes(',') ? q.replace(',', '') : q.replace(/\s+/, '  ')
}

export interface ModelCall {
  model: string
  task: string
  promptTokens: number
  completionTokens: number
  failed: boolean
}

export class SimulatedModels {
  readonly calls: ModelCall[] = []
  private readonly attempts = new Map<string, number>()
  private readonly k: Keyed

  constructor(
    private readonly world: World,
    private readonly noise: Record<string, ModelNoise>,
  ) {
    this.k = new Keyed(`${world.cfg.seed}|models`)
  }

  readonly fetch = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const req = JSON.parse(String(init?.body)) as { model: string; messages: { role: string; content: string }[] }
    const system = req.messages.find((m) => m.role === 'system')?.content ?? ''
    const user = req.messages.find((m) => m.role === 'user')?.content ?? ''
    const task = system.match(/^# task: (\w+)/m)?.[1] ?? 'unknown'
    const subject = user.match(/Interview-ID: (\S+)\nTurn: (\d+)/)?.slice(1).join('#') ?? (() => {
      const j = JSON.parse(user) as Record<string, unknown>
      return String(j.questionId ?? `${j.interviewId}#${j.turn}`)
    })()
    const key = `${subject}|${task}|${req.model}`
    const attempt = (this.attempts.get(key) ?? 0) + 1
    this.attempts.set(key, attempt)
    const n = this.noise[req.model]
    const promptTokens = Math.ceil((system.length + user.length) / 4)
    if (!n || this.k.chance(n.outage, key, attempt, 'outage')) {
      this.calls.push({ model: req.model, task, promptTokens, completionTokens: 0, failed: true })
      return new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 503, headers: { 'content-type': 'application/json' } })
    }
    const r = (p: number, ...more: (string | number)[]) => this.k.chance(p, key, attempt, ...more)
    let content: unknown
    if (task === 'phrase') content = this.phrase(JSON.parse(user))
    else if (task === 'interview_free') content = this.free(JSON.parse(user), r)
    else if (task === 'extract') content = this.extract(user, n, r)
    else if (task === 'answer') content = this.answer(JSON.parse(user), n, r)
    else if (task === 'answer_rag') content = this.answerRag(JSON.parse(user), n, r)
    else throw new Error(`unknown task ${task}`)
    const text = JSON.stringify(content)
    const completionTokens = Math.ceil(text.length / 4)
    this.calls.push({ model: req.model, task, promptTokens, completionTokens, failed: false })
    return new Response(
      JSON.stringify({ id: `sim-${key}-${attempt}`, object: 'chat.completion', created: 0, model: req.model, choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  private phrase(j: { topic: string; move: string; about: { value: number; entity: string | null; param: string } | null }) {
    if (j.move === 'confirm' && j.about) {
      const unit = j.about.param.split('|')[2] ?? ''
      const u = { h: 'Stunden', '°C': 'Grad', '%': 'Prozent', min: 'Minuten', kg: 'Kilo', t: 'Tonnen', EUR: 'Euro' }[unit] ?? unit
      return { question: `Sie sagten eben ${j.about.value} ${u}${j.about.entity ? ` bei ${j.about.entity}` : ''}. Gilt das immer so, oder gibt es Fälle, in denen es anders ist?` }
    }
    return { question: (MOVE_DE[j.move] ?? MOVE_DE.open)(j.topic) }
  }

  /** A model interviewing freely: friendly, curious, and drawn to "tell me more". */
  private free(j: { turn: number; topics: string[]; transcript: string }, r: (p: number, ...k: (string | number)[]) => boolean) {
    const topics = j.topics
    const turns = j.transcript ? j.transcript.split('\nI: ').length : 0
    const current = topics[Math.min(topics.length - 1, Math.floor(turns / 5))]
    const u = this.k.u('free', j.turn, topics.join())
    void r
    const move = u < 0.5 ? 'open' : u < 0.68 ? 'example' : u < 0.8 ? 'why' : u < 0.9 ? 'failure' : 'newcomer'
    const topic = this.k.chance(0.1, 'free-switch', j.turn, topics.join()) ? this.k.pick(topics, 'free-topic', j.turn) : current
    const de = TOPICS.find((t) => t.id === topic)?.de ?? topic
    const text = move === 'open' && turns > 0 ? `Spannend. Können Sie mir dazu noch mehr erzählen, gerade zum Thema ${de}?` : MOVE_DE[move](de)
    return { topic, move, question: text }
  }

  private extract(user: string, n: ModelNoise, r: (p: number, ...k: (string | number)[]) => boolean) {
    const [, iid, turn] = user.match(/Interview-ID: (\S+)\nTurn: (\d+)/)!
    const text = this.world.texts.get(`${iid}|${turn}`) ?? ''
    const spans = this.world.spans.filter((s) => s.interviewId === iid && s.turn === Number(turn))
    const claims = []
    for (const [i, s] of spans.entries()) {
      const sentence = text.slice(s.start, s.end)
      if (!s.kuId) {
        if (sentence.length > 20 && r(n.fillerClaim, 'filler', i)) claims.push({ type: 'rule', quote: sentence, statement_en: 'This is how it has been done for years.', entities_said: [], value: null, unit: null, condition: null })
        continue
      }
      if (r(n.dropClaim, 'drop', i)) continue
      const ku = this.world.ku(s.kuId)!
      // The knowledge sentence itself, without the "Nein, warten Sie" or "Ja, das passt so." in front.
      const body = sentence.replace(/^(Nein, warten Sie, das stimmt nicht ganz\.|Ja, das passt so\.)\s*/, '')
      let value = s.valueStated
      if (value !== null && r(n.misreadValue, 'misread', i)) value = value * 10
      const types = ['procedure', 'threshold', 'rule', 'exception', 'rationale', 'contact']
      claims.push({
        type: r(n.wrongType, 'type', i) ? this.k.pick(types.filter((t) => t !== ku.type), key2(iid, turn, i)) : ku.type,
        quote: r(n.bendQuote, 'bend', i) ? bend(body) : body,
        statement_en: ku.en.replace('{v}', String(s.valueStated ?? '')),
        entities_said: ku.entities,
        value,
        unit: ku.unit ?? null,
        condition: ku.param === 'drying_hours_open' ? 'opened bag' : ku.param === 'drying_hours_fresh' ? 'fresh bag' : null,
      })
    }
    return { claims }
  }

  /** Which piece of knowledge a claim states: from the transcript record if this world heard it, else by its wording. */
  private kuOf(c: { interviewId: string; turn: number; quote: string }) {
    const s = this.world.spanOf(c.interviewId, c.turn, c.quote)
    if (s?.kuId) return { ku: this.world.ku(s.kuId)!, value: s.valueStated }
    const ku = this.world.kus.find((k) => wording(k.de).test(c.quote))
    return ku ? { ku, value: null } : null
  }

  /** Answering from the knowledge graph: cites what fits the question, and is told to say when nothing does. */
  private answer(j: { questionId: string; question: string; claims: { id: string; interviewId: string; turn: number; quote: string; value: number | null; unit: string | null; expert: string }[] }, n: ModelNoise, r: (p: number, ...k: (string | number)[]) => boolean) {
    const gold = this.world.gold.get(j.questionId) ?? this.world.kus.find((k) => k.ask === j.question)?.id ?? null
    const relevant = j.claims.filter((c) => gold && this.kuOf(c)?.ku.id === gold)
    if (!relevant.length) {
      if (j.claims.length && r(n.inventWhenEmpty, 'invent')) {
        const c = j.claims[0]
        return { answer: `${expertName(c.expert)} sagt dazu: ${c.quote}`, cites: [c.id], abstain: false }
      }
      return { answer: 'Dazu ist noch nichts erfasst.', cites: [], abstain: true }
    }
    let cites = relevant.filter((_, i) => !(i > 0 && r(n.missCite, 'miss', i)))
    const others = j.claims.filter((c) => !relevant.includes(c))
    if (others.length && r(n.extraCite, 'extra')) cites = [...cites, others[0]]
    return { answer: cites.map((c) => `${expertName(c.expert)}: ${c.quote}`).join(' '), cites: cites.map((c) => c.id), abstain: false }
  }

  /** Answering from transcript chunks: takes the first chunk that seems to fit, and fills gaps by guessing. */
  private answerRag(j: { questionId: string; chunks: { id: string; interviewId: string; turn: number; text: string }[] }, n: ModelNoise, r: (p: number, ...k: (string | number)[]) => boolean) {
    const gold = this.world.gold.get(j.questionId) ?? null
    for (const ch of j.chunks) {
      const s = this.world.spans.find((x) => x.interviewId === ch.interviewId && x.turn === ch.turn && x.kuId === gold)
      if (s) {
        const text = this.world.texts.get(`${ch.interviewId}|${ch.turn}`)!.slice(s.start, s.end)
        return { answer: text, source: ch.id, abstain: false }
      }
    }
    if (r(n.ragInvent, 'invent')) {
      const ku = gold ? this.world.ku(gold) : null
      const step = ku?.range?.[2] ?? 1
      const v = ku?.value != null ? ku.value + step : 3
      return { answer: `Soweit bekannt: etwa ${v}.`, source: j.chunks[0]?.id ?? null, abstain: false, invented: true }
    }
    return { answer: 'Dazu steht nichts in den Interviews.', source: null, abstain: true }
  }
}

function wording(template: string): RegExp {
  const esc = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{v\\\}|\\\{E\d\\\}/g, '.+?')
  return new RegExp(`^${esc}$`)
}

function key2(iid: string, turn: string, i: number) {
  return `${iid}|${turn}|${i}|t`
}

function expertName(id: string) {
  return EXPERTS.find((e) => e.id === id)?.name ?? id
}
