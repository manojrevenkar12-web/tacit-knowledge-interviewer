import type { Claim, Status } from './types'

export const TYPE_LABEL: Record<Claim['type'], string> = {
  procedure: 'Procedure',
  threshold: 'Setting',
  rule: 'Rule of thumb',
  exception: 'Exception',
  rationale: 'Reason',
  contact: 'Who to ask',
}

export const STATUS_LABEL: Record<Status, string> = {
  corroborated: 'Confirmed',
  'single source': 'One source',
  conflict: 'Experts disagree',
  superseded: 'Corrected later',
}

export const MOVE_LABEL: Record<string, string> = {
  open: 'Open question',
  example: 'Asked for an example',
  failure: 'Asked what goes wrong',
  numbers: 'Asked for settings',
  why: 'Asked why',
  newcomer: 'Asked what a newcomer must know',
  who: 'Asked who to call',
  confirm: 'Checked a stated value',
  wrap: 'Closing question',
}

export function pct(x: number, d = 0): string {
  return `${(x * 100).toFixed(d)}%`
}

export function minutes(m: number | null): string {
  if (m === null) return ''
  const mm = Math.floor(m)
  const ss = Math.round((m - mm) * 60)
  return `${mm}:${String(ss).padStart(2, '0')}`
}
