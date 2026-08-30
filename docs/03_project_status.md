# Knot - Project Status Report

NODE Kollective Inc. | Document 03 | August 2026 | Confidential

---

## 1. Current Build Status

Knot is a research and experimentation prototype, not the final market product. The strategy is to build wide, instrument everything, and prune features with real cohort data on a quarterly basis. Features are added broadly during the prototype phase and killed by pre-set kill numbers from real usage data.

The current active sprint is Sprint A. Sprint A is a pure backend sprint. No UI changes are in scope. The composer UI redesign is the sprint immediately after Sprint A ships and is verified.

---

## 2. Shipped and Functional

### Authentication and onboarding
- Email magic link authentication via Supabase Auth.
- Mandatory profile setup on first signup (display name, date of birth, resident city).
- Onboarding component (Onboarding.tsx) implemented.
- Orient card (OrientCard.tsx) implemented.

### Navigation
- Home screen: top tab bar with Feed, Events, Bills tabs. Right sidebar with Knot list, New Knot button, and Create event button.
- Knot screen: top tab bar with Feed, Photos, People, Discover, Bills, Games tabs.
- Hamburger menu sidebar with overflow handling for long Knot names.
- Mobile viewport and responsive layout implemented.

### Knots
- Knot creation with name, optional emoji, optional cover photo.
- Knot cover image storage in hangout-covers Supabase bucket.
- Invite link generation and member join flow.
- Member management (remove members, Master Planner only).
- Leave Knot flow.
- Delete Knot with confirmation dialog.
- Role assignment (RoleAssignSheet component).
- Role badges (RoleBadge component).

### Feed and posts
- Social feed with posts and reactions.
- Inline composer with three post types: Moment, Plan a hangout, Bill.
- Emoji reactions on posts: heart, thumbs up, laugh, fire, surprised, sad, clap.
- Threaded comments with photo and location support on moments, hangouts, and bills.
- Edit and delete posts. Master Planner can delete any comment.
- HomeFeed component showing unified feed across all Knots.

### Hangouts
- create_hangout atomic Postgres RPC (Sprint A deliverable, currently active).
- HangoutCard component with compact layout showing state, open chips, and RSVP count.
- Four lifecycle states: Voting, Confirmed, Live, Ended.
- RSVP on card (Going, Maybe, Can't go).
- Edit and cancel hangout (organiser only).
- Hangout cover image support (cover_image_url column, CoverImagePicker component).
- Movie hangout support (movie_title and movie_showtime columns).
- Availability poll within hangout planning (AvailabilityPoll component).
- Post-hangout loop (PostHangoutLoop component).

### HangoutChatView and planning assistant
- HangoutChatView full-screen overlay component implemented.
- HangoutThread component for the chat stream.
- KnotGroupChat floating chat button persistent across Knot tabs.
- Planning assistant at app/api/planning-agent/route.ts. Reads full conversation history before every reply. Returns structured JSON with agent_message, chips, plan_updates, revenue_suggestion, and venueSearchQuery.
- Agent detection mode in KnotGroupChat.
- Venue search via Google Places triggered by venueSearchQuery field in assistant response.

### Bills
- Manual bill entry with amount, description, payer assignment.
- Equal split across attendees.
- Itemised split with OCR receipt upload (BillItemiser component).
- Percentage split.
- Custom amount split.
- Debt simplification (simplifyDebts in lib/ledger.ts, knot_net_balances view).
- Cross-Knot balance view (cross_knot_balances view, CrossKnotBalances component).
- Bill settlement reminders (last_reminded_at column on bill_splits).
- Running group balance display (LedgerView component).
- Zero guard on bill split division to prevent NaN and Infinity states.

### Discover
- Venue search with category filters, group size filter, and open now toggle.
- Multi-type parallel fetching for activity categories.
- Google Places integration with place_id as the linking key.
- Google Places photo proxy (follows HTTP redirects, server-side only).
- Venue detail view with action buttons.

### Games
- Most Likely To: fully implemented with anonymous voting and automatic result reveal.
- Among Us Lite (Imposter): implemented with server-side role assignment via SECURITY DEFINER function.
- Snake: implemented with per-Knot leaderboard.
- Tetris: implemented with per-Knot leaderboard.

### Memories
- Memories component (Memories.tsx) implemented with media grid organised by hangout and date.

### Vibes
- Vibes points system implemented (VibesCounter component).
- Vibes milestones and copy constants in lib/copy.ts.
- Rewards Shop (RewardsShop component).

### Notifications
- Notifications panel implemented (Notifications.tsx).
- Push notification types: RSVP momentum, hangout confirmed, hangout live, bill settlement reminder, new moment, venue trending, next plan nudge.
- Notifications panel z-index and background fixes applied.

### Design system
- Glass UI design system implemented.
- Tabler Icons system throughout. See Document 06 for full icon standards.
- Voice and copy system implemented. All user-facing strings in lib/copy.ts. See Document 06 for full copy standards.

### Merchant (partial)
- Merchant portal pages in app/merchant/.
- MerchantMenu and MerchantSpecials components in components/merchant/.
- PreOrderCard component implemented.

### Infrastructure
- Supabase migrations managed via MCP integration.
- Vercel deployment with environment variables for agent user IDs.
- Cron job registered: archive-stale-plans-daily at 0 9 * * * UTC.
- Stripe Connect integration for merchant payouts and bill settlement.

---

## 3. Current Active Sprint: Sprint A

### Deliverable
Replace the existing 7-step non-transactional hangout write chain with a single atomic create_hangout Postgres RPC. This RPC handles in one transaction: hangout record creation, participant rows, poll creation, poll options, feed post creation, post_id link on hangout, surprise mode RLS enforcement, and all conditional fields.

### Verification checklist before Sprint A is marked done
- SQL payload test against all hangout types in the 51-scenario validation set.
- Two-account phone walkthrough covering at least one planned hangout, one live hangout, and one surprise hangout.
- Confirm planning_status derivation is correct for all states: open, voting, confirmed, cancelled.
- Confirm excluded_member_ids RLS enforcement on surprise hangouts.

---

## 4. Known Issues

### Code quality (warnings, not blocking)
- ESLint unused variable warnings present across multiple components. These are warnings, not errors, and do not block the build. Affected components include AmongUsLite, BillItemiser, Members, Memories, PlanningView, and several others with useEffect dependency warnings.
- React Hook useEffect missing dependency warnings are a consistent pattern from the current build approach and should be reviewed during the composer redesign sprint.

### UX issues
- New users with zero Knots see a blank Home screen. Empty state with a create-Knot prompt is missing when showHome is true and knots.length is 0 (app/dashboard/page.tsx).
- Bottom nav tab changes do not reset showHome state, causing the home view to persist on top when switching tabs (app/dashboard/page.tsx).
- Destructive actions (Delete Knot) are styled with the primary yellow accent colour rather than a distinct danger colour.
- Colour token collisions: rust, olive, and yellow tokens resolve to the same or similar values in some contexts, removing semantic signal from colour usage.

### Planning assistant gaps (unresolved at handover)
- Date and time chip values confirmed in the thread are not persisting to the hangout record reliably.
- Venue search is returning results from the wrong city in some sessions.
- Double agent messages appear after venue card taps in some cases.
- Weak or ambiguous planning intent from the user produces silence from the assistant rather than a clarifying question.

### Games
- Ludo: board renders and home position pieces render correctly. Path-position rendering logic is absent. Pieces disappear from view when they move from home positions onto the path. Must be gated behind a feature flag or path rendering must be completed before enabling.

---

## 5. Deferred Items

The following were discussed and scoped but have no active sprint assignment.

- Composer UI redesign: the full chip system, card preview, and ComposerStatePayload architecture is designed and documented in Document 02. Implementation begins after Sprint A verification.
- Dietary restriction preferences with three-state soft signal model (interested, neutral, avoid). Defined for Sprint D.
- Group decision flow poll-first architecture. Defined for Sprint E.
- Instrumentation events table and feature flags table. Defined for Sprint C.
- QR invite codes. Defined for Sprint D.
- Invite landing page redesign. Defined for Sprint D.
- Presence indicators. Defined for Sprint G.
- One-tap video session via Daily.co. Defined for Sprint G.
- Photo prints affiliate integration (Printique, Mixtiles). Chips defined, integration not built.
- Experiences affiliate integration (Viator, GetYourGuide). Chips defined, integration not built.
- Table booking affiliate (OpenTable, Resy). Deep links defined, commission integration not built.
- Rideshare deep links (Uber, Lyft). Defined, requires direct commercial partnership for revenue.
- Knot Trips. Defined in product vision. No engineering started.
- Merchant Portal full build. Partial implementation exists. Full build requires separate scoping.
- Knot Wallet. Defined in product vision. No engineering started. Requires 3 to 6 months of regulatory process before any build begins.
- Public Profiles. Defined in product vision. No engineering started.
- Behavioural recommendation weighting in Discover. Schema supports it. Logic not built.
- On This Day in Memories. Defined in product vision. Not built.

---

## 6. Test Environment Reference

| Detail | Value |
|---|---|
| Test Knot name | Toronto Crew |
| Test Knot ID | f3506a80-eb2c-4d61-a784-ef4f25cbbcc0 |

The two-account phone walkthrough using the Toronto Crew Knot is the required verification step before any sprint is marked done.

---

*NODE Kollective Inc. | Knot Project Status Report | Document 03 | August 2026 | Confidential*
