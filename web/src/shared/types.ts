export type Status = 'corroborated' | 'single source' | 'conflict' | 'superseded'

export interface Expert {
  id: string
  name: string
  role: string
  topics: string[]
  leavesInMonths: number | null
}

export interface Topic {
  id: string
  de: string
  en: string
  critical: boolean
}

export interface Claim {
  id: string
  expert: string
  interviewId: string
  turn: number
  minute: number
  topic: string
  type: 'procedure' | 'threshold' | 'rule' | 'exception' | 'rationale' | 'contact'
  statement: string
  quote: string
  entities: string[]
  value: number | null
  unit: string | null
  condition: string | null
  confirmed: boolean
  status: Status
  alsoSaidBy: string[]
  conflictsWith: string[]
  supersededBy: string | null
}

export interface InterviewRow {
  interview_id: string
  expert: string
  focus: string[]
  minutes: number
  done: boolean
  claims: number
  turns: number
}

export interface TurnRow {
  turn: number
  topic: string
  move: string
  why: string
  question: string
  answer: string | null
  minute: number | null
}

export interface InterviewDetail extends Omit<InterviewRow, 'claims' | 'turns'> {
  turns: TurnRow[]
  claims: Claim[]
}

export interface Plan {
  next: { expert: string; focus: string[]; why: string }
  atRisk: { expert: string; topic: string; risk: number; remaining: number }[]
}

export interface MemoryAnswer {
  abstain: boolean
  text: string
  cites: Claim[]
  warnings: string[]
  reason: string
}

export interface Metrics {
  capturedShare: number
  tacitShare: number
  atRiskShare: number
  perExpertHour: number
  wrongFacts: number
  expertHours: number
  right: number
  wrong: number
  honestGap: number
  costPerSessionCents: number
}

export interface Results {
  dev: { seeds: string[]; designs: { name: string; label: string; metrics: Metrics }[] } | null
  heldout: { seeds: string[]; designs: { name: string; label: string; metrics: Metrics }[] } | null
  gate: { pass: boolean; checks: { name: string; value: number; limit: string; pass: boolean }[] } | null
}
