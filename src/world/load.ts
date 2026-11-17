import { readJson } from '../config.ts'
import type { WorldConfig } from './world.ts'

/** The world reads its own file, never the product's settings. */
export function worldConfig(seed: string, overrides: Partial<WorldConfig> = {}): WorldConfig {
  return { ...readJson<Omit<WorldConfig, 'seed'>>('config/world.json'), seed, ...overrides }
}
