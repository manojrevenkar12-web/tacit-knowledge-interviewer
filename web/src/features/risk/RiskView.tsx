'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api'
import type { Expert, Plan, Topic } from '@/shared/types'
import { Failed, Loading } from '@/shared/ui/States'
import s from './Risk.module.css'

/** Where knowledge would walk out of the door: each expert's topics, shaded by what is still uncaptured and how soon they leave. */
export function RiskView() {
  const org = useQuery({ queryKey: ['org'], queryFn: () => api<{ experts: Expert[]; topics: Topic[] }>('org') })
  const plan = useQuery({ queryKey: ['plan'], queryFn: () => api<Plan>('plan') })
  if (plan.isPending || org.isPending) return <Loading label="Weighing the knowledge at risk" />
  if (plan.isError) return <Failed error={plan.error} retry={() => plan.refetch()} />
  if (org.isError) return <Failed error={org.error} retry={() => org.refetch()} />
  const max = Math.max(...plan.data.atRisk.map((r) => r.risk), 1)
  const experts = [...org.data.experts].sort((a, b) => (a.leavesInMonths ?? 99) - (b.leavesInMonths ?? 99))
  return (
    <section className={s.view} aria-labelledby="risk-title">
      <header>
        <h1 id="risk-title">Knowledge at risk</h1>
        <p className={s.lede}>Darker means more still in one person's head, on a critical topic, with less time left. The next interview goes to the darkest row among experts who still have interview sessions left.</p>
      </header>
      <div className={s.scroll}>
        <table className={s.grid}>
          <thead>
            <tr>
              <th scope="col">Expert</th>
              <th scope="col">Leaves in</th>
              {org.data.topics.map((t) => (
                <th key={t.id} scope="col" className={s.topic}>
                  <span>{t.de}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {experts.map((e) => (
              <tr key={e.id} data-next={plan.data.next.expert === e.id || undefined}>
                <th scope="row">
                  {e.name}
                  <span className={s.role}>{e.role}</span>
                </th>
                <td className={s.months}>{e.leavesInMonths === null ? 'stays' : `${e.leavesInMonths} months`}</td>
                {org.data.topics.map((t) => {
                  const r = plan.data.atRisk.find((x) => x.expert === e.id && x.topic === t.id)
                  if (!r) return <td key={t.id} className={s.none} />
                  const shade = r.risk / max
                  return (
                    <td key={t.id} className={s.cell} style={{ ['--shade' as string]: shade.toFixed(2) }} title={`${r.remaining.toFixed(1)} pieces probably still uncaptured`}>
                      <span className={s.sr}>{r.risk.toFixed(1)}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={s.next}>
        Next: {org.data.experts.find((e) => e.id === plan.data.next.expert)?.name} on {plan.data.next.focus.map((t) => org.data.topics.find((x) => x.id === t)?.de ?? t).join(' and ')}.
      </p>
    </section>
  )
}
