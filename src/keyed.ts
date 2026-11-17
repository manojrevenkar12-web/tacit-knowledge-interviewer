import { createHash } from 'node:crypto'

/** Randomness keyed by what it is about, never by call order: every design sees the same luck. */
export class Keyed {
  readonly seed: string
  constructor(seed: string) {
    this.seed = seed
  }

  private hash(parts: readonly (string | number)[]): Buffer {
    return createHash('sha256').update([this.seed, ...parts].join('|')).digest()
  }

  /** A uniform draw in [0, 1). */
  u(...parts: (string | number)[]): number {
    return this.hash(parts).readUIntBE(0, 6) / 2 ** 48
  }

  chance(p: number, ...parts: (string | number)[]): boolean {
    return this.u(...parts) < p
  }

  between(lo: number, hi: number, ...parts: (string | number)[]): number {
    return lo + (hi - lo) * this.u(...parts)
  }

  int(lo: number, hi: number, ...parts: (string | number)[]): number {
    return lo + Math.floor((hi - lo + 1) * this.u(...parts))
  }

  pick<T>(items: readonly T[], ...parts: (string | number)[]): T {
    return items[Math.floor(this.u(...parts) * items.length)]
  }

  poisson(mean: number, ...parts: (string | number)[]): number {
    const limit = Math.exp(-mean)
    let k = 0
    let p = 1
    for (;;) {
      p *= this.u(...parts, 'poisson', k)
      if (p <= limit) return k
      k += 1
    }
  }

  /** A fast stream for many draws about one subject, seeded from the key. */
  stream(...parts: (string | number)[]): () => number {
    const h = this.hash(parts)
    let a = h.readUInt32BE(0)
    let b = h.readUInt32BE(4)
    let c = h.readUInt32BE(8)
    let d = h.readUInt32BE(12)
    return () => {
      // sfc32
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0
      let t = (a + b) | 0
      a = b ^ (b >>> 9)
      b = (c + (c << 3)) | 0
      c = (c << 21) | (c >>> 11)
      d = (d + 1) | 0
      t = (t + d) | 0
      c = (c + t) | 0
      return (t >>> 0) / 4294967296
    }
  }
}
