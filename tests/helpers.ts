import { glossary, productConfig } from '../src/product/build.ts'
import { worldConfig } from '../src/world/load.ts'
import { World, type WorldConfig } from '../src/world/world.ts'

export const pcfg = productConfig()
export const g = glossary()

export function world(seed: string, over: Partial<WorldConfig> = {}): World {
  return new World(worldConfig(seed, over))
}
