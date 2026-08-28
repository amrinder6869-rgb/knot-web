'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import MemberAvatar from '@/components/MemberAvatar'
import KnotIcon from '@/components/KnotIcon'
import {
  BILLS_CROSS_KNOT_TITLE,
  BILLS_CROSS_KNOT_TOTAL_OWED,
  BILLS_CROSS_KNOT_TOTAL_OWE,
} from '@/lib/copy'

export interface CrossKnotBalancesProps {
  currentUser: any
  knots: any[]
  onClose: () => void
  onOpenKnot: (knot: any) => void
}

type KnotNetRow = {
  debtor_id: string
  creditor_id: string
  knot_id: string
  total_owed: number
}

type PersonBalance = {
  userId: string
  name: string
  avatar_url: string | null
  net: number
  knotTags: { knot: any; amount: number; direction: 'owe' | 'owed' }[]
}

export default function CrossKnotBalances({ currentUser, knots, onClose, onOpenKnot }: CrossKnotBalancesProps) {
  const [rows, setRows] = useState<KnotNetRow[]>([])
  const [profiles, setProfiles] = useState<Record<string, { name: string; avatar_url: string | null }>>({})
  const [loading, setLoading] = useState(true)

  const userId = currentUser?.id

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const [{ data: knotRows }, { data: crossRows }] = await Promise.all([
        supabase
          .from('knot_net_balances')
          .select('debtor_id, creditor_id, knot_id, total_owed')
          .or(`debtor_id.eq.${userId},creditor_id.eq.${userId}`),
        supabase
          .from('cross_knot_balances')
          .select('debtor_id, creditor_id, total_owed')
          .or(`debtor_id.eq.${userId},creditor_id.eq.${userId}`),
      ])

      if (cancelled) return

      const knotNet = (knotRows || []).map((r: any) => ({
        debtor_id: r.debtor_id,
        creditor_id: r.creditor_id,
        knot_id: r.knot_id,
        total_owed: parseFloat(r.total_owed),
      }))
      setRows(knotNet)

      const otherIds = new Set<string>()
      for (const r of knotNet) {
        if (r.debtor_id !== userId) otherIds.add(r.debtor_id)
        if (r.creditor_id !== userId) otherIds.add(r.creditor_id)
      }
      for (const r of crossRows || []) {
        if (r.debtor_id !== userId) otherIds.add(r.debtor_id)
        if (r.creditor_id !== userId) otherIds.add(r.creditor_id)
      }

      if (otherIds.size > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', Array.from(otherIds))
        const map: Record<string, { name: string; avatar_url: string | null }> = {}
        for (const p of profs || []) {
          map[p.id] = { name: p.name || 'Someone', avatar_url: p.avatar_url || null }
        }
        if (!cancelled) setProfiles(map)
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  const knotById = useMemo(() => new Map(knots.map(k => [k.id, k])), [knots])

  const people = useMemo(() => {
    const grouped = new Map<string, PersonBalance>()
    for (const row of rows) {
      const isDebtor = row.debtor_id === userId
      const otherId = isDebtor ? row.creditor_id : row.debtor_id
      const knot = knotById.get(row.knot_id)
      const prof = profiles[otherId]
      const existing = grouped.get(otherId) || {
        userId: otherId,
        name: prof?.name || 'Someone',
        avatar_url: prof?.avatar_url || null,
        net: 0,
        knotTags: [],
      }
      const signed = isDebtor ? -row.total_owed : row.total_owed
      existing.net += signed
      if (knot) {
        existing.knotTags.push({
          knot,
          amount: row.total_owed,
          direction: isDebtor ? 'owe' : 'owed',
        })
      }
      grouped.set(otherId, existing)
    }
    return Array.from(grouped.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
  }, [rows, userId, knotById, profiles])

  const totalOwedToYou = people.reduce((sum, p) => sum + (p.net > 0 ? p.net : 0), 0)
  const totalYouOwe = people.reduce((sum, p) => sum + (p.net < 0 ? -p.net : 0), 0)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, top: 0, zIndex: 301,
        background: '#fff', display: 'flex', flexDirection: 'column',
        maxWidth: 480, margin: '0 auto',
      }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{BILLS_CROSS_KNOT_TITLE}</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
        </div>

        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderBottom: '1px solid var(--border)' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--sage)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{BILLS_CROSS_KNOT_TOTAL_OWED}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--sage)' }}>${totalOwedToYou.toFixed(2)}</div>
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--yellow)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{BILLS_CROSS_KNOT_TOTAL_OWE}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--yellow)' }}>${totalYouOwe.toFixed(2)}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Loading balances…</div>
          ) : people.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)' }}>
              <div style={{ fontWeight: 600, color: 'var(--sage)' }}>All settled up everywhere</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {people.map(person => {
                const theyOweYou = person.net > 0
                const primaryKnot = person.knotTags[0]?.knot
                return (
                  <div key={person.userId} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <MemberAvatar name={person.name} avatarUrl={person.avatar_url} size={36} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{person.name}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: theyOweYou ? 'var(--sage)' : 'var(--danger)' }}>
                          {theyOweYou ? `Owes you $${person.net.toFixed(2)}` : `You owe $${Math.abs(person.net).toFixed(2)}`}
                        </div>
                      </div>
                      {primaryKnot && (
                        <button type="button" onClick={() => onOpenKnot(primaryKnot)}
                          style={{ padding: '8px 12px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Settle
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {person.knotTags.map((tag, i) => (
                        <button key={`${tag.knot.id}-${i}`} type="button" onClick={() => onOpenKnot(tag.knot)}
                          style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            border: `1px solid ${tag.direction === 'owed' ? 'var(--sage)' : 'var(--yellow-dim)'}`,
                            background: tag.direction === 'owed' ? 'var(--sage-soft)' : 'var(--yellow-soft)',
                            color: tag.direction === 'owed' ? 'var(--sage)' : 'var(--yellow)',
                          }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <KnotIcon value={tag.knot.emoji} size={16} iconSize={9} />
                            {tag.knot.name} · ${tag.amount.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
