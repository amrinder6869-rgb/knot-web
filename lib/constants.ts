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
