/** The memory service, through the console's own server so the API key stays there. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/memory/${path}`, { ...init, headers: init.body ? { 'content-type': 'application/json' } : undefined })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `The memory answered ${res.status}.`)
  }
  return (await res.json()) as T
}
