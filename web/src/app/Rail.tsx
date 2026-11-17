'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import s from './layout.module.css'

const NAV = [
  { href: '/', label: 'Interviews' },
  { href: '/memory', label: 'Company memory' },
  { href: '/risk', label: 'Knowledge at risk' },
  { href: '/results', label: 'Results' },
]

export function Rail() {
  const path = usePathname()
  return (
    <nav className={s.rail} aria-label="Views">
      <div className={s.brand}>
        <span className={s.mark} aria-hidden="true" />
        Tacit
      </div>
      <ul>
        {NAV.map((n) => {
          const on = n.href === '/' ? path === '/' || path.startsWith('/interviews') : path.startsWith(n.href)
          return (
            <li key={n.href}>
              <Link href={n.href} aria-current={on ? 'page' : undefined} className={on ? s.on : undefined}>
                {n.label}
              </Link>
            </li>
          )
        })}
      </ul>
      <p className={s.note}>Experts talk. The interviewer asks for what is still missing; every answer becomes knowledge with a name and a minute on it.</p>
    </nav>
  )
}
