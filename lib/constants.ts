export const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'halal', label: 'Halal' },
  { id: 'kosher', label: 'Kosher' },
  { id: 'gluten-free', label: 'Gluten-free' },
  { id: 'nut allergy', label: 'Nut allergy' },
  { id: 'dairy-free', label: 'Dairy-free' },
  { id: 'other', label: 'Other' },
]

export const ACCESSIBILITY_OPTIONS = [
  { id: 'wheelchair-access', label: 'Wheelchair access' },
  { id: 'step-free-entry', label: 'Step-free entry' },
  { id: 'accessible-parking', label: 'Accessible parking' },
  { id: 'hearing-loop', label: 'Hearing loop' },
]

export const EVENT_RESTRICTION_OPTIONS = [
  { id: 'female-only', label: 'Female only' },
  { id: 'male-only', label: 'Male only' },
  { id: 'adults-only', label: 'Adults only' },
  { id: 'kids-welcome', label: 'Kids welcome' },
  { id: 'couples-only', label: 'Couples only' },
]

export const ACTIVITY_ICONS: Record<string, string> = {
  birthday: 'ti-cake',
  surprise_birthday: 'ti-cake',
  movies: 'ti-movie',
  movie: 'ti-movie',
  cinema: 'ti-movie',
  drinks: 'ti-glass-full',
  dinner: 'ti-tools-kitchen-2',
  brunch: 'ti-tools-kitchen-2',
  breakfast: 'ti-tools-kitchen-2',
  lunch: 'ti-tools-kitchen-2',
  coffee: 'ti-coffee',
  hike: 'ti-mountain',
  hiking: 'ti-mountain',
  concert: 'ti-music',
  music: 'ti-music',
  gaming: 'ti-device-gamepad-2',
  games: 'ti-device-gamepad-2',
  study: 'ti-book',
  party: 'ti-confetti',
  foodie: 'ti-tools-kitchen-2',
  chill: 'ti-sofa',
  culture: 'ti-masks-theater',
  outdoors: 'ti-tree',
  active: 'ti-run',
  online: 'ti-video',
  sports: 'ti-ball-football',
  planned: 'ti-calendar-event',
  spontaneous: 'ti-bolt',
  recurring: 'ti-repeat',
  live: 'ti-flame',
}

// Tabler Icons (ti ti-* classes) are the only icon system in this codebase —
// see AGENTS.md icon audit notes. These are the only sizes used anywhere.
export const ICON_SIZE = {
  nav: 20,
  card: 16,
  inline: 14,
  header: 22,
  input: 16,
} as const

export const KNOT_ICONS: { id: string; icon: string; label: string; color: string; bg: string }[] = [
  { id: 'ti-users',              label: 'Friends',   icon: 'ti-users',              color: '#b38c00', bg: 'rgba(248,189,3,0.12)' },
  { id: 'ti-music',              label: 'Music',     icon: 'ti-music',              color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  { id: 'ti-device-gamepad-2',   label: 'Gaming',    icon: 'ti-device-gamepad-2',   color: '#1d4ed8', bg: 'rgba(29,78,216,0.1)' },
  { id: 'ti-ball-football',      label: 'Sports',    icon: 'ti-ball-football',      color: '#15803d', bg: 'rgba(21,128,61,0.1)' },
  { id: 'ti-plane',              label: 'Travel',    icon: 'ti-plane',              color: '#0369a1', bg: 'rgba(3,105,161,0.1)' },
  { id: 'ti-glass-full',         label: 'Food',      icon: 'ti-glass-full',         color: '#c2410c', bg: 'rgba(194,65,12,0.1)' },
  { id: 'ti-mountain',           label: 'Outdoors',  icon: 'ti-mountain',           color: '#166534', bg: 'rgba(22,101,52,0.1)' },
  { id: 'ti-briefcase',          label: 'Work',      icon: 'ti-briefcase',          color: '#475569', bg: 'rgba(71,85,105,0.1)' },
  { id: 'ti-heart',              label: 'Family',    icon: 'ti-heart',              color: '#be123c', bg: 'rgba(190,18,60,0.1)' },
  { id: 'ti-camera',             label: 'Photos',    icon: 'ti-camera',             color: '#0f766e', bg: 'rgba(15,118,110,0.1)' },
  { id: 'ti-book',               label: 'Study',     icon: 'ti-book',               color: '#7c2d12', bg: 'rgba(124,45,18,0.1)' },
  { id: 'ti-link',               label: 'General',   icon: 'ti-link',               color: '#111',    bg: 'rgba(0,0,0,0.08)' },
]

export const DEFAULT_KNOT_ICON = 'ti-link'

export function getKnotIcon(value: string | null | undefined) {
  if (!value) return KNOT_ICONS.find(k => k.id === DEFAULT_KNOT_ICON)!
  // Support legacy emoji values — fall back to default
  const found = KNOT_ICONS.find(k => k.id === value)
  return found ?? KNOT_ICONS.find(k => k.id === DEFAULT_KNOT_ICON)!
}

export const PUSH_TITLES: Record<string, string> = {
  new_moment: 'New moment',
  bill_reminder: 'Bill reminder',
  follow_request: 'New follower',
  rsvp_momentum: 'Who is in?',
  hangout_confirmed: 'Plan locked',
  hangout_live: 'It is go time',
  hangout_thread_message: 'New message',
  new_hangout: 'New plan',
  new_poll: 'New poll',
}
