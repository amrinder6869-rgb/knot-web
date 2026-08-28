export type ScannedItem = { description: string; amount: number }

export function normalizeOcrItems(raw: unknown[]): ScannedItem[] {
  return raw.map(item => {
    if (item && typeof item === 'object' && 'description' in item && 'amount' in item) {
      const row = item as { description: string; amount: number }
      return { description: String(row.description).trim(), amount: Number(row.amount) }
    }
    const str = String(item).trim()
    const match = str.match(/^(.+?)\s+[\$]?(\d+(?:\.\d{1,2})?)\s*$/)
    if (match) return { description: match[1].trim(), amount: parseFloat(match[2]) }
    return { description: str, amount: 0 }
  }).filter(row => row.description)
}

export function computeReceiptHash(items: ScannedItem[], total: number): string {
  const input = items.map(i => `${i.description}:${i.amount.toFixed(2)}`).join('|') + '|' + total.toFixed(2)
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16)
}
