import { readJson } from '../../config.ts'
import { buildApp, seedDemo } from './app.ts'
import { openDb } from './db.ts'

const cfg = readJson<{ port: number; seedFile: string }>('config/service.json')
const db = await openDb()
const seeded = await seedDemo(db, cfg.seedFile)
const app = await buildApp(db)
const port = Number(process.env.PORT ?? cfg.port)
await app.listen({ port, host: '0.0.0.0' })
console.log(`memory on :${port}${seeded ? `, ${seeded} demo interviews loaded` : ''}`)
