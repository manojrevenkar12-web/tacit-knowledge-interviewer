import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { mockApi, renderWithQuery } from '@/shared/testing'
import { ResultsView } from './ResultsView'

const m = { capturedShare: 0.8935, tacitShare: 0.86, atRiskShare: 0.97, perExpertHour: 23.1, wrongFacts: 5, expertHours: 2.4, right: 0.74, wrong: 0.036, honestGap: 0.19, costPerSessionCents: 8.4 }

test('results list each design, mark ours and show the gate', async () => {
  mockApi({ results: { dev: { seeds: ['dev-1'], designs: [{ name: 'platform', label: 'Gap-driven interviews', metrics: m }, { name: 'questionnaire', label: 'Fixed questionnaire', metrics: { ...m, capturedShare: 0.72 } }] }, heldout: null, gate: { pass: true, checks: [{ name: 'knowledge captured', value: 0.89, limit: '≥ 0.85', pass: true }] } } })
  renderWithQuery(<ResultsView />)
  expect(await screen.findByText('The release gate passes')).toBeTruthy()
  expect(screen.getByText('89%')).toBeTruthy()
  expect(screen.getByText('72%')).toBeTruthy()
  expect(screen.getByText('The held-out seeds have not been run.')).toBeTruthy()
})
