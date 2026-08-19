export function getRandom<T>(arr: T[], rareArr?: T[]): T {
  if (rareArr && Math.random() < 0.08) {
    return rareArr[Math.floor(Math.random() * rareArr.length)]
  }
  return arr[Math.floor(Math.random() * arr.length)]
}

export const LOADING = {
  members: { pool: ['Gathering the crew.', 'Roll call.', 'Seeing who is around.'], rare: ['Still waiting on the one who said five minutes.'] },
  venues: { pool: ['Finding the move.', 'Looking around.', 'Scouting it out.'], rare: ["Choosing a restaurant: humanity's hardest problem."] },
  bills: { pool: ['Running the numbers.', 'Doing the math so you don\'t have to.'], rare: ['Friendship test incoming.'] },
  memories: { pool: ['Digging through the lore.', 'Pulling up the archive.'] },
  generic: { pool: ['Give us a sec.', 'Working on it.', 'On it.', 'This will be quick.', 'Brb.'], rare: ['Nobody panic. We are loading.'] },
}

export const EMPTY = {
  KNOTS: 'Your circle does not exist yet. Make one.',
  HANGOUTS: 'Weekend looking suspiciously empty.',
  MEMORIES: 'Future nostalgia goes here.',
  BILLS: 'Financial peace.',
  FEED: 'Group chat is asleep.',
  DISCOVER: 'Nothing matched. Try a different vibe.',
  GAMES: 'Too peaceful in here.',
}

export const TOAST = {
  HANGOUT_CREATED: 'Plan is up. See who is in.',
  RSVP_GOING: 'Bet.',
  RSVP_MAYBE: 'We will take it.',
  RSVP_OUT: 'Rain check.',
  BILL_ADDED: 'Added to the tab.',
  BILL_SETTLED: 'Financial peace.',
  MOMENT_POSTED: 'Canon.',
  HANGOUT_CONFIRMED: 'Locked.',
  HANGOUT_LIVE: 'It is go time.',
  HANGOUT_ENDED: 'That is a wrap.',
  MEMBER_REMOVED: 'Member removed.',
  KNOT_DELETED: 'Circle closed.',
  ERROR: 'That was not supposed to happen.',
}

export const CONFIRM = {
  DELETE_KNOT: 'Close this circle? Everything inside disappears. This cannot be undone.',
  LEAVE_KNOT: 'Leave this circle? You will need a new invite to come back.',
  DELETE_MOMENT: 'Delete this? It is gone for everyone.',
}

export const VIBES_MILESTONE = {
  FIRST_HANGOUT: 'We outside.',
  ATTENDING: 'Showing up counts.',
  SETTLED_BILL: 'Math survived.',
  WON_GAME: 'Deserved.',
  POSTED_MOMENT: 'Canon.',
  STREAK: 'Consistently outside.',
  VIBES_100: 'You are kinda carrying.',
  VIBES_1000: 'Touch grass.',
}

export const COMPOSER_PLACEHOLDER = [
  'What is the plan?',
  'What is happening?',
  'Drop a moment.',
  'What are we doing?',
]

export const ONBOARDING = {
  EMPTY: 'Nobody knows about this yet. Start a circle.',
}
