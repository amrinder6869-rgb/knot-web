/** Convert model plan_updates.scheduled_for values into ISO 8601 timestamps. */

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
}

function wallParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  const weekdayName = get('weekday')
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: weekdayMap[weekdayName] ?? 0,
  }
}

function zonedIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0)
  let utc = desired
  for (let i = 0; i < 3; i++) {
    const w = wallParts(new Date(utc), timeZone)
    const wall = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
    utc += desired - wall
  }
  return new Date(utc).toISOString()
}

function parseTimeBits(raw: string): { hour: number; minute: number } | null {
  const s = raw.toLowerCase().replace(/\./g, '')
  if (/\bmidnight\b/.test(s)) return { hour: 0, minute: 0 }
  if (/\bnoon\b/.test(s) || /\bmidday\b/.test(s)) return { hour: 12, minute: 0 }
  const hasDigit = /\d/.test(s)
  if (!hasDigit) {
    if (/\bafternoon\b/.test(s)) return { hour: 15, minute: 0 }
    if (/\bmorning\b/.test(s)) return { hour: 10, minute: 0 }
    if (/\bevening\b/.test(s) || /\bnight\b/.test(s)) return { hour: 19, minute: 0 }
    return null
  }
  const m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/)
  if (!m) return null
  let hour = Number(m[1])
  const minute = m[2] ? Number(m[2]) : 0
  if (hour > 23 || minute > 59) return null
  const ap = (m[3] || '').replace(/\./g, '')
  if (ap.startsWith('p') && hour < 12) hour += 12
  else if (ap.startsWith('a') && hour === 12) hour = 0
  else if (!ap && hour >= 1 && hour <= 7) hour += 12
  return { hour, minute }
}

function parseWeekday(raw: string): number | null {
  const s = raw.toLowerCase()
  for (const [name, day] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(s)) return day
  }
  return null
}

function addDaysToWall(
  wall: ReturnType<typeof wallParts>,
  days: number,
): { year: number; month: number; day: number } {
  const utc = Date.UTC(wall.year, wall.month - 1, wall.day + days)
  const d = new Date(utc)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

function nextOrThisWeekday(
  nowWall: ReturnType<typeof wallParts>,
  targetWeekday: number,
  hour: number,
  minute: number,
): { year: number; month: number; day: number } {
  let delta = (targetWeekday - nowWall.weekday + 7) % 7
  if (delta === 0) {
    const nowMinutes = nowWall.hour * 60 + nowWall.minute
    if (hour * 60 + minute <= nowMinutes) delta = 7
  }
  return addDaysToWall(nowWall, delta)
}

export function timeZoneForCity(city: string): string {
  const c = city.toLowerCase()
  if (c.includes('vancouver')) return 'America/Vancouver'
  if (c.includes('los angeles') || c.includes('san francisco') || /\bsf\b/.test(c)) return 'America/Los_Angeles'
  if (c.includes('new york') || c.includes('nyc')) return 'America/New_York'
  if (c.includes('chicago')) return 'America/Chicago'
  return 'America/Toronto'
}

export function biasVenueQuery(query: string, city: string): string {
  const q = query.trim()
  if (!q) return q
  const lower = q.toLowerCase()
  const cityLower = city.trim().toLowerCase()
  if (cityLower && lower.includes(cityLower)) return q
  const genericNear = /\bnear\s+(downtown|here|me|us|the city)\b/i
  if (genericNear.test(q) && city) return q.replace(genericNear, `near ${city}`)
  if (/\bnear\b/i.test(q)) return q
  return city ? `${q} near ${city}` : q
}

export function parseScheduledFor(
  value: unknown,
  existingIso: string | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): string | null {
  if (value == null || value === '') return null

  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const iso = new Date(trimmed)
      if (!Number.isNaN(iso.getTime())) return iso.toISOString()
    }
  } else {
    return null
  }

  const raw = String(value).trim()
  const nowWall = wallParts(now, timeZone)
  const existing = existingIso ? new Date(existingIso) : null
  const existingWall = existing && !Number.isNaN(existing.getTime()) ? wallParts(existing, timeZone) : null

  const time = parseTimeBits(raw)
  const weekday = parseWeekday(raw)
  const lower = raw.toLowerCase()
  const isToday = /\btoday\b/.test(lower)
  const isTomorrow = /\btomorrow\b/.test(lower)
  const isWeekend = /\bweekend\b/.test(lower)

  let datePart: { year: number; month: number; day: number } | null = null
  if (isToday) {
    datePart = { year: nowWall.year, month: nowWall.month, day: nowWall.day }
  } else if (isTomorrow) {
    datePart = addDaysToWall(nowWall, 1)
  } else if (weekday != null) {
    const hour = time?.hour ?? (existingWall ? existingWall.hour : 19)
    const minute = time?.minute ?? (existingWall ? existingWall.minute : 0)
    datePart = nextOrThisWeekday(nowWall, weekday, hour, minute)
  } else if (isWeekend) {
    const hour = time?.hour ?? 19
    const minute = time?.minute ?? 0
    datePart = nextOrThisWeekday(nowWall, 6, hour, minute)
  } else if (existingWall) {
    datePart = { year: existingWall.year, month: existingWall.month, day: existingWall.day }
  } else if (time) {
    datePart = { year: nowWall.year, month: nowWall.month, day: nowWall.day }
    const endOfSlot = time.hour * 60 + time.minute
    const nowMinutes = nowWall.hour * 60 + nowWall.minute
    if (endOfSlot <= nowMinutes) datePart = addDaysToWall(nowWall, 1)
  }

  if (!datePart) return null

  const hour = time?.hour ?? existingWall?.hour ?? 19
  const minute = time?.minute ?? existingWall?.minute ?? 0
  return zonedIso(datePart.year, datePart.month, datePart.day, hour, minute, timeZone)
}
