'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/shared/api'
import { MOVE_LABEL, minutes } from '@/shared/format'
import type { Expert, InterviewDetail, Topic } from '@/shared/types'
import { Failed, Loading } from '@/shared/ui/States'
import { Highlighted } from './Highlighted'
import s from './Interviews.module.css'
import { VoiceJoin } from './VoiceJoin'

export function InterviewRoom({ id }: { id: string }) {
  const client = useQueryClient()
  const org = useQuery({ queryKey: ['org'], queryFn: () => api<{ experts: Expert[]; topics: Topic[] }>('org') })
  const q = useQuery({ queryKey: ['interview', id], queryFn: () => api<InterviewDetail>(`interviews/${encodeURIComponent(id)}`) })
  const [text, setText] = useState('')
  const open = q.data?.turns.find((t) => t.answer === null)
  const send = useMutation({
    mutationFn: () => api(`interviews/${encodeURIComponent(id)}/answer`, { method: 'POST', body: JSON.stringify({ turn: open!.turn, text, minute: (open!.turn * 1.2) }) }),
    onSuccess: () => {
      setText('')
      void client.invalidateQueries({ queryKey: ['interview', id] })
    },
  })
  if (q.isPending) return <Loading label="Loading the interview" />
  if (q.isError) return <Failed error={q.error} retry={() => q.refetch()} />
  const iv = q.data
  const expert = org.data?.experts.find((e) => e.id === iv.expert)
  const topic = (t: string) => org.data?.topics.find((x) => x.id === t)?.de ?? t
  return (
    <article className={s.room} aria-label={`Interview with ${expert?.name ?? iv.expert}`}>
      <header className={s.roomHead}>
        <div>
          <h1>{expert?.name ?? iv.expert}</h1>
          <p className={s.meta}>
            {expert?.role}
            {expert?.leavesInMonths != null ? `, leaves in ${expert.leavesInMonths} months` : ''}. {iv.done ? `${Math.round(iv.minutes)} minutes, ` : ''}
            {iv.claims.length} pieces of knowledge kept.
          </p>
        </div>
        {!iv.done && <VoiceJoin expert={iv.expert} />}
      </header>
      <ol className={s.turns}>
        {iv.turns.map((t) => (
          <li key={t.turn} className={s.turn}>
            <div className={s.ask}>
              <span className={s.move}>
                {MOVE_LABEL[t.move] ?? t.move} · {topic(t.topic)}
              </span>
              <p className={s.question}>{t.question}</p>
              <p className={s.why}>{t.why}</p>
            </div>
            <div className={s.answer}>
              {t.answer === null ? (
                <p className={s.meta}>Waiting for the answer.</p>
              ) : (
                <>
                  <span className={s.clock}>{minutes(t.minute)}</span>
                  <Highlighted text={t.answer} claims={iv.claims.filter((c) => c.turn === t.turn)} />
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
      {open && (
        <form
          className={s.reply}
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) send.mutate()
          }}
        >
          <label htmlFor="answer">Answer by text (or join by voice)</label>
          <textarea id="answer" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Was der Experte sagt…" />
          <button type="submit" disabled={send.isPending || !text.trim()}>
            Send answer
          </button>
          {send.isError && <p className={s.error}>{(send.error as Error).message}</p>}
        </form>
      )}
    </article>
  )
}
