import { capturedRight, type DesignRun } from './run.ts'

export interface Metrics {
  runs: number
  knowledge: number
  captured: number
  capturedShare: number
  tacitShare: number
  atRiskShare: number
  perExpertHour: number
  /** Pieces of knowledge the memory holds only with a wrong value and no conflict flag: what it would pass on as fact. */
  wrongFacts: number
  /** Claims that are small talk, not knowledge. */
  noiseClaims: number
  claims: number
  expertHours: number
  questions: number
  right: number
  flagged: number
  wrong: number
  honestGap: number
  missed: number
  costPerSessionCents: number
  sessions: number
}

const r4 = (x: number) => Math.round(x * 10_000) / 10_000
const r2 = (x: number) => Math.round(x * 100) / 100

export function metrics(runs: DesignRun[]): Metrics {
  let knowledge = 0
  let captured = 0
  let tacit = 0
  let tacitCaught = 0
  let atRisk = 0
  let atRiskCaught = 0
  let wrongFacts = 0
  let noise = 0
  let claims = 0
  let minutes = 0
  let micros = 0
  let sessions = 0
  const answers = runs.flatMap((r) => r.answers)
  for (const r of runs) {
    const cap = capturedRight(r.world, r.graph)
    const leaving = new Set(r.world.experts.filter((e) => e.leavesInMonths !== null).map((e) => e.id))
    knowledge += r.world.kus.length
    captured += cap.size
    for (const k of r.world.kus) {
      if (k.tacitHere >= 0.6) {
        tacit++
        if (cap.has(k.id)) tacitCaught++
      }
      if (k.critical && k.holders.every((h) => leaving.has(h))) {
        atRisk++
        if (cap.has(k.id)) atRiskCaught++
      }
    }
    const wrongKus = new Set<string>()
    for (const c of r.graph.live()) {
      claims++
      const s = r.world.spanOf(c.interviewId, c.turn, c.quote)
      if (!s?.kuId) noise++
      else if (s.wrongValue && c.status !== 'conflict' && !cap.has(s.kuId)) wrongKus.add(s.kuId)
    }
    wrongFacts += wrongKus.size
    minutes += r.expertMinutes
    micros += r.modelMicros + r.voiceMicros
    sessions += r.sessions.length
  }
  const share = (o: string) => r4(answers.filter((a) => a.outcome === o).length / answers.length)
  return {
    runs: runs.length,
    knowledge,
    captured,
    capturedShare: r4(captured / knowledge),
    tacitShare: r4(tacitCaught / tacit),
    atRiskShare: r4(atRiskCaught / atRisk),
    perExpertHour: r2(captured / (minutes / 60)),
    wrongFacts,
    noiseClaims: noise,
    claims,
    expertHours: r2(minutes / 60 / runs.length),
    questions: answers.length,
    right: share('right'),
    flagged: share('flagged'),
    wrong: share('wrong'),
    honestGap: share('honest_gap'),
    missed: share('missed'),
    costPerSessionCents: r2(micros / 10_000 / sessions),
    sessions,
  }
}
