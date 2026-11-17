/** What passes between the world and the product: what was said in an interview, and what was asked. Imports nothing. */

export type Move = 'open' | 'example' | 'failure' | 'numbers' | 'why' | 'newcomer' | 'who' | 'confirm' | 'wrap'
export const MOVES: readonly Move[] = ['open', 'example', 'failure', 'numbers', 'why', 'newcomer', 'who', 'confirm', 'wrap']

export type KuType = 'procedure' | 'threshold' | 'rule' | 'exception' | 'rationale' | 'contact'
export const KU_TYPES: readonly KuType[] = ['procedure', 'threshold', 'rule', 'exception', 'rationale', 'contact']

/** One question the interviewer puts to the expert. */
export interface Question {
  interviewId: string
  turn: number
  topic: string
  move: Move
  /** For a confirm move: the value the expert stated, and what it was about. */
  about?: { param: string; value: number; entity: string | null }
  text: string
}

/** One answer, as the speech-to-text wrote it. */
export interface Answer {
  interviewId: string
  turn: number
  text: string
  /** Minutes since the interview began, at the end of this answer. */
  minute: number
  /** The expert has nothing more to give today. */
  tired: boolean
}

/** Who can be interviewed, as HR and the org chart describe them. No knowledge in here. */
export interface ExpertProfile {
  id: string
  name: string
  role: string
  /** Topics the role covers, from the job description. */
  topics: string[]
  /** Months until the expert leaves; null for staff who stay. */
  leavesInMonths: number | null
}

export interface TopicProfile {
  id: string
  de: string
  en: string
  /** Topics the customer marked as business-critical. */
  critical: boolean
}

/** A question a new colleague asks the company memory. */
export interface StaffQuestion {
  id: string
  text: string
  askedBy: string
}
