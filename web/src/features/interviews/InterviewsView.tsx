'use client'
import { useMutation, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/shared/api'
import type { Expert, InterviewRow, Plan, Topic } from '@/shared/types'
import { Empty, Failed, Loading } from '@/shared/ui/States'
import s from './Interviews.module.css'

export function InterviewsView() {
  const router = useRouter()
  const org = useQuery({ queryKey: ['org'], queryFn: () => api<{ experts: Expert[]; topics: Topic[] }>('org') })
  const list = useQuery({ queryKey: ['interviews'], queryFn: () => api<InterviewRow[]>('interviews') })
  const plan = useQuery({ queryKey: ['plan'], queryFn: () => api<Plan>('plan') })
  const [expert, setExpert] = useState<string>('')
  const start = useMutation({
    mutationFn: (body: { expert: string; focus: string[] }) => api<{ interviewId: string }>('interviews', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (r) => router.push(`/interviews/${r.interviewId}`),
  })
  const name = (id: string) => org.data?.experts.find((e) => e.id === id)?.name ?? id
  const topic = (id: string) => org.data?.topics.find((t) => t.id === id)?.de ?? id
  const chosen = expert || plan.data?.next.expert || ''
  return (
    <section className={s.view} aria-labelledby="iv-title">
      <header className={s.head}>
        <h1 id="iv-title">Interviews</h1>
        <p>Each interview follows what the expert has not said yet: the exceptions, the numbers, the people to call.</p>
      </header>
      <div className={s.next}>
        {plan.isPending && <Loading label="Planning the next interview" />}
        {plan.isError && <Failed error={plan.error} retry={() => plan.refetch()} />}
        {plan.data && (
          <>
            <div>
              <h2>Next interview</h2>
              <p className={s.suggest}>
                <strong>{name(plan.data.next.expert)}</strong> on {plan.data.next.focus.map(topic).join(' and ')}
              </p>
              <p className={s.meta}>Most knowledge at risk: who leaves soonest, on the topics you marked critical, minus what is already captured.</p>
            </div>
            <form
              className={s.start}
              onSubmit={(e) => {
                e.preventDefault()
                start.mutate({ expert: chosen, focus: chosen === plan.data.next.expert ? plan.data.next.focus : [] })
              }}
            >
              <label>
                Expert
                <select value={chosen} onChange={(e) => setExpert(e.target.value)}>
                  {org.data?.experts.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}, {e.role}
                      {e.leavesInMonths !== null ? ` (leaves in ${e.leavesInMonths} months)` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={start.isPending}>
                Start interview
              </button>
              {start.isError && <p className={s.error}>{(start.error as Error).message}</p>}
            </form>
          </>
        )}
      </div>
      {list.isPending && <Loading label="Loading interviews" />}
      {list.isError && <Failed error={list.error} retry={() => list.refetch()} />}
      {list.data && list.data.length === 0 && <Empty title="No interviews yet">Start with the expert the plan suggests; the first session takes about fifteen minutes.</Empty>}
      {list.data && list.data.length > 0 && (
        <ol className={s.list}>
          {list.data.map((iv) => (
            <li key={iv.interview_id}>
              <Link href={`/interviews/${encodeURIComponent(iv.interview_id)}`} className={s.row}>
                <span className={s.who}>{name(iv.expert)}</span>
                <span className={s.meta}>{iv.focus.length ? iv.focus.map(topic).join(', ') : 'all topics of the role'}</span>
                <span className={s.num}>{iv.done ? `${Math.round(iv.minutes)} min` : 'running'}</span>
                <span className={s.num}>{iv.claims} pieces of knowledge</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
