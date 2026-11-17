import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { mockApi, renderWithQuery } from '@/shared/testing'
import type { Claim } from '@/shared/types'
import { Highlighted } from './Highlighted'
import { InterviewsView } from './InterviewsView'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }))

const claim: Claim = { id: 'c1', expert: 'E1', interviewId: 'iv1', turn: 2, minute: 3, topic: 'startup', type: 'exception', statement: '', quote: 'Die SGM sieben macht nach dem Wochenende Ärger mit der Düse.', entities: ['SGM-07'], value: null, unit: null, condition: null, confirmed: false, status: 'single source', alsoSaidBy: [], conflictsWith: [], supersededBy: null }

test('the sentence that became knowledge is marked and labelled; small talk stays plain', () => {
  const { container } = renderWithQuery(<Highlighted text={`Das läuft eigentlich ganz normal. ${claim.quote}`} claims={[claim]} />)
  expect([...container.querySelectorAll('mark')].map((m) => m.textContent)).toEqual([claim.quote])
  expect(screen.getByText('Exception · SGM-07')).toBeTruthy()
})

describe('interviews', () => {
  test('the plan names who to interview next and why', async () => {
    mockApi({ org: { experts: [{ id: 'E1', name: 'Werner Kraus', role: 'Schichtleiter', topics: ['startup'], leavesInMonths: 4 }], topics: [{ id: 'startup', de: 'Anfahren der Maschinen', en: '', critical: true }, { id: 'toolchange', de: 'Werkzeugwechsel', en: '', critical: true }] }, interviews: [], plan: { next: { expert: 'E1', focus: ['startup', 'toolchange'], why: '' }, atRisk: [] } })
    renderWithQuery(<InterviewsView />)
    expect(await screen.findByText('Werner Kraus')).toBeTruthy()
    expect(screen.getByText(/on Anfahren der Maschinen and Werkzeugwechsel/)).toBeTruthy()
    expect(await screen.findByText('No interviews yet')).toBeTruthy()
  })
  test('a memory that does not answer says so, with a way to retry', async () => {
    mockApi({})
    renderWithQuery(<InterviewsView />)
    expect((await screen.findAllByRole('alert'))[0].textContent).toMatch(/not reachable/)
  })
})
