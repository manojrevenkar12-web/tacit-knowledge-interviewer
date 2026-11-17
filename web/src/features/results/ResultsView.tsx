'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api'
import { pct } from '@/shared/format'
import type { Results } from '@/shared/types'
import { Empty, Failed, Loading } from '@/shared/ui/States'
import s from './Results.module.css'

function Table({ title, r }: { title: string; r: NonNullable<Results['dev']> }) {
  return (
    <section aria-label={title} className={s.block}>
      <h2>{title}</h2>
      <p className={s.meta}>Seeds {r.seeds.join(', ')}: the same simulated company and experts for every design.</p>
      <div className={s.scroll}>
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Design</th>
              <th scope="col">Knowledge captured</th>
              <th scope="col">Tacit knowledge</th>
              <th scope="col">Of leaving experts</th>
              <th scope="col">Per expert hour</th>
              <th scope="col">Staff questions right</th>
              <th scope="col">Wrong answers</th>
              <th scope="col">Wrong values kept as fact</th>
            </tr>
          </thead>
          <tbody>
            {r.designs.map((d) => (
              <tr key={d.name} data-ours={d.name === 'platform' || undefined}>
                <th scope="row">{d.label}</th>
                <td>{pct(d.metrics.capturedShare)}</td>
                <td>{pct(d.metrics.tacitShare)}</td>
                <td>{pct(d.metrics.atRiskShare)}</td>
                <td>{d.metrics.perExpertHour.toFixed(1)}</td>
                <td>{pct(d.metrics.right)}</td>
                <td>{pct(d.metrics.wrong, 1)}</td>
                <td>{d.metrics.wrongFacts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function ResultsView() {
  const q = useQuery({ queryKey: ['results'], queryFn: () => api<Results>('results') })
  if (q.isPending) return <Loading label="Loading results" />
  if (q.isError) return <Failed error={q.error} retry={() => q.refetch()} />
  if (!q.data.dev) return <Empty title="No results yet">Run npm run evaluate to compare the designs.</Empty>
  return (
    <div className={s.view}>
      <header>
        <h1>Results</h1>
        <p className={s.lede}>Six ways to run the same interview campaign, scored against what the experts really know.</p>
      </header>
      {q.data.gate && (
        <section className={s.gate} data-pass={q.data.gate.pass} aria-label="Release gate">
          <h2>{q.data.gate.pass ? 'The release gate passes' : 'The release gate fails'}</h2>
          <ul>
            {q.data.gate.checks.map((c) => (
              <li key={c.name} data-pass={c.pass}>
                {c.name}: <strong>{c.value}</strong> <span className={s.meta}>({c.limit})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Table title="Development seeds" r={q.data.dev} />
      {q.data.heldout ? <Table title="Held-out seeds, run once" r={q.data.heldout} /> : <p className={s.meta}>The held-out seeds have not been run.</p>}
    </div>
  )
}
