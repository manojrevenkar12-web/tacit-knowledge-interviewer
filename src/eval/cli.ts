import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readJson, ROOT } from '../config.ts'
import { answerFromGraph } from '../product/agents/answer.ts'
import { glossary, productConfig } from '../product/build.ts'
import { Gateway } from '../product/llm/gateway.ts'
import { EXPERTS, TOPICS } from '../world/company.ts'
import { SimulatedModels } from '../world/models.ts'
import { writeReadme } from './readme.ts'
import { capturedRight, designs, runDesign, type DesignRun } from './run.ts'
import { metrics, type Metrics } from './score.ts'

function write(path: string, data: unknown): void {
  mkdirSync(join(ROOT, path, '..'), { recursive: true })
  writeFileSync(join(ROOT, path), JSON.stringify(data, null, 2) + '\n')
}

export interface Report {
  seeds: string[]
  designs: { name: string; label: string; metrics: Metrics; perSeed: (Metrics & { seed: string })[] }[]
  platform: {
    leaving: { expert: string; name: string; leavesInMonths: number; atRisk: number; captured: number }[]
    byType: Record<string, { knowledge: number; captured: number }>
    excerpt: { question: string; move: string; why: string; answer: string; claims: { type: string; quote: string; entities: string[]; value: number | null; unit: string | null }[] }[]
  }
}

async function evaluate(seeds: string[]): Promise<Report> {
  const runs = new Map<string, DesignRun[]>()
  for (const seed of seeds) for (const d of designs()) runs.set(d.name, [...(runs.get(d.name) ?? []), await runDesign(seed, d)])
  const p = runs.get('platform')!
  const leaving = p[0].world.experts.filter((e) => e.leavesInMonths !== null)
  const byType: Record<string, { knowledge: number; captured: number }> = {}
  for (const r of p) {
    const cap = capturedRight(r.world, r.graph)
    for (const k of r.world.kus) {
      const t = (byType[k.type] ??= { knowledge: 0, captured: 0 })
      t.knowledge++
      if (cap.has(k.id)) t.captured++
    }
  }
  const first = p[0]
  const iv = first.sessions[0].interviewId
  const turns = first.chunks.filter((c) => c.interviewId === iv).slice(0, 6)
  const excerpt = turns.map((c) => {
    const claims = [...first.graph.claims.values()].filter((x) => x.interviewId === iv && x.turn === c.turn)
    const answer = first.world.texts.get(`${iv}|${c.turn}`) ?? ''
    const t = first.transcript.find((x) => x.interviewId === iv && x.turn === c.turn)
    return { question: t?.question ?? '', move: t?.move ?? '', why: t?.why ?? '', answer, claims: claims.map((x) => ({ type: x.type, quote: x.quote, entities: x.entities, value: x.value, unit: x.unit })) }
  })
  return {
    seeds,
    designs: designs().map((d) => ({ name: d.name, label: d.label, metrics: metrics(runs.get(d.name)!), perSeed: runs.get(d.name)!.map((r) => ({ seed: r.seed, ...metrics([r]) })) })),
    platform: {
      leaving: leaving.map((e) => {
        let atRisk = 0
        let captured = 0
        for (const r of p) {
          const cap = capturedRight(r.world, r.graph)
          for (const k of r.world.kus.filter((k) => k.critical && k.holders.length === 1 && k.holders[0] === e.id)) {
            atRisk++
            if (cap.has(k.id)) captured++
          }
        }
        return { expert: e.id, name: e.name, leavesInMonths: e.leavesInMonths!, atRisk, captured }
      }),
      byType,
      excerpt,
    },
  }
}

function fingerprint(): string {
  const h = createHash('sha256')
  const files = (dir: string) => readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' }).filter((f) => /\.(ts|md|json)$/.test(f)).sort().map((f) => join(dir, f))
  for (const f of [...files('src/product'), ...files('prompts'), ...files('knowledge'), 'config/product.json', 'src/wire.ts']) h.update(f).update(readFileSync(join(ROOT, f)))
  return h.digest('hex')
}

async function gate() {
  const g = readJson<{ design: string; minCaptured: number; minAtRisk: number; maxWrongAnswers: number; maxWrongFacts: number; minRight: number; maxCostPerSessionCents: number; beats: Record<string, (keyof Metrics)[]> }>('config/gate.json')
  const dev = readJson<Report>('reports/dev.json')
  const m = dev.designs.find((d) => d.name === g.design)!.metrics
  const checks = [
    { name: 'knowledge captured', value: m.capturedShare, limit: `≥ ${g.minCaptured}`, pass: m.capturedShare >= g.minCaptured },
    { name: 'knowledge at risk captured', value: m.atRiskShare, limit: `≥ ${g.minAtRisk}`, pass: m.atRiskShare >= g.minAtRisk },
    { name: 'staff questions answered right', value: m.right, limit: `≥ ${g.minRight}`, pass: m.right >= g.minRight },
    { name: 'wrong answers', value: m.wrong, limit: `≤ ${g.maxWrongAnswers}`, pass: m.wrong <= g.maxWrongAnswers },
    { name: 'wrong values stated as fact', value: m.wrongFacts, limit: `≤ ${g.maxWrongFacts}`, pass: m.wrongFacts <= g.maxWrongFacts },
    { name: 'cost per session (ct)', value: m.costPerSessionCents, limit: `≤ ${g.maxCostPerSessionCents}`, pass: m.costPerSessionCents <= g.maxCostPerSessionCents },
  ]
  for (const [other, keys] of Object.entries(g.beats)) {
    const o = dev.designs.find((d) => d.name === other)!.metrics
    for (const k of keys) checks.push({ name: `${k} beats ${other}`, value: m[k] as number, limit: `> ${o[k]}`, pass: (m[k] as number) > (o[k] as number) })
  }
  const pass = checks.every((c) => c.pass)
  write('reports/gate.json', { design: g.design, pass, checks })
  for (const c of checks) console.log(`${c.pass ? 'pass' : 'FAIL'}  ${c.name}: ${c.value} (${c.limit})`)
  if (!pass) process.exit(1)
}

/** A demo campaign for the console: what the platform heard and wrote down, never the world's truth. */
async function seed() {
  const d = designs().find((x) => x.name === 'platform')!
  const r = await runDesign('demo-d', d)
  const pcfg = productConfig()
  const gw = new Gateway(pcfg, { fetch: new SimulatedModels(r.world, r.world.cfg.models).fetch as typeof fetch })
  const questions = []
  for (const q of r.world.staffQuestions().slice(0, 12)) {
    const a = await answerFromGraph(gw, glossary(), r.graph, pcfg.answer, q)
    questions.push({ question: q.text, abstained: a.abstain, answer: a.text, cites: a.cites.map((c) => c.id), warnings: a.warnings })
  }
  const interviews = r.sessions.map((s) => ({
    interviewId: s.interviewId,
    expert: s.expert,
    focus: s.focus,
    minutes: s.minutes,
    why: s.why,
    turns: r.chunks
      .filter((c) => c.interviewId === s.interviewId)
      .map((c) => {
        const answer = r.world.texts.get(`${c.interviewId}|${c.turn}`) ?? ''
        const t = r.transcript.find((x) => x.interviewId === c.interviewId && x.turn === c.turn)
        return { turn: c.turn, topic: t?.topic ?? '', move: t?.move ?? '', why: t?.why ?? '', question: t?.question ?? '', answer, minute: t?.minute ?? 0 }
      }),
  }))
  write('demo/seed.json', { note: 'A recorded interview campaign: questions, answers as speech-to-text wrote them, and the claims the platform kept. No truth from the simulation.', interviews, claims: [...r.graph.claims.values()].map(({ status, alsoSaidBy, conflictsWith, supersededBy, ...c }) => (void status, void alsoSaidBy, void conflictsWith, void supersededBy, c)), questions })
}

const cmd = process.argv[2]
if (cmd === 'dev') write('reports/dev.json', await evaluate(readJson<{ seeds: string[] }>('config/dev.json').seeds))
else if (cmd === 'gate') await gate()
else if (cmd === 'seed') await seed()
else if (cmd === 'org') write('knowledge/org.json', { note: 'The org chart and topic list the customer gives at onboarding. No knowledge in here.', experts: EXPERTS, topics: TOPICS })
else if (cmd === 'readme') writeReadme()
else if (cmd === 'lock') {
  if (existsSync(join(ROOT, 'config/heldout.lock'))) throw new Error('the held-out lock exists')
  write('config/heldout.lock', { seeds: readJson<{ seeds: string[] }>('config/heldout.json').seeds, product: fingerprint(), note: 'Written once before the held-out run; the run refuses any other product.' })
} else if (cmd === 'heldout') {
  const lock = readJson<{ seeds: string[]; product: string }>('config/heldout.lock')
  if (existsSync(join(ROOT, 'reports/heldout.json'))) throw new Error('the held-out seeds have been run; they are not run again')
  if (lock.product !== fingerprint()) throw new Error('the product changed since the lock')
  write('reports/heldout.json', await evaluate(lock.seeds))
} else {
  console.error('usage: cli.ts dev|gate|seed|readme|lock|heldout')
  process.exit(2)
}
