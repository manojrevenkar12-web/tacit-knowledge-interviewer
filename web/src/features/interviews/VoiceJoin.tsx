'use client'
import { LiveKitRoom, RoomAudioRenderer, VoiceAssistantControlBar } from '@livekit/components-react'
import { useState } from 'react'
import s from './Interviews.module.css'

/** Joins the interview room by voice; the LiveKit agent asks, the expert answers out loud. */
export function VoiceJoin({ expert }: { expert: string }) {
  const [conn, setConn] = useState<{ url: string; token: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (conn)
    return (
      <LiveKitRoom serverUrl={conn.url} token={conn.token} connect audio onDisconnected={() => setConn(null)} className={s.voice}>
        <RoomAudioRenderer />
        <VoiceAssistantControlBar />
      </LiveKitRoom>
    )
  return (
    <div className={s.voiceJoin}>
      <button
        type="button"
        onClick={async () => {
          setError(null)
          const r = await fetch('/api/livekit/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expert }) })
          const body = (await r.json()) as { url?: string; token?: string; error?: string }
          if (!r.ok || !body.url || !body.token) setError(body.error ?? 'Voice did not start.')
          else setConn({ url: body.url, token: body.token })
        }}
      >
        Join by voice
      </button>
      {error && <p className={s.meta}>{error}</p>}
    </div>
  )
}
