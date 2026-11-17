import Fastify from 'fastify'
import { worldConfig } from './load.ts'
import { SimulatedModels } from './models.ts'
import { World } from './world.ts'

/**
 * The simulated company as a process: an OpenAI-compatible model endpoint, and with --interview a set of experts who
 * take part in interviews through the memory service's API, the way the voice worker would.
 */
const world = new World(worldConfig(process.env.WORLD_SEED ?? 'live'))
const models = new SimulatedModels(world, world.cfg.models)
const app = Fastify({ logger: false, bodyLimit: 4 * 1024 * 1024 })
app.post('/v1/chat/completions', async (req, reply) => {
  const res = await models.fetch('http://world/v1/chat/completions', { method: 'POST', body: JSON.stringify(req.body) })
  return reply.code(res.status).type('application/json').send(await res.text())
})
app.get('/healthz', async () => ({ ok: true }))
const port = Number(process.env.WORLD_PORT ?? 8796)
await app.listen({ port, host: '0.0.0.0' })
console.log(`world on :${port}`)

const at = process.argv.indexOf('--interview')
if (at > 0) {
  const memory = process.argv[at + 1]
  const sessions = Number(process.env.SESSIONS ?? 3)
  const H = { 'content-type': 'application/json', 'x-api-key': process.env.MEMORY_KEY ?? 'km-demo-key' }
  for (let i = 0; i < sessions; i++) {
    const plan = (await (await fetch(`${memory}/api/plan`, { headers: H })).json()) as { next: { expert: string; focus: string[] } }
    const started = await fetch(`${memory}/api/interviews`, { method: 'POST', headers: H, body: JSON.stringify(plan.next) })
    if (!started.ok) throw new Error(`memory answered ${started.status}: ${await started.text()}`)
    let { interviewId, question } = (await started.json()) as { interviewId: string; question: { turn: number; topic: string; move: string; text: string; about?: { param: string; value: number; entity: string | null } } | null }
    // The memory names its interviews; the world's expert takes part under that name.
    world.startInterviewAs(interviewId, plan.next.expert)
    let turns = 0
    while (question) {
      const a = world.respond({ interviewId, ...question } as never)
      if (process.env.WORLD_LOG) console.log(`  ${question.move} ${question.topic}: ${question.text}\n    -> ${a.text}`)
      const r = await fetch(`${memory}/api/interviews/${interviewId}/answer`, { method: 'POST', headers: H, body: JSON.stringify({ turn: question.turn, text: a.text, minute: a.minute }) })
      if (!r.ok) throw new Error(`memory answered ${r.status}: ${await r.text()}`)
      question = ((await r.json()) as { question: typeof question }).question
      turns++
    }
    console.log(`${interviewId}: ${turns} turns with ${plan.next.expert} on ${plan.next.focus.join(', ')}`)
  }
  await app.close()
}
