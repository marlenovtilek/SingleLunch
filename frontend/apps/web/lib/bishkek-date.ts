const BISHKEK_UTC_OFFSET_MS = 6 * 60 * 60 * 1000
export function getTodayDateStringBishkek(): string {
  const nowBishkek = new Date(Date.now() + BISHKEK_UTC_OFFSET_MS)
  const year = nowBishkek.getUTCFullYear()
  const month = String(nowBishkek.getUTCMonth() + 1).padStart(2, '0')
  const day = String(nowBishkek.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTomorrowDateStringBishkek(): string {
  const nowBishkek = new Date(Date.now() + BISHKEK_UTC_OFFSET_MS)
  nowBishkek.setUTCDate(nowBishkek.getUTCDate() + 1)
  const year = nowBishkek.getUTCFullYear()
  const month = String(nowBishkek.getUTCMonth() + 1).padStart(2, '0')
  const day = String(nowBishkek.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getNextBusinessDateStringBishkek(): string {
  const date = new Date(Date.now() + BISHKEK_UTC_OFFSET_MS)
  do {
    date.setUTCDate(date.getUTCDate() + 1)
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6)

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getCurrentMonthBishkek(): string {
  const nowBishkek = new Date(Date.now() + BISHKEK_UTC_OFFSET_MS)
  const year = nowBishkek.getUTCFullYear()
  const month = String(nowBishkek.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function getNowDateTimeLocalStringBishkek(): string {
  const nowBishkek = new Date(Date.now() + BISHKEK_UTC_OFFSET_MS)
  const year = nowBishkek.getUTCFullYear()
  const month = String(nowBishkek.getUTCMonth() + 1).padStart(2, '0')
  const day = String(nowBishkek.getUTCDate()).padStart(2, '0')
  const hours = String(nowBishkek.getUTCHours()).padStart(2, '0')
  const minutes = String(nowBishkek.getUTCMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function isIsoDateWeekend(isoDate: string): boolean {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false
  }
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return weekday === 0 || weekday === 6
}

export function isLocalDateTimeWeekend(localDateTime: string): boolean {
  const isoDate = localDateTime.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return false
  }
  return isIsoDateWeekend(isoDate)
}

export function formatIsoDateDdMmYyyy(isoDate: string): string {
  const parts = isoDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some((item) => Number.isNaN(item))) {
    return isoDate
  }
  const [year, month, day] = parts
  if (month < 1 || month > 12) {
    return isoDate
  }
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`
}

export function formatIsoDateTimeDdMmYyyyBishkek(isoDateTime: string): string {
  const source = new Date(isoDateTime)
  if (Number.isNaN(source.getTime())) {
    return isoDateTime
  }

  const bishkek = new Date(source.getTime() + BISHKEK_UTC_OFFSET_MS)
  const day = bishkek.getUTCDate()
  const month = bishkek.getUTCMonth() + 1
  const year = bishkek.getUTCFullYear()
  const hours = String(bishkek.getUTCHours()).padStart(2, '0')
  const minutes = String(bishkek.getUTCMinutes()).padStart(2, '0')

  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}, ${hours}:${minutes}`
}

// Backward-compatible aliases
export const formatIsoDateRuLong = formatIsoDateDdMmYyyy
export const formatIsoDateTimeRuLongBishkek = formatIsoDateTimeDdMmYyyyBishkek
