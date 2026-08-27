'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserPlus, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { RoleBadge } from './RoleBadge'
import { RoleAssignSheet } from './RoleAssignSheet'
import { HangoutRoleType, HangoutMemberWithRole, ROLE_LABELS } from '@/types/roles'
import MemberAvatar from '@/components/MemberAvatar'

interface CrewSectionProps {
  hangoutId: string
  knotId: string
  currentUserId: string
  isPlanner: boolean
  isLive?: boolean
}

const ROLE_POINTS: Record<HangoutRoleType, number> = {
  master_planner:   20,
  co_planner:       15,
  treasurer:        15,
  hype_person:      10,
  ride_coordinator: 10,
  table_booker:     10,
  food_orderer:     10,
  photographer:     15,
  playlist_curator:  5,
}

export function CrewSection({ hangoutId, knotId, currentUserId, isPlanner, isLive = false }: CrewSectionProps) {
  const [crew, setCrew] = useState<HangoutMemberWithRole[]>([])
  const [selectedMember, setSelectedMember] = useState<HangoutMemberWithRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [completingRole, setCompletingRole] = useState<string | null>(null)

  const textColor = isLive ? 'rgba(255,255,255,0.9)' : 'var(--text)'
  const subColor  = isLive ? 'rgba(255,255,255,0.45)' : 'var(--text3)'
  const borderColor = isLive ? 'rgba(255,255,255,0.15)' : 'var(--border)'

  const fetchCrew = useCallback(async () => {
    try {
      const { data: rsvps } = await supabase
        .from('hangout_rsvps')
        .select('user_id')
        .eq('hangout_id', hangoutId)

      if (!rsvps || rsvps.length === 0) { setLoading(false); return }

      const userIds = rsvps.map((r: any) => r.user_id)

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, username')
        .in('id', userIds)

      if (!profiles) { setLoading(false); return }

      const { data: roles } = await supabase
        .from('hangout_member_roles')
        .select('user_id, role, completed, id')
        .eq('hangout_id', hangoutId)

      const roleMap: Record<string, HangoutRoleType[]> = {}
      const completedMap: Record<string, boolean> = {}

      roles?.forEach((r: any) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = []
        roleMap[r.user_id].push(r.role as HangoutRoleType)
        if (r.completed) completedMap[`${r.user_id}:${r.role}`] = true
      })

      const crewData: HangoutMemberWithRole[] = profiles.map((p: any) => ({
        user_id: p.id,
        name: p.name ?? 'Unknown',
        avatar_url: p.avatar_url ?? null,
        username: p.username ?? null,
        roles: roleMap[p.id] ?? [],
        completedRoles: Object.keys(completedMap)
          .filter(k => k.startsWith(p.id + ':'))
          .map(k => k.split(':')[1] as HangoutRoleType),
      }))

      crewData.sort((a, b) => {
        const score = (m: any) =>
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

  async function completeRole(member: any, role: HangoutRoleType) {
    if (member.user_id !== currentUserId) return
    setCompletingRole(role)

    try {
      // Mark role as completed
      const { error } = await supabase
        .from('hangout_member_roles')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('hangout_id', hangoutId)
        .eq('user_id', currentUserId)
        .eq('role', role)

      if (error) { console.error('Role complete error:', error); return }

      // Award Vibes points
      const points = ROLE_POINTS[role] ?? 10
      await supabase.from('point_transactions').insert({
        user_id: currentUserId,
        knot_id: knotId,
        amount: points,
        reason: 'role_completed',
        reference_id: hangoutId,
      })

      fetchCrew()
    } catch (err) {
      console.error('completeRole error:', err)
    } finally {
      setCompletingRole(null)
    }
  }

  async function onRoleAssigned(memberId: string, role: HangoutRoleType) {
    // Send notification to the assigned member
    if (memberId === currentUserId) return
    try {
      await supabase.from('notifications').insert({
        user_id: memberId,
        knot_id: knotId,
        type: 'role_assigned',
        actor_id: currentUserId,
        entity_id: hangoutId,
        message: `You have been assigned ${ROLE_LABELS[role]} for this hangout.`,
        read: false,
      })
    } catch (err) {
      console.error('Notification insert error:', err)
    }
  }

  if (loading || crew.length === 0) return null

  return (
    <>
      <div style={{ marginTop: 10, marginBottom: 10 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: subColor,
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6
        }}>
          Crew
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {crew.map((member: any) => (
            <div key={member.user_id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <MemberAvatar name={member.name} avatarUrl={member.avatar_url} size={24} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                    {member.username ? (
                      <a href={`/${member.username}`} style={{ fontSize: 11, fontWeight: 600, color: textColor, textDecoration: 'none' }}>{member.name}</a>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>{member.name}</span>
                    )}
                    {member.roles.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {member.roles.map((role: HangoutRoleType) => (
                          <RoleBadge key={role} role={role} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {isPlanner && member.user_id !== currentUserId && (
                  <button
                    onClick={() => setSelectedMember(member)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 20,
                      border: 'none', background: 'none',
                      cursor: 'pointer', fontSize: 11, fontWeight: 600, color: subColor,
                    }}
                  >
                    <UserPlus size={11} strokeWidth={2} />
                    {member.roles.length === 0 ? 'Assign' : 'Edit'}
                  </button>
                )}
              </div>

              {/* Role completion buttons — only for current user's own roles */}
              {member.user_id === currentUserId && member.roles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5, marginLeft: 30 }}>
                  {member.roles.map((role: HangoutRoleType) => {
                    const done = member.completedRoles?.includes(role)
                    const isCompleting = completingRole === role
                    return (
                      <button
                        key={role}
                        onClick={() => !done && completeRole(member, role)}
                        disabled={done || isCompleting}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '4px 10px', borderRadius: 20,
                          border: `1px solid ${done ? 'rgba(74,222,128,0.4)' : borderColor}`,
                          background: done ? 'rgba(74,222,128,0.1)' : 'none',
                          cursor: done ? 'default' : 'pointer',
                          fontSize: 11, fontWeight: 600,
                          color: done ? '#4ade80' : subColor,
                        }}
                      >
                        {done && <CheckCircle size={11} strokeWidth={2.5} />}
                        {done ? 'Done' : isCompleting ? 'Saving...' : `Mark ${ROLE_LABELS[role]} done`}
                      </button>
                    )
                  })}
                </div>
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
          onRolesUpdated={(assignedRole?: HangoutRoleType) => {
            if (assignedRole) {
              onRoleAssigned(selectedMember.user_id, assignedRole)
            }
            fetchCrew()
            setSelectedMember(null)
          }}
        />
      )}
    </>
  )
}
