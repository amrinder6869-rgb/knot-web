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
