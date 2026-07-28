const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

// ─── 1. types/roles.ts ───────────────────────────────────────────────────────

const rolesTypes = `// Hangout role types — mirrors hangout_role_type enum in Supabase

export type HangoutRoleType =
  | 'master_planner'
  | 'co_planner'
  | 'treasurer'
  | 'hype_person'
  | 'ride_coordinator'
  | 'table_booker'
  | 'food_orderer'
  | 'photographer'
  | 'playlist_curator'

export interface HangoutMemberRole {
  id: string
  hangout_id: string
  user_id: string
  role: HangoutRoleType
  assigned_by: string | null
  assigned_at: string
  completed: boolean
  completed_at: string | null
}

export interface HangoutMemberWithRole {
  user_id: string
  name: string
  avatar_url: string | null
  roles: HangoutRoleType[]
}

export const ROLE_LABELS: Record<HangoutRoleType, string> = {
  master_planner: 'Master Planner',
  co_planner: 'Co-Planner',
  treasurer: 'Treasurer',
  hype_person: 'Hype Person',
  ride_coordinator: 'Ride Coord',
  table_booker: 'Table Booker',
  food_orderer: 'Food Orderer',
  photographer: 'Photographer',
  playlist_curator: 'Playlist',
}

// Structural roles that define authority
export const STRUCTURAL_ROLES: HangoutRoleType[] = [
  'master_planner',
  'co_planner',
  'treasurer',
  'hype_person',
]

// Task roles — hangout-specific responsibilities
export const TASK_ROLES: HangoutRoleType[] = [
  'ride_coordinator',
  'table_booker',
  'food_orderer',
  'photographer',
  'playlist_curator',
]
`;

// ─── 2. components/RoleBadge.tsx ─────────────────────────────────────────────

const roleBadge = `'use client'

import {
  Crown, Star, Wallet, Zap, Car,
  CalendarCheck, UtensilsCrossed, Camera, Music
} from 'lucide-react'
import { HangoutRoleType, ROLE_LABELS } from '@/types/roles'

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

const ROLE_COLORS: Record<HangoutRoleType, { bg: string; text: string; border: string }> = {
  master_planner: { bg: 'rgba(var(--primary-rgb, 34 197 94), 0.15)', text: 'var(--primary)', border: 'rgba(var(--primary-rgb, 34 197 94), 0.3)' },
  co_planner: { bg: 'rgba(var(--primary-rgb, 34 197 94), 0.08)', text: 'var(--primary)', border: 'rgba(var(--primary-rgb, 34 197 94), 0.2)' },
  treasurer: { bg: 'rgba(90, 107, 42, 0.12)', text: '#5A6B2A', border: 'rgba(90, 107, 42, 0.25)' },
  hype_person: { bg: 'rgba(234, 179, 8, 0.15)', text: '#CA8A04', border: 'rgba(234, 179, 8, 0.3)' },
  ride_coordinator: { bg: 'rgba(100, 116, 139, 0.1)', text: 'var(--text-2)', border: 'rgba(100, 116, 139, 0.2)' },
  table_booker: { bg: 'rgba(100, 116, 139, 0.1)', text: 'var(--text-2)', border: 'rgba(100, 116, 139, 0.2)' },
  food_orderer: { bg: 'rgba(100, 116, 139, 0.1)', text: 'var(--text-2)', border: 'rgba(100, 116, 139, 0.2)' },
  photographer: { bg: 'rgba(100, 116, 139, 0.1)', text: 'var(--text-2)', border: 'rgba(100, 116, 139, 0.2)' },
  playlist_curator: { bg: 'rgba(100, 116, 139, 0.1)', text: 'var(--text-2)', border: 'rgba(100, 116, 139, 0.2)' },
}

interface RoleBadgeProps {
  role: HangoutRoleType
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export function RoleBadge({ role, size = 'sm', showLabel = true }: RoleBadgeProps) {
  const Icon = ROLE_ICON_MAP[role]
  const colors = ROLE_COLORS[role]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: size === 'sm' ? '2px 6px' : '3px 8px',
        borderRadius: '999px',
        background: colors.bg,
        border: \`1px solid \${colors.border}\`,
        fontSize: size === 'sm' ? '10px' : '11px',
        fontWeight: 600,
        color: colors.text,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={size === 'sm' ? 10 : 12} strokeWidth={2.5} />
      {showLabel && ROLE_LABELS[role]}
    </span>
  )
}
`;

// ─── 3. components/RoleAssignSheet.tsx ───────────────────────────────────────

const roleAssignSheet = `'use client'

import { useState } from 'react'
import {
  Crown, Star, Wallet, Zap, Car,
  CalendarCheck, UtensilsCrossed, Camera, Music, X, Check
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
  onRolesUpdated: () => void
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

export function RoleAssignSheet({
  hangoutId,
  member,
  currentRoles,
  onClose,
  onRolesUpdated,
}: RoleAssignSheetProps) {
  const [loading, setLoading] = useState<HangoutRoleType | null>(null)
  const supabase = createClient()

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
      }
      onRolesUpdated()
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
          border: active ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
          background: active ? 'rgba(var(--primary-rgb, 34 197 94), 0.06)' : 'var(--surface-2, #1a1a1a)',
          cursor: locked ? 'default' : 'pointer',
          opacity: locked ? 0.5 : 1,
          textAlign: 'left',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon size={16} strokeWidth={2} color={active ? 'var(--primary)' : 'var(--text-2)'} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{ROLE_LABELS[role]}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1 }}>{ROLE_DESCRIPTIONS[role]}</div>
          </div>
        </div>
        {active && <Check size={16} color="var(--primary)" strokeWidth={2.5} />}
      </button>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {member.avatar_url
              ? <img src={member.avatar_url} alt={member.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>{member.name[0]?.toUpperCase()}</div>
            }
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{member.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Assign roles for this hangout</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={20} color="var(--text-2)" />
          </button>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Authority Roles</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{STRUCTURAL_ROLES.map(renderRoleRow)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Task Roles</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{TASK_ROLES.map(renderRoleRow)}</div>
        </div>
      </div>
    </div>
  )
}
`;

// ─── 4. components/CrewSection.tsx ───────────────────────────────────────────

const crewSection = `'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RoleBadge } from './RoleBadge'
import { RoleAssignSheet } from './RoleAssignSheet'
import { HangoutRoleType, HangoutMemberWithRole } from '@/types/roles'

interface CrewSectionProps {
  hangoutId: string
  currentUserId: string
  isPlanner: boolean
}

export function CrewSection({ hangoutId, currentUserId, isPlanner }: CrewSectionProps) {
  const [crew, setCrew] = useState<HangoutMemberWithRole[]>([])
  const [selectedMember, setSelectedMember] = useState<HangoutMemberWithRole | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchCrew = useCallback(async () => {
    const { data: rsvps } = await supabase
      .from('hangout_rsvps')
      .select('user_id, profiles(id, name, avatar_url)')
      .eq('hangout_id', hangoutId)

    const { data: roles } = await supabase
      .from('hangout_member_roles')
      .select('user_id, role')
      .eq('hangout_id', hangoutId)

    if (!rsvps) { setLoading(false); return }

    const roleMap: Record<string, HangoutRoleType[]> = {}
    roles?.forEach((r: any) => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = []
      roleMap[r.user_id].push(r.role as HangoutRoleType)
    })

    const crewData: HangoutMemberWithRole[] = rsvps.map((r: any) => ({
      user_id: r.user_id,
      name: r.profiles?.name ?? 'Unknown',
      avatar_url: r.profiles?.avatar_url ?? null,
      roles: roleMap[r.user_id] ?? [],
    }))

    crewData.sort((a, b) => {
      const score = (m: HangoutMemberWithRole) =>
        m.roles.includes('master_planner') ? 2 : m.roles.includes('co_planner') ? 1 : 0
      return score(b) - score(a)
    })

    setCrew(crewData)
    setLoading(false)
  }, [hangoutId, supabase])

  useEffect(() => { fetchCrew() }, [fetchCrew])

  if (loading || crew.length === 0) return null

  return (
    <>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          Crew
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {crew.map(member => (
            <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {member.avatar_url
                  ? <img src={member.avatar_url} alt={member.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>{member.name[0]?.toUpperCase()}</div>
                }
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{member.name}</div>
                  {member.roles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                      {member.roles.map(role => <RoleBadge key={role} role={role} size="sm" />)}
                    </div>
                  )}
                </div>
              </div>
              {isPlanner && member.user_id !== currentUserId && (
                <button
                  onClick={() => setSelectedMember(member)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'none',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
                  }}
                >
                  <UserPlus size={12} strokeWidth={2} />
                  {member.roles.length === 0 ? 'Assign' : 'Edit'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedMember && (
        <RoleAssignSheet
          hangoutId={hangoutId}
          member={selectedMember}
          currentRoles={selectedMember.roles}
          onClose={() => setSelectedMember(null)}
          onRolesUpdated={() => { fetchCrew(); setSelectedMember(null) }}
        />
      )}
    </>
  )
}
`;

// ─── Write all files ──────────────────────────────────────────────────────────

const files = [
  { dir: 'types', name: 'roles.ts', content: rolesTypes },
  { dir: 'components', name: 'RoleBadge.tsx', content: roleBadge },
  { dir: 'components', name: 'RoleAssignSheet.tsx', content: roleAssignSheet },
  { dir: 'components', name: 'CrewSection.tsx', content: crewSection },
];

files.forEach(({ dir, name, content }) => {
  const dirPath = path.join(BASE, dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  const filePath = path.join(dirPath, name);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Created: ${dir}/${name}`);
});

console.log('\nSprint 1A files created successfully.');
console.log('\nNext step: open HangoutCard.tsx and add <CrewSection> inside the card body.');
console.log('Import it with: import { CrewSection } from "./CrewSection"');
console.log('Then add inside the card, below the RSVP section:');
console.log('  <CrewSection');
console.log('    hangoutId={hangout.id}');
console.log('    currentUserId={currentUserId}');
console.log('    isPlanner={hangout.created_by === currentUserId}');
console.log('  />');
