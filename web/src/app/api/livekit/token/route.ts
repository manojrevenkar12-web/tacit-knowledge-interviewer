import { AccessToken, RoomAgentDispatch, RoomConfiguration } from 'livekit-server-sdk'

/** A join token for a voice interview room, with the interview agent dispatched into it for the chosen expert. */
export async function POST(req: Request) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return Response.json({ error: 'Voice is not configured on this server. Interview by text, or set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.' }, { status: 503 })
  const { expert } = (await req.json().catch(() => ({}))) as { expert?: string }
  if (!expert) return Response.json({ error: 'Choose an expert.' }, { status: 400 })
  const room = `interview-${expert}-${Date.now()}`
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: `interviewer-${Date.now()}`, ttl: '2h' })
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true })
  at.roomConfig = new RoomConfiguration({ agents: [new RoomAgentDispatch({ agentName: 'expert-interviewer', metadata: JSON.stringify({ expert }) })] })
  return Response.json({ url: LIVEKIT_URL, room, token: await at.toJwt() })
}
