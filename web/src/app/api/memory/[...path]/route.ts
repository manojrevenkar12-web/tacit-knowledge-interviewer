/** Proxies the console to the memory service and adds the API key on the server, so it never reaches the browser. */
const BASE = process.env.MEMORY_URL ?? 'http://localhost:8795'
const KEY = process.env.MEMORY_KEY ?? 'km-demo-key'

async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const url = new URL(req.url)
  const target = `${BASE}/api/${path.map(encodeURIComponent).join('/')}${url.search}`
  try {
    const res = await fetch(target, { method: req.method, headers: { 'x-api-key': KEY, ...(req.method === 'POST' ? { 'content-type': 'application/json' } : {}) }, body: req.method === 'POST' ? await req.text() : undefined, cache: 'no-store' })
    return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } })
  } catch {
    return Response.json({ error: 'The memory service is not reachable.' }, { status: 502 })
  }
}

export const GET = forward
export const POST = forward
