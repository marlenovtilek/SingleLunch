const BISHKEK_UTC_OFFSET_MS = 6 * 60 * 60 * 1000

export function getTodayDateStringBishkek(): string {
  const nowBishkek = new Date(Date.now() + BISHKEK_UTC_OFFSET_MS)
  const year = nowBishkek.getUTCFullYear()
  const month = String(nowBishkek.getUTCMonth() + 1).padStart(2, '0')
  const day = String(nowBishkek.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getCurrentMonthBishkek(): string {
  const nowBishkek = new Date(Date.now() + BISHKEK_UTC_OFFSET_MS)
  const year = nowBishkek.getUTCFullYear()
  const month = String(nowBishkek.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
