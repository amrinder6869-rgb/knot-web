'use client'

import { useState } from 'react'
import {
  Crown, Star, Wallet, Zap, Car,
  CalendarCheck, UtensilsCrossed, Camera, Music, X, Check
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  HangoutRoleType,
  ROLE_LABELS,
  STRUCTURAL_ROLES,
  TASK_ROLES,
} from '@/types/roles'

interface Member {
  user_id: string
  name: string
  avatar_url: string | null
}

interface RoleAssignSheetProps {
  hangoutId: string
  member: Member
  currentRoles: HangoutRoleType[]
  onClose: () => void
  onRolesUpdated: (assignedRole?: HangoutRoleType) => void
}

const ROLE_DESCRIPTIONS: Record<HangoutRoleType, string> = {
  master_planner: 'Full control — edit, cancel, assign roles',
  co_planner: 'Can edit details, cannot cancel',
  treasurer: 'Manages bill split and payment tracking',
  hype_person: 'Nudges people to RSVP and show up',
  ride_coordinator: 'Shares the rideshare link and coordinates pickups',
  table_booker: 'Holds the reservation and restaurant contact',
  food_orderer: 'Manages pre-order and dietary collection',
  photographer: 'Expected to post to Memories after',
  playlist_curator: 'Controls the vibe going in',
}

const ROLE_ICON_MAP: Record<HangoutRoleType, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  master_planner: Crown,
  co_planner: Star,
  treasurer: Wallet,
  hype_person: Zap,
  ride_coordinator: Car,
  table_booker: CalendarCheck,
  food_orderer: UtensilsCrossed,
  photographer: Camera,
  playlist_curator: Music,
}

const ROLE_STYLES: Record<HangoutRoleType, { active: string; activeText: string; activeBorder: string }> = {
  master_planner:   { active: 'rgba(234,179,8,0.1)',  activeText: '#EAB308', activeBorder: 'rgba(234,179,8,0.4)' },
  co_planner:       { active: 'rgba(234,179,8,0.07)', activeText: '#EAB308', activeBorder: 'rgba(234,179,8,0.25)' },
  treasurer:        { active: 'rgba(90,107,42,0.1)',  activeText: '#7A9A3A', activeBorder: 'rgba(90,107,42,0.3)' },
  hype_person:      { active: 'rgba(234,179,8,0.1)',  activeText: '#EAB308', activeBorder: 'rgba(234,179,8,0.3)' },
  ride_coordinator: { active: 'rgba(148,163,184,0.1)', activeText: '#94A3B8', activeBorder: 'rgba(148,163,184,0.3)' },
  table_booker:     { active: 'rgba(148,163,184,0.1)', activeText: '#94A3B8', activeBorder: 'rgba(148,163,184,0.3)' },
  food_orderer:     { active: 'rgba(148,163,184,0.1)', activeText: '#94A3B8', activeBorder: 'rgba(148,163,184,0.3)' },
  photographer:     { active: 'rgba(148,163,184,0.1)', activeText: '#94A3B8', activeBorder: 'rgba(148,163,184,0.3)' },
  playlist_curator: { active: 'rgba(148,163,184,0.1)', activeText: '#94A3B8', activeBorder: 'rgba(148,163,184,0.3)' },
}

export function RoleAssignSheet({
  hangoutId,
  member,
  currentRoles,
  onClose,
  onRolesUpdated,
}: RoleAssignSheetProps) {
  const [loading, setLoading] = useState<HangoutRoleType | null>(null)

  async function toggleRole(role: HangoutRoleType) {
    if (role === 'master_planner') return
    const hasRole = currentRoles.includes(role)
    setLoading(role)
    try {
      if (hasRole) {
        await supabase
          .from('hangout_member_roles')
          .delete()
          .eq('hangout_id', hangoutId)
          .eq('user_id', member.user_id)
          .eq('role', role)
        onRolesUpdated()
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase
          .from('hangout_member_roles')
          .insert({
            hangout_id: hangoutId,
            user_id: member.user_id,
            role,
            assigned_by: user?.id ?? null,
          })
        onRolesUpdated(role)
      }
    } catch (err) {
      console.error('Role toggle error:', err)
    } finally {
      setLoading(null)
    }
  }

  const renderRoleRow = (role: HangoutRoleType) => {
    const Icon = ROLE_ICON_MAP[role]
    const active = currentRoles.includes(role)
    const isLoading = loading === role
    const locked = role === 'master_planner'
    const styles = ROLE_STYLES[role]

    return (
      <button
        key={role}
        onClick={() => toggleRole(role)}
        disabled={isLoading || locked}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderRadius: 12,
          border: active ? `1.5px solid ${styles.activeBorder}` : '1.5px solid var(--border)',
          background: active ? styles.active : 'var(--bg3)',
          cursor: locked ? 'default' : 'pointer',
          opacity: locked ? 0.5 : 1,
          textAlign: 'left',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon size={16} strokeWidth={2} color={active ? styles.activeText : 'var(--text3)'} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{ROLE_LABELS[role]}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{ROLE_DESCRIPTIONS[role]}</div>
          </div>
        </div>
        {active && <Check size={16} color={styles.activeText} strokeWidth={2.5} />}
      </button>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'var(--bg2)', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {member.avatar_url
              ? <img src={member.avatar_url} alt={member.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111', fontWeight: 700, fontSize: 14 }}>{member.name[0]?.toUpperCase()}</div>
            }
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{member.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Assign roles for this hangout</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={20} color="var(--text3)" />
          </button>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Authority Roles</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{STRUCTURAL_ROLES.map(renderRoleRow)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Task Roles</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{TASK_ROLES.map(renderRoleRow)}</div>
        </div>
      </div>
    </div>
  )
}
