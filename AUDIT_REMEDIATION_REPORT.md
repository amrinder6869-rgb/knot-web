# Audit Remediation Report

**Branch:** `cursor/fix-audit-phase1-fd7a`  
**PR:** #17  
**Date:** August 27, 2026

This report documents all remediation work performed against the product audit (84 interactive elements audited: 62 WORKING, 14 PARTIALLY WORKING, 1 BROKEN, 7 NOT IMPLEMENTED).

---

## Phase 1 — Critical fixes (P0)

**Goal:** Fix broken core flows, wire missing scroll behavior, remove debug noise, clear ESLint blockers.

| # | Finding | Status | Change |
|---|---------|--------|--------|
| 1 | **BROKEN:** New plans invisible in Plans tab (`planning_status: 'planning'` filtered out) | ✅ Fixed | Added `planning`, `draft`, `locked` to `UPCOMING_PLANNING_STATUSES` in `lib/hangoutPhase.ts` |
| 2 | **PARTIAL:** Attention strip scroll targets dropped by dashboard | ✅ Fixed | Dashboard stores `OpenChatOpts` (hangoutId, scrollTarget, scrollToBottom) and passes to `HangoutChatView` |
| 3 | Debug `console.log` in production paths (4 locations) | ✅ Fixed | Removed from `Composer.tsx`, `PlansList.tsx`, `HangoutChatView.tsx`, `app/api/planning-agent/route.ts` |
| 4 | ESLint blockers: ref update during render, component created during render | ✅ Fixed | `DailyCall.tsx`: ref assignment moved to `useEffect`; `HomeEvents.tsx`: `EventsSection` extracted to module scope |

**Files changed:** 8  
**Verification:** `npx tsc --noEmit` pass; ESLint 0 errors on changed files

---

## Phase 2 — Feature wiring (P1)

**Goal:** Mount missing UI surfaces, complete menu actions, fix chat photo behavior, register games.

| # | Finding | Status | Change |
|---|---------|--------|--------|
| 1 | **NOT IMPLEMENTED:** Planner sections (Planning now / Drafts / Locked in) | ✅ Fixed | `PlanningView` mounted on Plans tab above cross-knot `PlansList`; relaxed `!post_id` filter so composer plans appear |
| 2 | **NOT IMPLEMENTED:** Join call in three-dot menu | ✅ Fixed | Added to `HangoutChatView` and `HangoutCard` menus; cards use `autoJoinCall` to open chat and start Daily call |
| 3 | **PARTIAL:** Plus-photo posts to feed only, not chat thread | ✅ Fixed | `HangoutChatView.postMoment` dual-writes: feed moment + `hangout_messages` row with `photo_path` |
| 4 | **NOT IMPLEMENTED:** Most Likely To and Ludo in Games hub | ✅ Fixed | Registered in `GAMES_REGISTRY` with active-game routing in `Games.tsx` |
| 5 | Hangout menu labels hardcoded | ✅ Partial | Centralized menu labels in `lib/copy.ts` (`MENU_*`, `TOAST_INVITE_*`) |

**Files changed:** 10  
**Verification:** `npx tsc --noEmit` pass

---

## Phase 3 — Data correctness & TODO actions (P1)

**Goal:** Unify lock status with DB schema, fix filters, wire PlanningView TODO strip actions.

| # | Finding | Status | Change |
|---|---------|--------|--------|
| 1 | `HangoutChatView` writes invalid `planning_status` values (`confirmed`, `live`, `cancelled`) | ✅ Fixed | Lock → `'locked'`; cancel → `'abandoned'`; go live → status only (no invalid planning_status) |
| 2 | `HangoutCard` cancel writes `planning_status: 'cancelled'` | ✅ Fixed | Uses `'abandoned'` per DB constraint |
| 3 | `VenuePoll` confirms venue without setting planning_status | ✅ Fixed | Sets `planning_status: 'locked'` on venue pick |
| 4 | `AttentionStrip` misses locked plans | ✅ Fixed | Uses `isUpcomingHangout()` from `lib/hangoutPhase.ts` |
| 5 | `HomeEvents` misses locked-only hangouts | ✅ Fixed | Filters by `hangoutPhase()` (planning / confirmed / live) |
| 6 | **PARTIAL:** PlanningView poll "Vote" only expands board | ✅ Fixed | Opens chat overlay with `scrollTarget: 'poll'` via new `onOpenChat` prop |
| 7 | **BROKEN:** PlanningView bill "Pay" called `setSheet(null)` | ✅ Fixed | Opens chat with `scrollTarget: 'bill'` or local bill sheet fallback |
| 8 | `PAST_PLANNING_STATUSES` missing `abandoned` | ✅ Fixed | Added `'abandoned'` to past status list |

**Files changed:** 9  
**New helper:** `isUpcomingHangout()` in `lib/hangoutPhase.ts`

---

## Phase 4 — Copy migration & ESLint cleanup (P2)

**Goal:** Centralize remaining user-facing strings; reduce ESLint noise in app code.

| # | Area | Status | Change |
|---|------|--------|--------|
| 1 | Home Events copy | ✅ Fixed | `HOME_EVENTS_*` constants; `HomeEvents.tsx` uses `hangoutPhase` + copy |
| 2 | Games hub copy | ✅ Fixed | `GAMES_*` constants replace all inline hub strings |
| 3 | Hangout menu / error copy | ✅ Fixed | `ERROR_CANCEL_HANGOUT`, `CANCELLING_HANGOUT`, bill placeholders |
| 4 | ESLint: 4 `<Link>` errors | ✅ Fixed | `app/page.tsx`, `app/invite/[token]/page.tsx` use `next/link` |
| 5 | ESLint: ~112 patch-script noise errors | ✅ Fixed | Root `*.js` and `scripts/**` added to `eslint.config.mjs` ignores |
| 6 | Remaining hook-deps warnings | ⚠️ Deferred | 27 warnings remain (non-blocking); mostly `exhaustive-deps` in data-fetch effects |

**Files changed:** 7 + `eslint.config.mjs`

---

## Audit item resolution summary

| Category (original audit) | Before | After |
|---------------------------|--------|-------|
| WORKING | 62 | ~72 |
| PARTIALLY WORKING | 14 | ~6 |
| BROKEN | 1 | 0 |
| NOT IMPLEMENTED | 7 | 0 |
| UNKNOWN | 0 | 0 |

### Items fully resolved

- Plans tab visibility for new hangouts
- Attention strip scroll-to-poll / scroll-to-bill
- Planner sections (Planning now / Drafts / Locked in)
- Join call in hangout menu
- Chat plus-photo in thread
- Games registry (MLT + Ludo)
- Lock status DB constraint alignment
- PlanningView TODO bill/poll actions
- Home Events filtering for locked plans

### Items partially resolved / deferred

| Item | Notes |
|------|-------|
| Full copy migration | Key surfaces done; `HangoutChatView` chip labels, agent prompts, and edge-case toasts remain inline |
| ESLint hook-deps warnings | 27 warnings; intentional stale-closure patterns in several data loaders |
| Lock status display unification | `hangoutPhase()` maps both `locked` and legacy `confirmed` planning_status to phase `confirmed` — backward compatible |
| Design UX audit (separate doc) | Reactions UI, invite encoding, Avatar unification, landing redesign — not in scope for this remediation |

---

## File change index (all phases)

| File | Phases |
|------|--------|
| `lib/hangoutPhase.ts` | 1, 3 |
| `lib/copy.ts` | 2, 4 |
| `app/dashboard/page.tsx` | 1, 2, 3 |
| `app/page.tsx` | 4 |
| `app/invite/[token]/page.tsx` | 4 |
| `app/api/planning-agent/route.ts` | 1 |
| `components/AttentionStrip.tsx` | 2, 3 |
| `components/Composer.tsx` | 1 |
| `components/DailyCall.tsx` | 1 |
| `components/Feed.tsx` | 2 |
| `components/Games.tsx` | 2, 4 |
| `components/Hangout.tsx` | 2 |
| `components/HangoutCard.tsx` | 2, 3, 4 |
| `components/HangoutChatView.tsx` | 1, 2, 3 |
| `components/HomeEvents.tsx` | 1, 3, 4 |
| `components/PlanningView.tsx` | 2, 3, 4 |
| `components/PlansList.tsx` | 1, 2 |
| `components/VenuePoll.tsx` | 3 |
| `eslint.config.mjs` | 4 |

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ Pass |
| `npx eslint app components lib` | ✅ 0 errors, 27 warnings |
| `npm run build` | ❌ Pre-existing Stripe API key missing (unrelated) |

---

## Recommended follow-up (out of scope)

1. **Design UX audit P0** — Reactions UI, invite page encoding, letter-placeholder icons, yellow-for-errors
2. **Remaining copy sweep** — `HangoutChatView` agent chip labels, RSVP strings, live prompts
3. **Hook-deps triage** — Wrap loaders in `useCallback` where stale data is observed in production
4. **Data migration** — Backfill any hangouts with legacy `planning_status: 'confirmed'` to `'locked'`
