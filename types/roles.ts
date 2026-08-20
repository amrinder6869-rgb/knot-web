// Hangout role types — mirrors hangout_role_type enum in Supabase

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
  username: string | null
  roles: HangoutRoleType[]
  completedRoles?: HangoutRoleType[]
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
