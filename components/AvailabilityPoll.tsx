'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

type PollOption = {
  id: string
  poll_id: string
  date_option: string
  time_option: string | null
  sort_order: number
}

type PollResponse = {
  id: string
  poll_id: string
  option_id: string
  user_id: string
  available: 'yes' | 'maybe' | 'no'
}

const STATUS_STYLE: Record<'yes' | 'maybe' | 'no', { symbol: string; color: string; bg: string }> = {
  yes:   { symbol: '✓', color: 'var(--sage)',   bg: 'var(--sage-soft)' },
  maybe: { symbol: '–', color: 'var(--amber)',  bg: 'var(--amber-soft)' },
  no:    { symbol: '✕', color: 'var(--danger)', bg: 'var(--danger-soft)' },
}

function formatOptionDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function cycleStatus(current: 'yes' | 'maybe' | 'no' | undefined): 'yes' | 'maybe' | 'no' {
  if (current === 'yes') return 'maybe'
  if (current === 'maybe') return 'no'
  return 'yes'
}

export default function AvailabilityPoll({ pollId, knotId: _knotId, currentUser, members, onDateSelected }: {
  pollId: string
  knotId: string
  currentUser: any
  members: any[]
  onDateSelected: (date: string, time: string | null) => void
}) {
  const [options, setOptions]   = useState<PollOption[]>([])
  const [responses, setResponses] = useState<PollResponse[]>([])
  const [loading, setLoading]   = useState(true)
  const [pollStatus, setPollStatus] = useState<'open' | 'closed'>('open')
  const [organizerId, setOrganizerId] = useState<string | null>(null)

  async function loadResponses() {
    const { data } = await supabase.from('availability_poll_responses').select('*').eq('poll_id', pollId)
    setResponses(data || [])
  }

  async function loadPoll() {
    setLoading(true)
    const [{ data: pollRows }, { data: optionsData }, { data: responsesData }] = await Promise.all([
      supabase.from('availability_polls').select('*').eq('id', pollId).limit(1),
      supabase.from('availability_poll_options').select('*').eq('poll_id', pollId).order('sort_order', { ascending: true }),
      supabase.from('availability_poll_responses').select('*').eq('poll_id', pollId),
    ])
    const poll = pollRows?.[0]
    setOrganizerId(poll?.created_by ?? null)
    setPollStatus(poll?.status || 'open')
    setOptions(optionsData || [])
    setResponses(responsesData || [])
    setLoading(false)
  }

  useEffect(() => {
    loadPoll()

    const channel = supabase
      .channel(`availability-poll:${pollId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'availability_poll_responses', filter: `poll_id=eq.${pollId}`,
      }, () => loadResponses())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [pollId])

  async function respond(optionId: string, next: 'yes' | 'maybe' | 'no') {
    if (!currentUser?.id) return
    setResponses(prev => {
      const filtered = prev.filter(r => !(r.option_id === optionId && r.user_id === currentUser.id))
      return [...filtered, { id: `${optionId}:${currentUser.id}`, poll_id: pollId, option_id: optionId, user_id: currentUser.id, available: next }]
    })
    await supabase.from('availability_poll_responses').upsert(
      { poll_id: pollId, option_id: optionId, user_id: currentUser.id, available: next },
      { onConflict: 'option_id,user_id' }
    )
  }

  const bestOption = useMemo(() => {
    if (options.length === 0) return null
    let best = options[0]
    let bestYes = -1
    for (const opt of options) {
      const yesCount = responses.filter(r => r.option_id === opt.id && r.available === 'yes').length
      if (yesCount > bestYes) { bestYes = yesCount; best = opt }
    }
    return best
  }, [options, responses])

  const isOrganizer = !!organizerId && organizerId === currentUser?.id

  if (loading) return null
  if (options.length === 0) return null

  return (
    <div style={{ background: '#ffffff', border: '0.5px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
        Availability poll
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: members.length * 40 + 100 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '4px 8px' }} />
              {members.map(m => (
                <th key={m.id} style={{ padding: '4px 4px', fontSize: 10, color: 'var(--text3)', fontWeight: 600, textAlign: 'center', maxWidth: 40, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(m.name || 'U').split(' ')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {options.map(opt => {
              const isBest = bestOption?.id === opt.id
              return (
                <tr key={opt.id} style={{ background: isBest ? 'var(--sage-soft)' : 'transparent' }}>
                  <td style={{ padding: '6px 8px', fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    {formatOptionDate(opt.date_option)}
                  </td>
                  {members.map(m => {
                    const isMe = m.id === currentUser?.id
                    const resp = responses.find(r => r.option_id === opt.id && r.user_id === m.id)
                    const style = resp ? STATUS_STYLE[resp.available] : null
                    return (
                      <td key={m.id} style={{ textAlign: 'center', padding: 3 }}>
                        {isMe ? (
                          <button
                            onClick={() => respond(opt.id, cycleStatus(resp?.available))}
                            disabled={pollStatus !== 'open'}
                            style={{
                              width: 28, height: 28, borderRadius: 8,
                              border: `1px solid ${style ? style.color : 'var(--border2)'}`,
                              background: style ? style.bg : 'var(--bg3)',
                              color: style ? style.color : 'var(--text3)',
                              fontSize: 13, fontWeight: 800,
                              cursor: pollStatus === 'open' ? 'pointer' : 'default',
                              fontFamily: 'inherit',
                            }}>
                            {style ? style.symbol : '?'}
                          </button>
                        ) : (
                          <span style={{
                            display: 'inline-flex', width: 28, height: 28, borderRadius: 8,
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700,
                            color: style ? style.color : 'var(--border2)',
                            background: style ? style.bg : 'transparent',
                          }}>
                            {style ? style.symbol : '·'}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {bestOption && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', background: 'var(--sage-soft)', border: '1px solid var(--sage-dim)', borderRadius: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sage)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Best date</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{formatOptionDate(bestOption.date_option)}</div>
          </div>
          {isOrganizer && pollStatus === 'open' && (
            <button onClick={() => onDateSelected(bestOption.date_option, bestOption.time_option)}
              style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              Pick this date
            </button>
          )}
        </div>
      )}
    </div>
  )
}
