# Knot - Product and Design Standards

NODE Kollective Inc. | Document 06 | August 2026 | Confidential

This document is the source of truth for anyone building on Knot. It covers voice and copy rules, icon system, colour tokens, design references, and planning assistant tone. Any code, copy, or UI produced for Knot must conform to these standards.

---

## 1. Brand Identity

| Property | Value |
|---|---|
| Brand colour | #F8BD03 yellow. Primary CTAs, active states, key interactive elements. |
| Font | Manrope only. No other fonts. |
| Mode | Light only. No dark mode support in the current build. |
| Visual references | Linear, Stripe, Notion. Clean, functional, minimal decoration. |

### What Knot never looks like
- No gradient text.
- No decorative borders used for visual interest alone.
- No excessive drop shadows.
- No rounded pill buttons on every surface. Use them where they earn it.
- No loud illustrations or mascots.

---

## 2. Voice

The app is a member of the group chat. Not the loudest one. The one with the best timing. Every line should make someone smirk, not laugh out loud.

### Rules
- Short. Present tense. No hedging.
- No exclamation points.
- No em dashes.
- Never use: "successfully", "please wait", "seamlessly", "just", "easily", "great", "sure", "of course", "sounds good", "we have got X locked in", "I would be happy to", or any phrase that could appear in a generic SaaS app.
- No apologies on non-destructive actions.
- No "are you sure" energy unless something cannot be undone.
- Every sentence informs, guides, or rewards. If it does none of those, cut it.

### Surface rules

| Surface | Rule |
|---|---|
| Functional surfaces | Plain and unambiguous. Buttons, status labels, RSVP options, nav labels. Read-to-decide. No personality here. |
| Transitional surfaces | Personality lives here. Loading states, toasts, empty states, notifications, Vibes rewards, onboarding. |
| Destructive surfaces | Plain and direct. No humour on anything that cannot be undone. Cancel, delete, remove. |

---

## 3. Copy System

All user-facing strings live in `lib/copy.ts` as variant arrays. Never hardcode strings inline in components.

### Implementation pattern

```typescript
// Standard variant pool
export const TOAST = {
  HANGOUT_CREATED: 'Plan is up. See who is in.',
  RSVP_GOING: 'Bet.',
  // ...
}

// Random selection with optional rare pool
export function getRandom<T>(arr: T[], rareArr?: T[]): T {
  if (rareArr && Math.random() < 0.08) {
    return rareArr[Math.floor(Math.random() * rareArr.length)]
  }
  return arr[Math.floor(Math.random() * arr.length)]
}

// Tagged pool (common and rare in one array)
type Tagged = { text: string; rare: boolean }
export function getRandomTagged(items: Tagged[]): string {
  const common = items.filter(i => !i.rare)
  const pool = (Math.random() < 0.1 || common.length === 0) ? items : common
  return pool[Math.floor(Math.random() * pool.length)].text
}
```

### Loading states
Must have a pool of three or more variants. At least one rare variant at approximately 8% probability.

```typescript
export const LOADING = {
  members: {
    pool: ['Gathering the crew.', 'Roll call.', 'Seeing who is around.'],
    rare: ['Still waiting on the one who said five minutes.']
  },
  venues: {
    pool: ['Finding the move.', 'Looking around.', 'Scouting it out.'],
    rare: ["Choosing a restaurant: humanity's hardest problem."]
  },
  bills: {
    pool: ['Running the numbers.', 'Doing the math so you don\'t have to.'],
    rare: ['Friendship test incoming.']
  },
  memories: { pool: ['Digging through the lore.', 'Pulling up the archive.'] },
  generic: {
    pool: ['Give us a sec.', 'Working on it.', 'On it.', 'This will be quick.', 'Brb.'],
    rare: ['Nobody panic. We are loading.']
  },
}
```

### Empty states
```typescript
export const EMPTY = {
  KNOTS: 'Your circle does not exist yet. Make one.',
  HANGOUTS: 'Weekend looking suspiciously empty.',
  MEMORIES: 'Future nostalgia goes here.',
  BILLS: 'Financial peace.',
  FEED: 'Group chat is asleep.',
  DISCOVER: 'Nothing matched. Try a different vibe.',
  GAMES: 'Too peaceful in here.',
}
```

### Toasts
```typescript
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
```

### Confirmations
```typescript
export const CONFIRM = {
  DELETE_KNOT: 'Close this circle? Everything inside disappears. This cannot be undone.',
  LEAVE_KNOT: 'Leave this circle? You will need a new invite to come back.',
  DELETE_MOMENT: 'Delete this? It is gone for everyone.',
}
```

### Vibes milestones
```typescript
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
```

### Composer copy
```typescript
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
```

### Key UI strings

| Element | String |
|---|---|
| Post button | Drop it in the group |
| Confirm button | Lock it in |
| Hangout posted toast (variants) | Dropped in the group. / It's in the thread. / Plan's live. [rare: And so it begins.] |
| Hangout confirmed toast (variants) | Locked in. / It's happening. [rare: No backsies.] |
| Cancel hangout confirm | Cancel this plan? / Everyone will be notified. This cannot be undone. |
| Not enough Vibes | You are short by X Vibes. Go make a plan. |
| Vibes purchase confirm | Use X Vibes on this? / Spend them / Keep them |
| Unlock toast | Unlocked. |
| Version conflict | Someone else just changed that. Take a look. |
| Open chip (venue) | Where? |
| Open chip (time) | What time? |
| State label: open | Let's figure it out |
| State label: confirmed | Locked in |
| State label: live | Happening now |
| State label: ended | Done |
| State label: cancelled | Called off |

---

## 4. Emoji Policy

Emoji are permitted only in the following specific contexts. Everywhere else, use icons.

| Permitted context | Detail |
|---|---|
| Post and comment reactions | heart, thumbs up, laugh, fire, surprised, sad, clap |
| Ludo game pieces | Player colour pieces in the Ludo board only |

No emoji anywhere else in the product UI. No emoji in copy constants in lib/copy.ts. No emoji as navigation icons, action icons, or status indicators.

---

## 5. Icon System

All UI icons use the Tabler Icons system exclusively. Class format: `ti ti-[icon-name]`.

### Registry
The `KNOT_ICONS` registry lives in `lib/constants.ts`. All icons used in the product must be registered here. Use `KnotIcon` component for rendering with `getKnotIcon()` fallback to `ti-link` when no icon is specified.

The `knots.emoji` column falls back to `ti-link` if no emoji is set for a Knot.

### Size constants (lib/constants.ts)

| Constant | Size | Usage |
|---|---|---|
| ICON_SIZE.nav | 20px | Bottom navigation and top tab bar icons |
| ICON_SIZE.header | 22px | Page header icons |
| ICON_SIZE.card | 16px | Icons within feed cards and hangout cards |
| ICON_SIZE.input | 16px | Icons within input fields and form controls |
| ICON_SIZE.inline | 14px | Icons inline with body text |

### Rules
- Never use emoji as a UI icon.
- Never use an icon outside the Tabler Icons system.
- Always use the `KnotIcon` component rather than rendering the class directly. This ensures consistent sizing and fallback behaviour.
- Always register new icons in `KNOT_ICONS` before using them.

---

## 6. Colour Token System

All colours are defined as CSS custom properties in `globals.css`. Never use hardcoded hex values in component styles. Always use tokens.

### Core tokens

| Token | Value | Semantic use |
|---|---|---|
| --yellow | #F8BD03 | Primary brand colour. CTAs, active states, primary actions. |
| --danger | Red (to be defined) | Destructive actions only. Delete, remove, leave. |
| --rust | Distinct red/terracotta (to be defined, not same as --yellow) | Error states and warnings. |
| --olive | Distinct muted green (to be defined, not same as --yellow) | Secondary and positive states. |
| --indigo | #4F46E5 | Accent where purple/blue is semantically appropriate. |
| --indigo-dim | #EEF2FF | Muted indigo background for indigo-accented states. |

### Known issue
At the time of this document, `--rust`, `--olive`, and `--yellow` resolve to the same or similar values in some contexts. This removes semantic signal from colour. These tokens must be assigned distinct hex values as part of the next design system pass. `--danger` must also be added as a distinct red token separate from `--rust`.

### Semantic rules
- Destructive actions (Delete Knot, Leave Knot, Remove member, Delete post) must use `--danger`, never `--yellow`.
- Confirmation dialogs for destructive actions must show Cancel and the destructive action in `--danger`. Never style a destructive confirmation button with the primary yellow.
- Error states use `--rust`. Success states use `--olive`. Primary actions use `--yellow`. These must be visually distinguishable.

---

## 7. Planning Assistant Tone

The planning assistant participates in the group chat as a member. Its voice must be consistent with the product voice: the sharpest person in the group chat, not a support bot.

### Tone rules
- One or two short sentences maximum per reply. Never more than 20 words total in `agent_message`.
- Short. Present tense. No hedging.
- Never say: "Great", "Sure", "Of course", "Sounds good", "We've got X locked in", "I'd be happy to", or anything that sounds like a support agent.
- If you would not say it to a friend in a group chat, do not write it.

### Correct tone examples
- "Boston Pizza is locked. Switch to KFC?"
- "Done. KFC it is."
- "Saturday works. Where are you thinking?"
- "Here are some options nearby."

### Incorrect tone examples
- "Great choice! I've locked in Boston Pizza for you."
- "Sure, I'd be happy to help you find a venue!"
- "Of course! I can search for restaurants in your area."

### Chip label rules
- Maximum three chips per reply.
- Chip labels maximum three words each.
- Labels must be decisive and specific. "7 PM Saturday" not "Choose a time".

---

## 8. Composer Interaction Standards

These standards apply to the composer UI implementation in the composer redesign sprint and all subsequent work.

### Four interaction states

| State | What the user sees |
|---|---|
| Idle | Text field with placeholder from COMPOSER_PLACEHOLDER pool. Quick-start tiles. No card preview. |
| Resolving | Skeleton card preview appears instantly. Chips loading. Copy from COMPOSER_RESOLVING pool. |
| Ready | Payload received, postable = true. Post button visible labelled "Drop it in the group". |
| Questioning | blocking_question is non-null. Post button hidden. One question shown. Maximum two questions before posting with open chips. |

### Chip states

| State | Visual |
|---|---|
| Open | Dashed border, muted colour. Invitation, not error. |
| Filled | Solid border, surface-1 background. Editable by organiser. |
| Inferred | Amber border, warm tint. Always shows a confirm hint. |
| Editing | Accent border and background. Input is open. |
| Optimistic | Filled appearance at reduced opacity. Commit in flight. |
| Conflict | Warning border and tint. Concurrent write won. Temporary. |
| Disabled | Muted, not interactive. Not available in current card state. |
| Locked | Read-only. Terminal state. No further editing. |

### Core chip rules
- Open is not incomplete. The dashed border is an invitation, not a warning. Never display it in red or with error language.
- Inferred chips always show a confirm hint. Tapping confirms the value and upgrades provenance from inferred to explicit.
- Tapping outside an expanded chip input closes it without saving. No mutation fires.
- Filled chips are editable by organiser and co-planner only. Members see the value but the editor does not open.

---

*NODE Kollective Inc. | Knot Product and Design Standards | Document 06 | August 2026 | Confidential*
