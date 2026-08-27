export function getRandom<T>(arr: T[], rareArr?: T[]): T {
  if (rareArr && Math.random() < 0.08) {
    return rareArr[Math.floor(Math.random() * rareArr.length)]
  }
  return arr[Math.floor(Math.random() * arr.length)]
}

// Draws from a single tagged pool: 9 in 10 calls pick a non-rare entry,
// 1 in 10 calls pick from the full pool (rare entries included).
type Tagged = { text: string; rare: boolean }
export function getRandomTagged(items: Tagged[]): string {
  const common = items.filter(i => !i.rare)
  const pool = (Math.random() < 0.1 || common.length === 0) ? items : common
  return pool[Math.floor(Math.random() * pool.length)].text
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
  NUDGED: 'Nudged.',
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

export const COMPOSER_RESOLVING = {
  pool: ['Figuring it out.', 'Reading the plan.', 'On it.', 'Working on it.'],
  rare: ['Give me a sec.'],
}

export const ONBOARDING = {
  EMPTY: 'Nobody knows about this yet. Start a circle.',
}

// ---------------------------------------------------------------------------
// Planning view additions — additive only. The nested exports above (LOADING,
// EMPTY, TOAST, CONFIRM, VIBES_MILESTONE) stay as-is since Composer.tsx,
// Feed.tsx, dashboard/page.tsx, BillSplit.tsx, Discover.tsx, MostLikelyTo.tsx,
// and Memories.tsx already depend on that shape. COMPOSER_RESOLVING above is
// also untouched (Composer.tsx uses its {pool,rare} shape) — the planning
// agent's resolving-state pool is named AGENT_RESOLVING_STATES instead, since
// it uses a different, single-array {text,rare} tagged shape via getRandomTagged.
// ---------------------------------------------------------------------------

export const AGENT_RESOLVING_STATES: { text: string; rare: boolean }[] = [
  { text: 'Figuring it out.', rare: false },
  { text: 'Reading the plan.', rare: false },
  { text: 'On it.', rare: false },
  { text: 'Give me a sec.', rare: true },
]

// Agent message pools — all agent chat messages drawn from these
export const AGENT_MESSAGES = {
  PLAN_CREATED: ['Plan started.', 'Added to the plan.', 'Got it.'],
  VENUE_CONFIRMED: ['On it.', 'Added.', 'Done.'],
  TIME_CONFIRMED: ['Locked.', 'Set.', 'Done.'],
  BILL_SPLIT_EQUAL: ['Split equally. Added to bills.', 'Done — added to bills.'],
  BILL_SPLIT_ITEMISED: ["Here's the breakdown. Tap your name on each item."],
  NUDGE_SENT: ['Nudged.', 'Done.'],
  LOCKED: ['Locked in.', "It's happening."],
  CONFLICT: ['Someone else just changed that. Take a look.'],
  REVENUE_RESTAURANT: ['Want me to grab a table?', 'I can sort the booking.'],
  REVENUE_TRANSPORT: ['Sort your ride?', 'Uber time?'],
  REVENUE_PRINTS: ['Order prints from tonight?'],
  BILL_REMINDER: ['Still a few bills outstanding.', 'Gentle reminder — bills are open.'],
  WELCOME: [
    'What are we doing?',
    "Let's figure something out.",
    "What's the plan?",
  ],
}

export const LOADING_MEMBERS: { text: string; rare: boolean }[] = [
  { text: 'Gathering the crew.', rare: false },
  { text: 'Roll call.', rare: false },
  { text: 'Seeing who is around.', rare: false },
  { text: 'Still waiting on the one who said five minutes.', rare: true },
]
export const LOADING_VENUES: { text: string; rare: boolean }[] = [
  { text: 'Finding the move.', rare: false },
  { text: 'Looking around.', rare: false },
  { text: 'Scouting it out.', rare: false },
  { text: "Choosing a restaurant: humanity's hardest problem.", rare: true },
]
export const LOADING_BILL_SPLIT: { text: string; rare: boolean }[] = [
  { text: 'Running the numbers.', rare: false },
  { text: "Doing the math so you don't have to.", rare: false },
  { text: 'Friendship test incoming.', rare: true },
]
export const LOADING_MEMORIES: { text: string; rare: boolean }[] = [
  { text: 'Digging through the lore.', rare: false },
  { text: 'Pulling up the archive.', rare: false },
]
export const LOADING_GENERIC: { text: string; rare: boolean }[] = [
  { text: 'Give us a sec.', rare: false },
  { text: 'Working on it.', rare: false },
  { text: 'On it.', rare: false },
  { text: 'This will be quick.', rare: false },
  { text: 'Nobody panic. We are loading.', rare: true },
]

export const EMPTY_KNOTS = 'Your circle does not exist yet. Make one.'
export const EMPTY_HANGOUTS = 'Weekend looking suspiciously empty.'
export const EMPTY_MEMORIES = 'Future nostalgia goes here.'
export const EMPTY_BILLS = 'Financial peace.'
export const EMPTY_FEED = 'Group chat is asleep.'
export const EMPTY_DISCOVER = 'Nothing matched. Try a different vibe.'
export const EMPTY_GAMES = 'Too peaceful in here.'
export const EMPTY_TODO = "You're all caught up."

export const TOAST_HANGOUT_CREATED = 'Plan is up. See who is in.'
export const TOAST_RSVP_GOING = 'Bet.'
export const TOAST_RSVP_MAYBE = 'We will take it.'
export const TOAST_RSVP_OUT = 'Rain check.'
export const TOAST_BILL_ADDED = 'Added to the tab.'
export const TOAST_BILL_SETTLED = 'Financial peace.'
export const TOAST_MOMENT_POSTED = 'Canon.'
export const TOAST_HANGOUT_CONFIRMED = 'Locked.'
export const TOAST_HANGOUT_LIVE = 'It is go time.'
export const TOAST_HANGOUT_ENDED = 'That is a wrap.'
export const TOAST_ERROR = 'That was not supposed to happen.'
export const TOAST_NUDGED = 'Nudged.'
export const TOAST_KNOT_DELETED = 'Circle closed.'
export const TOAST_CONFLICT = 'Someone else just changed that. Take a look.'

export const CONFIRM_DELETE_KNOT = 'Close this circle? Everything inside disappears. This cannot be undone.'
export const CONFIRM_LEAVE_KNOT = 'Leave this circle? You will need a new invite to come back.'
export const CONFIRM_DELETE_MOMENT = 'Delete this? It is gone for everyone.'
export const CONFIRM_CANCEL_HANGOUT = 'Cancel this plan? Everyone will be notified. This cannot be undone.'

export const MENU_EDIT_HANGOUT = 'Edit hangout'
export const MENU_CANCEL_HANGOUT = 'Cancel hangout'
export const MENU_SHARE_INVITE = 'Share invite link'
export const MENU_JOIN_CALL = 'Join call'
export const MENU_JOIN_CALL_STARTING = 'Starting call...'
export const TOAST_INVITE_COPIED = 'Invite link copied.'
export const TOAST_INVITE_COPY_FAILED = 'Could not copy the link.'
export const ERROR_SIGN_IN_FOR_CALL = 'Sign in to join the call.'
export const ERROR_CANCEL_HANGOUT = 'Could not cancel the hangout.'
export const CANCELLING_HANGOUT = 'Cancelling…'

export const HOME_EVENTS_LIVE = 'Live now'
export const HOME_EVENTS_UPCOMING = 'Upcoming'
export const HOME_EVENTS_SUGGESTED = 'Suggested'
export const HOME_EVENTS_EMPTY = 'Nothing planned yet'
export const HOME_EVENTS_EMPTY_SUB = 'Hangouts from all your Knots will show up here.'
export const HOME_EVENTS_LOADING = 'Loading...'

export const PLANNER_TODO_HEADER = 'Your actions'
export const BILL_DESC_PLACEHOLDER = 'What was the bill for?'
export const BILL_AMOUNT_PLACEHOLDER = 'Total amount ($)'

export const GAMES_TITLE = 'Games'
export const GAMES_SUBTITLE = 'Play together inside your Knot.'
export const GAMES_COMING_SOON = 'Coming soon'
export const GAMES_LOADING = 'Loading games...'
export const GAMES_RECENT = 'Recent games'
export const GAMES_EMPTY_TITLE = 'No games yet'
export const GAMES_EMPTY_SUB = 'Start a game above to play with your Knot.'
export const GAMES_ERROR_LOAD = 'Could not load games.'
export const GAMES_ERROR_CREATE = 'Could not create the game. Please try again.'
export const GAMES_ERROR_JOIN = 'Could not join the game.'
export const GAMES_ERROR_JOIN_PLAYER = 'Game created, but you could not be added as a player.'
export const GAMES_ERROR_CANCEL = 'Could not cancel the lobby. Please try again.'
export const GAMES_STATUS_WAITING = 'Waiting'
export const GAMES_STATUS_ACTIVE = 'In progress'
export const GAMES_STATUS_FINISHED = 'Finished'
export const GAMES_JOIN = 'Join'
export const GAMES_REJOIN = 'Rejoin'
export const GAMES_CANCEL_LOBBY = 'Cancel lobby'

export const VIBES_FIRST_HANGOUT = 'We outside.'
export const VIBES_ATTENDING = 'Showing up counts.'
export const VIBES_SETTLED_BILL = 'Math survived.'
export const VIBES_WON_GAME = 'Deserved.'
export const VIBES_POSTED_MOMENT = 'Canon.'
export const VIBES_STREAK = 'Consistently outside.'
export const VIBES_1000 = 'Touch grass.'

// CTA_POST / CTA_CONFIRM — locked from architecture doc, do not change
export const CTA_POST = 'Drop it in the group'
export const CTA_CONFIRM = 'Lock it in'

// Hangout state titles — locked, plain
export const STATE_VOTING = "Let's figure it out"
export const STATE_CONFIRMED = 'Locked in'
export const STATE_LIVE = 'Happening now'
export const STATE_ENDED = 'Done'
export const STATE_CANCELLED = 'Called off'

// Open chip labels — locked
export const CHIP_WHERE = 'Where?'
export const CHIP_WHEN = 'What time?'
export const CHIP_INFERRED_HINT = 'Tap to confirm'

// Metadata strip date field — distinct from CHIP_WHEN, which is the time
// field's own open label. The two were sharing CHIP_WHEN, so an empty date
// showed "What time?" instead of a date-specific prompt.
export const CHIP_WHEN_DATE = 'When?'

export const NOTIF_MEMBER_JOINED = 'pulled up.' // prepend member name
export const NOTIF_FRESH_DROP = 'Fresh drop.'
export const NOTIF_HANGOUT_STARTING = 'It is go time.'
export const NOTIF_HANGOUT_ENDED = 'Memories secured.'

export const PLAN_BOARD_HINT = 'tap for full plan'
export const PLAN_BOARD_LIVE = 'Live'
export const PLAN_FIELD_NOT_BOOKED = 'Not booked'
export const PLAN_FIELD_TBD = 'TBD'
export const PLAN_FIELD_POLL_OPEN = 'Poll open'

export const TODO_RSVP_SUB = 'is waiting' // prepend organiser name
export const TODO_VOTE_LABEL = 'Vote'
export const TODO_SETTLE_LABEL = 'Settle'
export const TODO_RSVP_ACTION = 'Going'
export const TODO_VOTE_ACTION = 'Vote'
export const TODO_SETTLE_ACTION = 'Pay'

// Planner lifecycle — three sections (planning, draft, locked) plus the
// abandoned terminal state. Locked/abandoned plans leave the Planner
// entirely: locked ones live in the Feed, abandoned ones just disappear.
export const PLANNER_SECTION_ACTIVE = 'Planning now'
export const ATTENTION_STRIP_HEADER = 'Needs your attention'
export const PLANNER_SECTION_PLANNING = 'Planning now'
export const PLANNER_SECTION_DRAFTS = 'Drafts'
export const PLANNER_SECTION_LOCKED = 'Locked in'
export const PLANNER_EMPTY_PLANNING = 'Nothing in motion. Say what you want to do below.'
export const PLANNER_EMPTY_DRAFTS = 'No drafts saved.'
export const PLANNER_EMPTY_LOCKED = 'Nothing locked in yet.'
export const PLANNER_CTA_SAVE = 'Save for later'
export const PLANNER_CTA_ABANDON = 'Abandon'
export const PLANNER_CTA_RESUME = 'Resume'
export const PLANNER_VIEW_IN_FEED = 'View in Feed'
export const PLANNER_CONFIRM_ABANDON = 'Abandon this plan? It disappears from the Planner. This cannot be undone.'
export const PLANNER_TOAST_LOCKED = 'Locked. Find it in the Feed.'
export const PLANNER_TOAST_SAVED = 'Saved for later.'
export const PLANNER_TOAST_ABANDONED = 'Plan abandoned.'
export const PLANNER_TOAST_RESUMED = 'Back in motion.'
export const PLANNER_NUDGE = [
  "Still figuring this out? It's been quiet a couple days.",
  'This one has gone quiet. Still on?',
]

export const PLAN_UNTITLED = 'New plan'
export const AGENT_VENUE_PROMPT = 'Here are some options nearby.'
export const AGENT_TITLE_PROMPT = 'What should we call this?'

export const PLANNING_CHAT_PLACEHOLDER = [
  'Message the crew...',
  'What is the plan?',
  'What are we doing?',
  'Drop something in the chat.',
]

export const CARD_STATE_COPY: Record<string, { title: string; subtitle: string }> = {
  voting: { title: "Let's figure it out", subtitle: 'RSVP so the plan can lock.' },
  planning: { title: "Let's figure it out", subtitle: 'RSVP so the plan can lock.' },
  draft: { title: "Let's figure it out", subtitle: 'RSVP so the plan can lock.' },
  confirmed: { title: 'Locked in', subtitle: 'See you there.' },
  locked: { title: 'Locked in', subtitle: 'See you there.' },
  live: { title: 'Happening now', subtitle: "You're either there or you're not." },
  ended: { title: 'Done', subtitle: 'Hope it was worth the group chat.' },
  cancelled: { title: 'Called off', subtitle: 'Next time.' },
  abandoned: { title: 'Called off', subtitle: 'Next time.' },
}
