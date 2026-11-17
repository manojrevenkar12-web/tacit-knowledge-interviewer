import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import pg from 'pg'
import { readText } from '../../config.ts'

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  close(): Promise<void>
}

/** PostgreSQL when DATABASE_URL is set, otherwise PGlite (PostgreSQL in WASM) in memory or in a folder. */
export async function openDb(url = process.env.DATABASE_URL, dataDir = process.env.DESK_DATA): Promise<Db> {
  let db: Db
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: 5 })
    db = { query: async (sql, params) => ({ rows: (await pool.query(sql, params as unknown[])).rows }), close: () => pool.end() }
  } else {
    const lite = new PGlite({ dataDir: dataDir || undefined, extensions: { vector } })
    db = { query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await lite.query<T>(sql, params)).rows }), close: () => lite.close() }
  }
  for (const stmt of readText('db/schema.sql').split(/;\s*\n/).map((s) => s.replace(/--.*$/gm, '').trim()).filter(Boolean)) await db.query(stmt)
  return db
}
