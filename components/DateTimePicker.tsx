'use client'
import { useState } from 'react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']
const HOURS = [12,1,2,3,4,5,6,7,8,9,10,11]
const MINUTES = ['00','15','30','45']

type DateTimePickerProps = {
  value: Date | null
  onChange: (date: Date) => void
  minDate?: Date
}

export default function DateTimePicker({ value, onChange, minDate }: DateTimePickerProps) {
  const now = new Date()
  const initial = value || new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const [viewYear, setViewYear]   = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const [selectedDate, setSelectedDate] = useState<Date | null>(value)
  const [hour, setHour]     = useState(initial.getHours() % 12 || 12)
  const [minute, setMinute] = useState(Math.floor(initial.getMinutes() / 15) * 15)
  const [ampm, setAmpm]     = useState<'AM' | 'PM'>(initial.getHours() >= 12 ? 'PM' : 'AM')

  const min = minDate || now

  function daysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate()
  }

  function firstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay()
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day)
    setSelectedDate(d)
    emit(d, hour, minute, ampm)
  }

  function emit(date: Date, h: number, m: number, ap: 'AM' | 'PM') {
    const d = new Date(date)
    let hours = h % 12
    if (ap === 'PM') hours += 12
    d.setHours(hours, m, 0, 0)
    onChange(d)
  }

  function setHourAndEmit(h: number) {
    setHour(h)
    if (selectedDate) emit(selectedDate, h, minute, ampm)
  }

  function setMinuteAndEmit(m: number) {
    setMinute(m)
    if (selectedDate) emit(selectedDate, hour, m, ampm)
  }

  function setAmpmAndEmit(ap: 'AM' | 'PM') {
    setAmpm(ap)
    if (selectedDate) emit(selectedDate, hour, minute, ap)
  }

  const totalDays = daysInMonth(viewYear, viewMonth)
  const firstDay  = firstDayOfMonth(viewYear, viewMonth)
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const isDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day)
    d.setHours(23, 59, 59)
    return d < min
  }

  const isSelected = (day: number) => {
    if (!selectedDate) return false
    return selectedDate.getFullYear() === viewYear &&
           selectedDate.getMonth() === viewMonth &&
           selectedDate.getDate() === day
  }

  const isToday = (day: number) => {
    const t = new Date()
    return t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === day
  }

  const formattedValue = selectedDate
    ? `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()} \u00B7 ${hour}:${String(minute).padStart(2,'0')} ${ampm}`
    : null

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>

      {/* Selected value display */}
      {formattedValue && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--yellow)' }}>
          {formattedValue}
        </div>
      )}

      {/* Calendar header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 8px' }}>
        <button onClick={prevMonth} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          &lsaquo;
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          &rsaquo;
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 10px' }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text3)', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 10px 10px', gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const disabled = isDisabled(day)
          const selected = isSelected(day)
          const today    = isToday(day)
          return (
            <button key={i} onClick={() => !disabled && selectDay(day)} disabled={disabled}
              style={{
                height: 34, borderRadius: 6,
                background: selected ? 'var(--yellow)' : today ? 'var(--yellow-soft)' : 'transparent',
                border: selected ? 'none' : today ? '1px solid var(--yellow-dim)' : '1px solid transparent',
                color: selected ? '#111' : disabled ? 'var(--border2)' : today ? 'var(--yellow)' : 'var(--text)',
                fontSize: 13, fontWeight: selected ? 700 : today ? 600 : 400,
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}>
              {day}
            </button>
          )
        })}
      </div>

      {/* Time picker */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Time</div>

        {/* Hour row */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {HOURS.map(h => (
            <button key={h} onClick={() => setHourAndEmit(h)}
              style={{ width: 36, height: 32, borderRadius: 6, background: hour === h ? 'var(--yellow)' : 'var(--bg3)', border: `1px solid ${hour === h ? 'var(--yellow)' : 'var(--border)'}`, color: hour === h ? '#111' : 'var(--text2)', fontSize: 12, fontWeight: hour === h ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
              {h}
            </button>
          ))}
        </div>

        {/* Minute and AM/PM row */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {MINUTES.map(m => {
              const mv = parseInt(m)
              return (
                <button key={m} onClick={() => setMinuteAndEmit(mv)}
                  style={{ width: 40, height: 32, borderRadius: 6, background: minute === mv ? 'var(--yellow)' : 'var(--bg3)', border: `1px solid ${minute === mv ? 'var(--yellow)' : 'var(--border)'}`, color: minute === mv ? '#111' : 'var(--text2)', fontSize: 12, fontWeight: minute === mv ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                  :{m}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {(['AM', 'PM'] as const).map(ap => (
              <button key={ap} onClick={() => setAmpmAndEmit(ap)}
                style={{ width: 40, height: 32, borderRadius: 6, background: ampm === ap ? 'var(--yellow)' : 'var(--bg3)', border: `1px solid ${ampm === ap ? 'var(--yellow)' : 'var(--border)'}`, color: ampm === ap ? '#111' : 'var(--text2)', fontSize: 12, fontWeight: ampm === ap ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                {ap}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
