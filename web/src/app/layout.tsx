import '@fontsource-variable/schibsted-grotesk'
import '@fontsource-variable/source-serif-4'
import '@/shared/theme.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import s from './layout.module.css'
import { Providers } from './Providers'
import { Rail } from './Rail'

export const metadata: Metadata = { title: 'Tacit: expert interviews and company memory', description: 'Capture what experts know before they retire.' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className={s.shell}>
            <Rail />
            <main className={s.main}>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
