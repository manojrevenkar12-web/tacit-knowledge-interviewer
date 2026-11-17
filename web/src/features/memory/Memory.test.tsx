import { fireEvent, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { mockApi, renderWithQuery } from '@/shared/testing'
import type { Claim } from '@/shared/types'
import { MemoryView } from './MemoryView'

const c = (over: Partial<Claim>): Claim => ({ id: 'a', expert: 'E3', interviewId: 'iv1', turn: 2, minute: 4.5, topic: 'drying', type: 'threshold', statement: '', quote: 'PA6-GF30 aus einem offenen Sack trocknen wir 6 Stunden.', entities: ['PA6-GF30'], value: 6, unit: 'h', condition: null, confirmed: false, status: 'conflict', alsoSaidBy: [], conflictsWith: ['b'], supersededBy: null, ...over })

test('the memory shows knowledge with its status, and an answer with its sources and the conflict warning', async () => {
  const org = { experts: [{ id: 'E3', name: 'Hakan Yılmaz', role: '', topics: [], leavesInMonths: null }, { id: 'E5', name: 'Jürgen Albers', role: '', topics: [], leavesInMonths: 10 }], topics: [{ id: 'drying', de: 'Materialtrocknung', en: '', critical: true }] }
  mockApi({ org, 'graph?topic=drying': [c({}), c({ id: 'b', expert: 'E5', value: 5, quote: 'PA6-GF30 aus einem offenen Sack trocknen wir 5 Stunden.' })], ask: { abstain: false, text: 'Hakan Yılmaz: 6 Stunden.', cites: [c({})], warnings: ['Widerspruch: Hakan Yılmaz sagt 6 h, Jürgen Albers sagt 5 h. Bitte klären, bevor danach gearbeitet wird.'], reason: '' } })
  renderWithQuery(<MemoryView />)
  expect((await screen.findAllByText('Experts disagree')).length).toBe(2)
  fireEvent.change(screen.getByLabelText('Ask the memory'), { target: { value: 'Wie lange trocknen wir PA6-GF30?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
  expect((await screen.findByText(/^Widerspruch/)).getAttribute('data-kind')).toBe('conflict')
  expect(screen.getAllByText(/Hakan Yılmaz, iv1, min 4:30/).length).toBeGreaterThan(0)
})
