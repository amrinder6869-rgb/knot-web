const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\CrewSection.tsx');

const content = `'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
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

  const fetchCrew = useCallback(async () => {
    try {
      // Fetch RSVPs
      const { data: rsvps, error: rsvpError } = await supabase
        .from('hangout_rsvps')
        .select('user_id')
        .eq('hangout_id', hangoutId)

      if (rsvpError || !rsvps || rsvps.length === 0) {
        setLoading(false)
        return
      }

      const userIds = rsvps.map((r: any) => r.user_id)

      // Fetch profiles for those users
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds)

      if (profileError || !profiles) {
        setLoading(false)
        return
      }

      // Fetch roles for this hangout
      const { data: roles } = await supabase
        .from('hangout_member_roles')
        .select('user_id, role')
        .eq('hangout_id', hangoutId)

      // Build role map
      const roleMap: Record<string, HangoutRoleType[]> = {}
      roles?.forEach((r: any) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = []
        roleMap[r.user_id].push(r.role as HangoutRoleType)
      })

      // Combine into crew
      const crewData: HangoutMemberWithRole[] = profiles.map((p: any) => ({
        user_id: p.id,
        name: p.name ?? 'Unknown',
        avatar_url: p.avatar_url ?? null,
        roles: roleMap[p.id] ?? [],
      }))

      // Sort: master_planner first, then co_planner, then others
      crewData.sort((a, b) => {
        const score = (m: HangoutMemberWithRole) =>
          m.roles.includes('master_planner') ? 2 : m.roles.includes('co_planner') ? 1 : 0
        return score(b) - score(a)
      })

      setCrew(crewData)
    } catch (err) {
      console.error('CrewSection fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [hangoutId])

  useEffect(() => { fetchCrew() }, [fetchCrew])

  if (loading || crew.length === 0) return null

  return (
    <>
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text3)',
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10
        }}>
          Crew
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {crew.map(member => (
            <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {member.avatar_url
                  ? <img src={member.avatar_url} alt={member.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--yellow)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: '#111', fontWeight: 700, fontSize: 13, flexShrink: 0
                    }}>
                      {member.name[0]?.toUpperCase()}
                    </div>
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
                    cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text3)',
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

fs.writeFileSync(filePath, content, 'utf8');
console.log('CrewSection.tsx rewritten with fixed query.');
