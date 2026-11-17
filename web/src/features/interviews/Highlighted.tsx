'use client'
import { motion, useReducedMotion } from 'motion/react'
import { TYPE_LABEL } from '@/shared/format'
import { motionTokens } from '@/shared/tokens'
import type { Claim } from '@/shared/types'
import s from './Interviews.module.css'

/**
 * The expert's words, with every sentence that became knowledge marked like a highlighter on paper and a note in
 * the margin saying what it became. Everything else stays plain: small talk is not knowledge.
 */
export function Highlighted({ text, claims }: { text: string; claims: Claim[] }) {
  const still = useReducedMotion()
  const marks = claims
    .map((c) => ({ c, at: text.indexOf(c.quote) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at)
  const parts: { text: string; claim?: Claim }[] = []
  let pos = 0
  for (const m of marks) {
    if (m.at < pos) continue
    if (m.at > pos) parts.push({ text: text.slice(pos, m.at) })
    parts.push({ text: m.c.quote, claim: m.c })
    pos = m.at + m.c.quote.length
  }
  if (pos < text.length) parts.push({ text: text.slice(pos) })
  return (
    <p className={s.voice}>
      {parts.map((p, i) =>
        p.claim ? (
          <span key={i} className={s.kept}>
            <motion.mark
              className={s.marker}
              data-status={p.claim.status}
              initial={still ? false : { backgroundSize: '0% 100%' }}
              animate={{ backgroundSize: '100% 100%' }}
              transition={{ duration: motionTokens.reveal * 1.6, delay: i * motionTokens.stagger, ease: motionTokens.ease }}
            >
              {p.text}
            </motion.mark>
            <span className={s.margin}>
              {TYPE_LABEL[p.claim.type]}
              {p.claim.value !== null ? ` · ${p.claim.value} ${p.claim.unit ?? ''}` : ''}
              {p.claim.entities.length ? ` · ${p.claim.entities.join(', ')}` : ''}
            </span>
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  )
}
