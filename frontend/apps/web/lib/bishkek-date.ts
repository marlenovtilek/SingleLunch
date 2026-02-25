const BISHKEK_UTC_OFFSET_MS = 6 * 60 * 60 * 1000
const WEEKDAY_SHORT_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function formatIsoDateFromUtc(dateValue: Date): string {
  const year = dateValue.getUTCFullYear()
  const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0')
  const day = String(dateValue.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDateParts(isoDate: string):
  | { year: number; month: number; day: number }
  | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }

  const [, yearRaw, monthRaw, dayRaw] = match
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }

  const normalized = new Date(Date.UTC(year, month - 1, day))
  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() + 1 !== month ||
    normalized.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

function toUtcDate(isoDate: string): Date | null {
  const parts = parseIsoDateParts(isoDate)
  if (!parts) {
    return null
  }
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
}

function isWeekendDay(weekday: number): boolean {
  return weekday === 0 || weekday === 6
}

export function getTodayDateStringBishkek(): string {
  const nowBishkek = new Date(Date.now() + BISHKEK_UTC_OFFSET_MS)
  return formatIsoDateFromUtc(nowBishkek)
}

export function getTomorrowDateStringBishkek(): string {
  const nowBishkek = new Date(Date.now() + BISHKEK_UTC_OFFSET_MS)
  nowBishkek.setUTCDate(nowBishkek.getUTCDate() + 1)
  return formatIsoDateFromUtc(nowBishkek)
}

export function getNextBusinessDateStringBishkek(): string {
  const date = new Date(Date.now() + BISHKEK_UTC_OFFSET_MS)
  do {
    date.setUTCDate(date.getUTCDate() + 1)
  } while (isWeekendDay(date.getUTCDay()))

  return formatIsoDateFromUtc(date)
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

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = toUtcDate(isoDate)
  if (!date) {
    return isoDate
  }
  date.setUTCDate(date.getUTCDate() + days)
  return formatIsoDateFromUtc(date)
}

export function buildBusinessDateOptions(
  startDate: string,
  daysAhead = 120
): string[] {
  const cursor = toUtcDate(startDate)
  if (!cursor) {
    return []
  }

  const options: string[] = []
  for (let i = 0; i <= daysAhead; i += 1) {
    if (!isWeekendDay(cursor.getUTCDay())) {
      options.push(formatIsoDateFromUtc(cursor))
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return options
}

export function getPreviousBusinessDate(isoDate: string): string {
  const date = toUtcDate(isoDate)
  if (!date) {
    return isoDate
  }

  do {
    date.setUTCDate(date.getUTCDate() - 1)
  } while (isWeekendDay(date.getUTCDay()))

  return formatIsoDateFromUtc(date)
}

export function normalizeIsoMonth(value: string | undefined, fallback: string) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return fallback
  }
  const month = Number(value.slice(5, 7))
  if (month < 1 || month > 12) {
    return fallback
  }
  return value
}

export function buildBusinessMonthDays(month: string): string[] {
  const year = Number(month.slice(0, 4))
  const monthNum = Number(month.slice(5, 7))
  if (
    Number.isNaN(year) ||
    Number.isNaN(monthNum) ||
    monthNum < 1 ||
    monthNum > 12
  ) {
    return []
  }

  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
  const days: string[] = []
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateValue = `${month}-${String(day).padStart(2, '0')}`
    if (isIsoDateWeekend(dateValue)) {
      continue
    }
    days.push(dateValue)
  }
  return days
}

export function getIsoWeekdayShortLabel(isoDate: string): string {
  const date = toUtcDate(isoDate)
  if (!date) {
    return ''
  }
  return WEEKDAY_SHORT_LABELS[date.getUTCDay()] ?? ''
}

export function isIsoDateWeekend(isoDate: string): boolean {
  const date = toUtcDate(isoDate)
  if (!date) {
    return false
  }
  return isWeekendDay(date.getUTCDay())
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
