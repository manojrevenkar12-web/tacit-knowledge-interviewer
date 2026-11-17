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
 * One door to the models: a route names an ordered list of models; a model that fails (5xx, timeout, output that
 * does not parse or does not match the schema) hands the request to the next. Every call lands in the ledger.
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
    for (const model of models) {
      const price = this.settings.models[model]
      try {
        const res = await this.client.chat.completions.create({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        })
        const usage = res.usage ?? { prompt_tokens: 0, completion_tokens: 0 }
        const entry: LedgerEntry = {
          route,
          model,
          ok: true,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          micros: Math.ceil((usage.prompt_tokens * price.inputMicrosPerMTok + usage.completion_tokens * price.outputMicrosPerMTok) / 1e6),
        }
        const parsed = schema.safeParse(JSON.parse(res.choices[0]?.message?.content ?? 'null'))
        if (!parsed.success) {
          this.ledger.push({ ...entry, ok: false, error: 'schema' })
          last = `${model}: output does not match the schema`
          continue
        }
        this.ledger.push(entry)
        return { value: parsed.data, model }
      } catch (e) {
        const status = e instanceof OpenAI.APIError ? e.status : undefined
        last = `${model}: ${status ?? ''} ${(e as Error).message}`.trim()
        this.ledger.push({ route, model, ok: false, promptTokens: 0, completionTokens: 0, micros: 0, error: String(status ?? 'error') })
        if (status !== undefined && status < 500 && status !== 429) throw new GatewayError(last)
      }
    }
    throw new GatewayError(`every model on route ${route} failed (${last})`)
  }

  micros(): number {
    return this.ledger.reduce((s, e) => s + e.micros, 0)
  }
}
