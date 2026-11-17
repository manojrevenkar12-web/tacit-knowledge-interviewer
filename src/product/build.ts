import { readJson } from '../config.ts'
import type { Move } from '../wire.ts'
import type { AnswerSettings } from './agents/answer.ts'
import type { PlannerSettings } from './agents/planner.ts'
import type { InterviewSettings } from './interview/policy.ts'
import type { GatewaySettings } from './llm/gateway.ts'
import type { Glossary } from './pipeline/normalize.ts'
import type { SmallTalk } from './pipeline/claims.ts'

export type ProductConfig = GatewaySettings & {
  voice: { sttMicrosPerMinute: number; ttsMicrosPerKChar: number }
  interview: InterviewSettings
  fixedQuestionnaire: Move[]
  smallTalk: SmallTalk
  answer: AnswerSettings
  planner: PlannerSettings
}

export function productConfig(): ProductConfig {
  return readJson<ProductConfig>('config/product.json')
}

export function glossary(): Glossary {
  return readJson<Glossary>('knowledge/glossary.json')
}
