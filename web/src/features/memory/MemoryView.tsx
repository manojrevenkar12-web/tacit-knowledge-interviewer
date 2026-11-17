'use client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/shared/api'
import { STATUS_LABEL, TYPE_LABEL, minutes } from '@/shared/format'
import type { Claim, Expert, MemoryAnswer, Topic } from '@/shared/types'
import { Empty, Failed, Loading } from '@/shared/ui/States'
import s from './Memory.module.css'

function Provenance({ c, name }: { c: Claim; name: (id: string) => string }) {
  return (
    <span className={s.prov}>
      {name(c.expert)}, {c.interviewId}, min {minutes(c.minute)}
      {c.alsoSaidBy.length ? `; also ${c.alsoSaidBy.map(name).join(', ')}` : ''}
    </span>
  )
}

export function MemoryView() {
  const org = useQuery({ queryKey: ['org'], queryFn: () => api<{ experts: Expert[]; topics: Topic[] }>('org') })
  const [topic, setTopic] = useState('drying')
  const graph = useQuery({ queryKey: ['graph', topic], queryFn: () => api<Claim[]>(`graph?topic=${topic}`) })
  const [question, setQuestion] = useState('')
  const ask = useMutation({ mutationFn: (q: string) => api<MemoryAnswer>('ask', { method: 'POST', body: JSON.stringify({ question: q }) }) })
  const name = (id: string) => org.data?.experts.find((e) => e.id === id)?.name ?? id
  const live = graph.data?.filter((c) => c.status !== 'superseded') ?? []
  const types = [...new Set(live.map((c) => c.type))]
  return (
    <section className={s.view} aria-labelledby="mem-title">
      <header>
        <h1 id="mem-title">Company memory</h1>
        <p className={s.lede}>What the experts said, as knowledge: who said it and when, who else confirmed it, and where they disagree.</p>
      </header>
      <form
        className={s.ask}
        onSubmit={(e) => {
          e.preventDefault()
          if (question.trim().length >= 5) ask.mutate(question)
        }}
      >
        <label htmlFor="q">Ask the memory</label>
        <div className={s.askRow}>
          <input id="q" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Wie lange trocknen wir PA6-GF30 aus einem offenen Sack?" />
          <button type="submit" disabled={ask.isPending}>
            Ask
          </button>
        </div>
      </form>
      {ask.isError && <p className={s.error}>{(ask.error as Error).message}</p>}
      {ask.data && (
        <div className={s.answer} data-abstain={ask.data.abstain}>
          <p className={s.answerText}>{ask.data.text}</p>
          {ask.data.warnings.map((w) => (
            <p key={w} className={s.warning} data-kind={w.startsWith('Widerspruch') ? 'conflict' : 'single'}>
              {w}
            </p>
          ))}
          {ask.data.cites.map((c) => (
            <blockquote key={c.id} className={s.cite}>
              {c.quote}
              <Provenance c={c} name={name} />
            </blockquote>
          ))}
        </div>
      )}
      <div className={s.tabs} role="tablist" aria-label="Topics">
        {org.data?.topics.map((t) => (
          <button key={t.id} role="tab" aria-selected={topic === t.id} onClick={() => setTopic(t.id)} type="button">
            {t.de}
          </button>
        ))}
      </div>
      {graph.isPending && <Loading label="Loading knowledge" />}
      {graph.isError && <Failed error={graph.error} retry={() => graph.refetch()} />}
      {graph.data && live.length === 0 && <Empty title="Nothing captured on this topic yet">The plan schedules an interview where the most knowledge is at risk.</Empty>}
      {types.map((t) => (
        <section key={t} className={s.group} aria-label={TYPE_LABEL[t]}>
          <h2>{TYPE_LABEL[t]}</h2>
          <ul>
            {live
              .filter((c) => c.type === t)
              .map((c) => (
                <li key={c.id} className={s.claim}>
                  <span className={s.status} data-status={c.status}>
                    {STATUS_LABEL[c.status]}
                  </span>
                  <p className={s.quote}>{c.quote}</p>
                  <Provenance c={c} name={name} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </section>
  )
}
