import type { ReactNode } from 'react'
import s from './States.module.css'

export function Loading({ label }: { label: string }) {
  return (
    <div className={s.loading} role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </div>
  )
}

export function Failed({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className={s.failed} role="alert">
      <p>{error instanceof Error ? error.message : 'The memory did not answer.'}</p>
      <p className={s.hint}>Check that the memory service runs (npm run serve), then try again.</p>
      <button type="button" onClick={retry}>
        Try again
      </button>
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={s.empty}>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  )
}
