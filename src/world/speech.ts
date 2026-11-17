/** German numbers as people say them, which is how speech-to-text sometimes writes them. */

const ONES = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn']
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig']

export function germanNumber(n: number): string {
  if (n < 20) return ONES[n]
  if (n < 100) {
    const t = Math.floor(n / 10)
    const o = n % 10
    return o ? `${o === 1 ? 'ein' : ONES[o]}und${TENS[t]}` : TENS[t]
  }
  if (n < 1000) {
    const h = Math.floor(n / 100)
    const r = n % 100
    return `${h === 1 ? 'ein' : ONES[h]}hundert${r ? germanNumber(r) : ''}`
  }
  const th = Math.floor(n / 1000)
  const r = n % 1000
  return `${th === 1 ? 'ein' : ONES[th]}tausend${r ? germanNumber(r) : ''}`
}
