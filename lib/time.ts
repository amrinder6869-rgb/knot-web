// Time zone helpers built on the Intl support that ships with Node and every
// modern browser. No packages. Used by the planning agent so that "7pm" typed
// by a member becomes the right UTC instant in code, instead of the model
// guessing an offset.

const FALLBACK_TIME_ZONE = 'America/Toronto'

export function isValidTimeZone(timeZone: string | null | undefined): boolean {
  if (!timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function safeZone(timeZone: string): string {
  return isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE
}

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number }

// The wall-clock reading in `timeZone` at the instant `date`.
function wallClockAt(date: Date, timeZone: string): WallClock {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(timeZone),
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

// Milliseconds the zone is ahead of UTC at `date` (negative for the Americas).
export function zoneOffsetMs(date: Date, timeZone: string): number {
  const w = wallClockAt(date, timeZone)
  const asIfUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000
}

// "2026-10-03T19:00" (or with seconds, or a space instead of T) read as a
// wall-clock time in `timeZone`, returned as the UTC instant. A date with no
// time reads as noon. Returns null when the text is not a plain local time.
export function localToUtc(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(local.trim())
  if (!m) return null
  const hasTime = m[4] !== undefined
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], hasTime ? +m[4] : 12, hasTime ? +m[5] : 0, +(m[6] || 0))
  if (isNaN(guess)) return null
  // Two passes so a time on either side of a daylight-saving switch lands
  // on the offset that is actually in force at that moment.
  let utc = guess - zoneOffsetMs(new Date(guess), timeZone)
  utc = guess - zoneOffsetMs(new Date(utc), timeZone)
  const d = new Date(utc)
  return isNaN(d.getTime()) ? null : d
}

// True when the text carries its own offset ("Z", "+00:00", "-0700"), which
// means it is already an absolute instant and must not be shifted again.
export function hasExplicitOffset(text: string): boolean {
  return /(Z|[+-]\d{2}:?\d{2})$/i.test(text.trim())
}

// "Sat, Oct 3, 7:00 PM" in the zone.
export function formatInZone(date: Date | string, timeZone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(timeZone),
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(d)
}

// The current moment in the zone, both as the machine form the model is
// asked to echo ("2026-09-28T19:15") and a readable label for the prompt.
export function nowInZone(timeZone: string, now: Date = new Date()): { iso: string; label: string } {
  const w = wallClockAt(now, timeZone)
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(timeZone),
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(now)
  return { iso, label }
}

// "2026-10-03" for the instant, read in the zone.
export function dateInZone(date: Date, timeZone: string): string {
  const w = wallClockAt(date, timeZone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`
}

// 0 = Sunday ... 6 = Saturday, read in the zone.
export function weekdayInZone(date: Date, timeZone: string): number {
  const w = wallClockAt(date, timeZone)
  return new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay()
}

const WEEKDAY_WORDS: [RegExp, number][] = [
  [/\bsun(?:day)?\b/i, 0],
  [/\bmon(?:day)?\b/i, 1],
  [/\btue(?:s|sday)?\b/i, 2],
  [/\bwed(?:s|nesday)?\b/i, 3],
  [/\bthu(?:r|rs|rsday)?\b/i, 4],
  [/\bfri(?:day)?\b/i, 5],
  [/\bsat(?:urday)?\b/i, 6],
]
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Guard for the planning agent. When the member's message names one
// weekday, or says today or tomorrow, the resolved instant must land on
// that day in the zone. Returns a short reason when it does not, and null
// when the message makes no such claim or the date agrees with it. Two
// different weekdays in one message ("not Friday, Saturday") is ambiguous
// and is left alone.
export function relativeDayMismatch(
  message: string,
  resolved: Date,
  timeZone: string,
  now: Date = new Date(),
): string | null {
  const named = WEEKDAY_WORDS.filter(([re]) => re.test(message)).map(([, day]) => day)
  const distinct = Array.from(new Set(named))
  const resolvedDay = weekdayInZone(resolved, timeZone)
  if (distinct.length === 1) {
    if (resolvedDay !== distinct[0]) {
      return `message names ${WEEKDAY_NAMES[distinct[0]]} but resolved date is a ${WEEKDAY_NAMES[resolvedDay]}`
    }
    return null
  }
  if (distinct.length > 1) return null

  const todayIso = dateInZone(now, timeZone)
  const resolvedIso = dateInZone(resolved, timeZone)
  if (/\btomorrow\b/i.test(message) && !/\bday after tomorrow\b/i.test(message)) {
    const tomorrow = dateInZone(new Date(now.getTime() + 24 * 60 * 60 * 1000), timeZone)
    if (resolvedIso !== tomorrow) return `message says tomorrow (${tomorrow}) but resolved date is ${resolvedIso}`
    return null
  }
  if (/\b(today|tonight)\b/i.test(message)) {
    if (resolvedIso !== todayIso) return `message says today (${todayIso}) but resolved date is ${resolvedIso}`
  }
  return null
}
