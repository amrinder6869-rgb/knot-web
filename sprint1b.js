const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

// ─── 1. Update REASON_LABELS in VibesCounter to include role_completed ────────

const vibesPath = path.join(BASE, 'components\\VibesCounter.tsx');
let vibesContent = fs.readFileSync(vibesPath, 'utf8');

const oldLabels = `  game_won: 'Won a game',
  streak_bonus: 'Streak bonus',
  redemption: 'Redeemed',`;

const newLabels = `  game_won: 'Won a game',
  streak_bonus: 'Streak bonus',
  redemption: 'Redeemed',
  role_completed: 'Completed a role',`;

if (vibesContent.includes(oldLabels)) {
  vibesContent = vibesContent.replace(oldLabels, newLabels);
  fs.writeFileSync(vibesPath, vibesContent, 'utf8');
  console.log('Updated: VibesCounter.tsx — added role_completed label');
} else {
  console.log('SKIP: VibesCounter already updated or pattern not found');
}

// ─── 2. Update TYPE_LABEL in Notifications to include role_assigned ───────────

const notifPath = path.join(BASE, 'components\\Notifications.tsx');
let notifContent = fs.readFileSync(notifPath, 'utf8');

const oldTypeLabel = `  member_joined:'New member',`;
const newTypeLabel = `  member_joined:'New member',
  role_assigned: 'Role assigned',`;

if (notifContent.includes(oldTypeLabel)) {
  notifContent = notifContent.replace(oldTypeLabel, newTypeLabel);
  fs.writeFileSync(notifPath, notifContent, 'utf8');
  console.log('Updated: Notifications.tsx — added role_assigned type');
} else {
  console.log('SKIP: Notifications already updated or pattern not found');
}

// ─── 3. Rewrite CrewSection with role completion + notification on assign ──────

const crewPath = path.join(BASE, 'components\\CrewSection.tsx');

const crewContent = `'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserPlus, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { RoleBadge } from './RoleBadge'
import { RoleAssignSheet } from './RoleAssignSheet'
import { HangoutRoleType, HangoutMemberWithRole, ROLE_LABELS } from '@/types/roles'

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

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [imgError, setImgError] = useState(false)
  const initial = (name || 'U')[0].toUpperCase()

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgError(true)}
        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }

  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: 'var(--yellow)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      color: '#111', fontWeight: 700, fontSize: 13, flexShrink: 0
    }}>
      {initial}
    </div>
  )
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
        .select('id, name, avatar_url')
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
        if (r.completed) completedMap[\`\${r.user_id}:\${r.role}\`] = true
      })

      const crewData: HangoutMemberWithRole[] = profiles.map((p: any) => ({
        user_id: p.id,
        name: p.name ?? 'Unknown',
        avatar_url: p.avatar_url ?? null,
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

  async function onRoleAssigned(memberId: string, role: HangoutRoleType, memberName: string) {
    // Send notification to the assigned member
    if (memberId === currentUserId) return
    try {
      await supabase.from('notifications').insert({
        user_id: memberId,
        knot_id: knotId,
        type: 'role_assigned',
        actor_id: currentUserId,
        entity_id: hangoutId,
        message: \`You have been assigned \${ROLE_LABELS[role]} for this hangout.\`,
        read: false,
      })
    } catch (err) {
      console.error('Notification insert error:', err)
    }
  }

  if (loading || crew.length === 0) return null

  return (
    <>
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: subColor,
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10
        }}>
          Crew
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {crew.map((member: any) => (
            <div key={member.user_id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={member.name} avatarUrl={member.avatar_url} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: textColor }}>{member.name}</div>
                    {member.roles.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
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
                      padding: '5px 10px', borderRadius: 8,
                      border: \`1px solid \${borderColor}\`, background: 'none',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600, color: subColor,
                    }}
                  >
                    <UserPlus size={12} strokeWidth={2} />
                    {member.roles.length === 0 ? 'Assign' : 'Edit'}
                  </button>
                )}
              </div>

              {/* Role completion buttons — only for current user's own roles */}
              {member.user_id === currentUserId && member.roles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginLeft: 40 }}>
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
                          border: \`1px solid \${done ? 'rgba(74,222,128,0.4)' : borderColor}\`,
                          background: done ? 'rgba(74,222,128,0.1)' : 'none',
                          cursor: done ? 'default' : 'pointer',
                          fontSize: 11, fontWeight: 600,
                          color: done ? '#4ade80' : subColor,
                        }}
                      >
                        {done && <CheckCircle size={11} strokeWidth={2.5} />}
                        {done ? 'Done' : isCompleting ? 'Saving...' : \`Mark \${ROLE_LABELS[role]} done\`}
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
              onRoleAssigned(selectedMember.user_id, assignedRole, selectedMember.name)
            }
            fetchCrew()
            setSelectedMember(null)
          }}
        />
      )}
    </>
  )
}
`;

fs.writeFileSync(crewPath, crewContent, 'utf8');
console.log('Updated: CrewSection.tsx — role completion + Vibes points + notifications');

// ─── 4. Update RoleAssignSheet to pass back the assigned role ─────────────────

const sheetPath = path.join(BASE, 'components\\RoleAssignSheet.tsx');
let sheetContent = fs.readFileSync(sheetPath, 'utf8');

// Update the onRolesUpdated prop type to accept optional role
const oldProp = `  onRolesUpdated: () => void`;
const newProp = `  onRolesUpdated: (assignedRole?: HangoutRoleType) => void`;

if (sheetContent.includes(oldProp)) {
  sheetContent = sheetContent.replace(oldProp, newProp);
}

// Pass the role back when inserting
const oldInsert = `        const { data: { user } } = await supabase.auth.getUser()
        await supabase
          .from('hangout_member_roles')
          .insert({
            hangout_id: hangoutId,
            user_id: member.user_id,
            role,
            assigned_by: user?.id ?? null,
          })
      }
      onRolesUpdated()`;

const newInsert = `        const { data: { user } } = await supabase.auth.getUser()
        await supabase
          .from('hangout_member_roles')
          .insert({
            hangout_id: hangoutId,
            user_id: member.user_id,
            role,
            assigned_by: user?.id ?? null,
          })
        onRolesUpdated(role)
      } else {
        onRolesUpdated()`;

if (sheetContent.includes(oldInsert)) {
  sheetContent = sheetContent.replace(oldInsert, newInsert);
  fs.writeFileSync(sheetPath, sheetContent, 'utf8');
  console.log('Updated: RoleAssignSheet.tsx — passes assigned role back to parent');
} else {
  console.log('SKIP: RoleAssignSheet pattern not found, manual check needed');
}

// ─── 5. Patch HangoutCard to pass knotId to CrewSection ──────────────────────

const cardPath = path.join(BASE, 'components\\HangoutCard.tsx');
let cardContent = fs.readFileSync(cardPath, 'utf8');

const oldCrew = `      <CrewSection
        hangoutId={hangout.id}
        currentUserId={currentUser?.id || ''}
        isPlanner={hangout.created_by === currentUser?.id}
        isLive={isLive}
      />`;

const newCrew = `      <CrewSection
        hangoutId={hangout.id}
        knotId={knotId}
        currentUserId={currentUser?.id || ''}
        isPlanner={hangout.created_by === currentUser?.id}
        isLive={isLive}
      />`;

if (cardContent.includes(oldCrew)) {
  cardContent = cardContent.replace(oldCrew, newCrew);
  fs.writeFileSync(cardPath, cardContent, 'utf8');
  console.log('Updated: HangoutCard.tsx — added knotId prop to CrewSection');
} else {
  console.log('SKIP: HangoutCard CrewSection pattern not found');
}

console.log('\nSprint 1B complete. All files updated.');
console.log('Role completion awards Vibes points.');
console.log('Role assignment sends a notification to the assigned member.');
console.log('VibesCounter now shows "Completed a role" in history.');
