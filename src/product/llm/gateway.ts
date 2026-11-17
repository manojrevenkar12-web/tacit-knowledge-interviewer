import OpenAI from 'openai'
import type { z } from 'zod'

export interface ModelPrice {
  inputMicrosPerMTok: number
  outputMicrosPerMTok: number
}

export interface GatewaySettings {
  baseURL: string
  models: Record<string, ModelPrice>
  routes: Record<string, string[]>
  /** How many times a model is tried again after a 429, a 5xx or a timeout before the route moves to the next. */
  retries?: number
}

export interface LedgerEntry {
  route: string
  model: string
  ok: boolean
  promptTokens: number
  completionTokens: number
  /** Cost in micro-euros, rounded up per call. */
  micros: number
  error?: string
}

export class GatewayError extends Error {}

/**
 * One door to the models: a route names an ordered list of models. A model that is overloaded (429, 5xx, timeout) is
 * tried again `retries` times; a model that still fails, or whose output does not parse or match the schema, hands
 * the request to the next. Every call lands in the ledger.
 */
export class Gateway {
  readonly ledger: LedgerEntry[] = []
  private readonly client: OpenAI

  constructor(
    private readonly settings: GatewaySettings,
    opts: { apiKey?: string; fetch?: typeof fetch } = {},
  ) {
    this.client = new OpenAI({ apiKey: opts.apiKey ?? 'not-needed', baseURL: settings.baseURL, fetch: opts.fetch, maxRetries: 0, timeout: 30_000 })
  }

  async json<T>(route: string, system: string, user: string, schema: z.ZodType<T>): Promise<{ value: T; model: string }> {
    const models = this.settings.routes[route]
    if (!models?.length) throw new GatewayError(`no route ${route}`)
    let last = ''
    const tries = 1 + (this.settings.retries ?? 0)
    for (const model of models) {
      for (let attempt = 1; attempt <= tries; attempt++) {
        const r = await this.once(route, model, system, user, schema)
        if (r.ok) return { value: r.value, model }
        last = r.error
        if (r.fatal) throw new GatewayError(last)
        if (!r.transient) break
      }
    }
    throw new GatewayError(`every model on route ${route} failed (${last})`)
  }

  private async once<T>(route: string, model: string, system: string, user: string, schema: z.ZodType<T>): Promise<{ ok: true; value: T } | { ok: false; error: string; transient: boolean; fatal: boolean }> {
    const price = this.settings.models[model]
    let res: OpenAI.Chat.Completions.ChatCompletion
    try {
      res = await this.client.chat.completions.create({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      })
    } catch (e) {
      const status = e instanceof OpenAI.APIError ? e.status : undefined
      const error = `${model}: ${status ?? ''} ${(e as Error).message}`.trim()
      this.ledger.push({ route, model, ok: false, promptTokens: 0, completionTokens: 0, micros: 0, error: String(status ?? 'error') })
      const transient = status === undefined || status === 429 || status >= 500
      return { ok: false, error, transient, fatal: !transient }
    }
    const usage = res.usage ?? { prompt_tokens: 0, completion_tokens: 0 }
    const entry: LedgerEntry = {
      route,
      model,
      ok: true,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      micros: Math.ceil((usage.prompt_tokens * price.inputMicrosPerMTok + usage.completion_tokens * price.outputMicrosPerMTok) / 1e6),
    }
    let raw: unknown
    try {
      raw = JSON.parse(res.choices[0]?.message?.content ?? 'null')
    } catch {
      raw = undefined
    }
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      this.ledger.push({ ...entry, ok: false, error: 'schema' })
      return { ok: false, error: `${model}: output does not match the schema`, transient: false, fatal: false }
    }
    this.ledger.push(entry)
    return { ok: true, value: parsed.data }
  }

  micros(): number {
    return this.ledger.reduce((s, e) => s + e.micros, 0)
  }
}
