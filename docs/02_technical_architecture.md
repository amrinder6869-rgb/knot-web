# Knot - Technical Architecture

NODE Kollective Inc. | Document 02 | August 2026 | Confidential

---

## 1. Technology Stack

| Component | Detail |
|---|---|
| Framework | Next.js 16 with TypeScript. App Router. Server Components and Server Actions used where appropriate. |
| Styling | Tailwind CSS v4. Light mode only. |
| Database | Supabase (PostgreSQL) with Row Level Security on every table. Project ID: vcrnktkttgprbnoyjeff. Region: ca-central-1. |
| Authentication | Supabase Auth. Email magic link sign-in. Cookie-based sessions via @supabase/ssr. Leaked password protection enabled at the Supabase dashboard level. |
| Storage | Supabase Storage. Private buckets with signed URL access. hangout-covers bucket for Knot and event cover images. |
| Realtime | Supabase Realtime. Enabled per-table via ALTER PUBLICATION supabase_realtime ADD TABLE as a separate migration step. |
| Hosting | Vercel. Team ID: team_K7Ugwh6aScNisATEGFUq3eQX. Production URL: knot-web-am-woad.vercel.app. |
| Repository | GitHub. Repo: amrinder6869-rgb/knot-web. Local path on Windows: C:\Users\amrin\Documents\knot-web. |
| Email | Resend. Transactional email. Free tier sends from onboarding@resend.dev. |
| Push notifications | Expo push notifications on top of Supabase Realtime. OneSignal free tier for additional push delivery. |
| Payments | Stripe Connect. Merchant payouts, prepayment collection, bill settlement. |
| Video calls | Daily.co. Embedded video calls via @daily-co/daily-react. Rooms generated automatically on hangout creation. |
| Venue search | Google Places API. Proxied through a server-side API route. API key is never exposed in client-side URLs. place_id is the linking key between Supabase merchant records and venue results. |
| Planning assistant | LLM-based assistant via app/api/planning-agent/route.ts. Lower-cost model tier for standard sessions. Higher-cost model tier for complex multi-field resolution. |
| Error monitoring | Sentry. Free tier through early growth. |

---

## 2. Repository Structure

| Path | Contents |
|---|---|
| app/ | Next.js App Router pages and API routes. Key routes: app/dashboard/page.tsx (home), app/api/planning-agent/route.ts (planning assistant), app/auth/ (authentication), app/merchant/ (merchant portal pages), app/invite/ (invite link handling). |
| components/ | All React components. See Document 03 for full component inventory. Key components: Composer.tsx, HangoutCard.tsx, HangoutChatView.tsx, HangoutThread.tsx, Feed.tsx, HomeFeed.tsx, KnotGroupChat.tsx, Discover.tsx, BillSplit.tsx, BillItemiser.tsx, CrossKnotBalances.tsx, LedgerView.tsx, Memories.tsx, Members.tsx, Games.tsx, MostLikelyTo.tsx, AmongUsLite.tsx, Snake.tsx, Tetris.tsx, Ludo.tsx, Notifications.tsx, RewardsShop.tsx, VibesCounter.tsx, Onboarding.tsx, OrientCard.tsx, DailyCall.tsx, PreOrderCard.tsx, VenuePoll.tsx, AvailabilityPoll.tsx. Merchant subdir: components/merchant/. |
| lib/ | Shared utilities. Key files: lib/copy.ts (all UI strings and voice system), lib/constants.ts (icon sizes, KNOT_ICONS registry), lib/ledger.ts (debt simplification), lib/hangoutPhase.ts (planning status derivation), lib/track.ts (instrumentation events), lib/flags.ts (feature flags). |
| app/api/ | Server-side API routes. Key routes: planning-agent, auth callbacks, Google Places proxy. |

---

## 3. Database Architecture

### Key tables

| Table | Key details |
|---|---|
| hangouts | Primary event table. Key columns: planning_status (check constraint: planning, draft, locked, abandoned), last_planning_activity_at, cover_image_url, movie_title, movie_showtime, hangout_version (INTEGER DEFAULT 1 for concurrency control). |
| hangout_participants | RSVP and participant state per hangout per user. Uses participant_version for concurrency control, separate from hangout_version. |
| posts | Feed posts. All hangout activity, moments, bills, and games create posts. Column bill_id links bill posts to the bills table. |
| bills | Group expense records. split_type check constraint includes: equal, itemised, percentage, custom. |
| bill_line_items | Itemised bill line items from OCR receipt upload. |
| bill_line_item_assignments | Per-member assignment of itemised line items. |
| bill_splits | Individual member split records. Column last_reminded_at tracks settlement reminder timing. |
| knots | Group circles. emoji column falls back to ti-link icon if no emoji is set. |
| knot_members | Membership and role assignments per Knot. |
| image_packs | Cover image packs available for Knot and event covers. |
| user_image_packs | User selections from image packs. |
| messages | Chat messages within the HangoutChatView thread. Planning assistant messages are authored by the agent user (UUID: b1d28ee7-8aa2-416c-a8fa-ccc260edd431, email: agent@knot.app). |

### Key views

- `knot_net_balances`: simplified debt graph per Knot. Used by the bill split and running balance displays.
- `cross_knot_balances`: aggregate outstanding balances across all Knots for a given user.

### Scheduled jobs

- `archive-stale-plans-daily`: cron job registered in Vercel at `0 9 * * *` UTC. Archives plans that have exceeded the inactivity threshold without being confirmed or cancelled.

---

## 4. The Foundational Architecture Principle

The Composer, the card, and the thread are three surfaces of the same underlying hangout object. The Composer creates it. The card displays it. The thread fills it in. There is no handoff between them. There is one object, projected three ways.

This principle governs every design and engineering decision in the product. If any component introduces a separate state model for any of the three surfaces, it is wrong.

| Surface | Role |
|---|---|
| Composer | Creates the hangout object. Renders a ComposerStatePayload from the creation engine. Never reads the hangout object directly. |
| Card | Displays the hangout object. Card presentation state is always derived. Never stored. Stored facts plus participant facts plus booking facts produce the card presentation. |
| Thread | Fills the hangout object in. All planning conversation, chip resolution, and mutation happens here after the card is posted. The same mutation engine handles pre-post and post-post changes. |

---

## 5. The Hangout Object

The canonical hangout data model has 11 dimensions covering 47 variables. Every hangout type from a casual spontaneous plan to a surprise birthday to a recurring group session is handled by this single model.

| Dimension | Fields |
|---|---|
| Mode | hangout_type (planned / live), is_recurring, cadence, live_started_at, live_expires_at |
| What | activity_type, occasion_type, title, description, anchor_event, movie_title, movie_showtime |
| Who | knot_id, organiser_id, invited_member_ids, excluded_member_ids, participation_model, group_size_target, min_participants, max_capacity, age_restriction |
| When | date, start_time, end_time, duration_minutes, time_flexibility, time_resolution_mode, timezone, rsvp_deadline |
| Where | location_type, place_id, venue_name, address_text, coordinates, meeting_point_text, pickup_point_text, online_room_url, is_weather_sensitive |
| How | transportation_mode, carpool_seats_available, equipment_notes |
| Money | budget_band, payment_required, payment_deadline |
| Booking | booking_required, booking_status, booking_url, booking_deadline |
| Rules | visibility, planning_status (derived only), min_participants_to_confirm |
| Contributions | has_contributions flag. Items stored in child table. |
| Relationships | parent_hangout_id, linked_hangout_ids, sequence_position (for multi-stop outings) |

### Immutable rules

- `planning_status` is always derived. Computed from field values, participant counts, and booking state. Never entered by a user. Never written directly.
- Home address is never written to the hangout object. Stored in a private user_locations table and shared only to confirmed attendees.
- Surprise mode is a hard validation dependency. `excluded_member_ids` and `visibility = surprise` must both be set before a card can post. This is a blocking requirement, not a warning.
- Notifications fire only after an atomic commit succeeds. Never before.

### Concurrency control

Every hangout record carries `hangout_version` (INTEGER DEFAULT 1). Every mutation must include the version it was built against. Commits are rejected if the version has advanced. First commit wins. RSVP taps use row-level `participant_version` and never block or are blocked by hangout mutations.

---

## 6. The Atomic RPC Pattern

All multi-table write operations use SECURITY DEFINER Postgres functions called as atomic RPCs. This is the most important backend architectural decision in the codebase. No feature should ever use a multi-step non-transactional write chain for operations that must succeed or fail as a unit.

### create_hangout RPC

The primary example and the current active engineering focus (Sprint A). This single RPC handles in one transaction: hangout record creation, participant rows for invited members, poll creation and poll options, feed post creation, post_id link on the hangout record, surprise mode exclusion via RLS, and all conditional fields including movie_title and movie_showtime.

### RPC security pattern

Every SECURITY DEFINER function must include both of the following immediately after creation. These are not optional.

```sql
REVOKE EXECUTE ON FUNCTION function_name FROM PUBLIC;
GRANT EXECUTE ON FUNCTION function_name TO authenticated;
```

---

## 7. Row Level Security

RLS is enabled on every table. Policies are wrapped in idempotent `DO $$ BEGIN IF NOT EXISTS ... END $$` blocks to prevent duplicate policy errors on re-run.

Before writing any new RLS policy, query `pg_policies` to confirm current state. Before adding any new column, query `information_schema.columns` to confirm current state. Duplicate column or policy errors halt migrations and are preventable.

Realtime is enabled per-table via `ALTER PUBLICATION supabase_realtime ADD TABLE tablename` as a separate migration step after the table and policies are confirmed.

---

## 8. Planning Assistant Architecture

The planning assistant lives at `app/api/planning-agent/route.ts`. It participates in the HangoutChatView thread as a conversation participant. Agent messages are authored by a dedicated agent user account.

| Detail | Value |
|---|---|
| Agent user UUID | b1d28ee7-8aa2-416c-a8fa-ccc260edd431 |
| Agent email | agent@knot.app |
| Environment variables | KNOT_AGENT_USER_ID and NEXT_PUBLIC_KNOT_AGENT_USER_ID set in Vercel |

### JSON response contract

The assistant returns structured JSON only. Fields:

```json
{
  "agent_message": "string or null",
  "chips": [{ "label": "string", "action": "string", "value": "any" }],
  "plan_updates": { "field": "value" },
  "todo_updates": [{ "member_id": "string", "type": "rsvp|poll|bill", "ref_id": "string" }],
  "revenue_suggestion": { "type": "opentable|uber|mixtiles|lyft", "label": "string", "url": "string" },
  "venueSearchQuery": "string or null"
}
```

### The three-part rule

The assistant proposes. The application decides. The database stores. No model call may write directly to the database under any circumstances.

### What the assistant never does

- Write directly to the database.
- Calculate a dependency cascade.
- Set a derived field such as planning_status.
- Read excluded member data during surprise planning.
- Propose a change that bypasses the deterministic validator.
- Override a permission check.
- Fire a notification.
- Propose two changes when the user requested one.
- Invent a booking URL or confirmation number.
- Guess between two equally plausible interpretations without asking.

### plan_updates rule

`plan_updates` are only written when a chip has been explicitly tapped by a user, or a user has explicitly stated a confirmed value. Never from inference alone. Exception: `plan_updates.title` on the first message that introduces a plan.

### venueSearchQuery rule

When `venueSearchQuery` is set, `agent_message` must be exactly "Here are some options nearby." Never set `venueSearchQuery` alongside `plan_updates.venue_name` in the same reply.

### Known gaps (unresolved at handover)

- Date and time chip values confirmed in the thread are not persisting to the hangout record reliably.
- Venue search is returning results from the wrong city in some sessions.
- Double agent messages appear after venue card taps in some cases.
- Weak or ambiguous planning intent from the user produces silence from the assistant rather than a clarifying question.

---

## 9. Card State System

Card presentation state is always derived. It is never stored. Stored facts plus participant facts plus booking facts produce the derived system state which produces the card presentation.

### Five visual families

| Family | States |
|---|---|
| Figuring it out | open, voting |
| Locked in | confirmed, booking_needed, booking_failed, capacity_warning, min_participants_warning, weather_flag |
| Live now | live_active, live_expired |
| Done | ended, cancelled |
| Special | surprise_planning, pending_change |

### Three density levels

- Compact: feed card, quick scan, no secondary information, minimal action layer.
- Standard: default. Meta row visible, chips visible, RSVP bar present.
- Expanded: chip input is open, card grows downward, no navigation event. Animated height change at 200ms ease-out. Other cards shift smoothly.

### Pending change

Pending change is an overlay state, not a visual family. It appears while a mutation is processing and is implemented as a card-level overlay on the affected chip, not as a separate component tree.

---

## 10. Security Architecture

- Authentication uses Supabase Auth with cookie-based sessions via @supabase/ssr.
- Leaked password protection is enabled at the Supabase dashboard level.
- All SECURITY DEFINER database functions are restricted to authenticated users via REVOKE EXECUTE FROM PUBLIC and GRANT EXECUTE TO authenticated.
- Storage buckets for user media are private with signed URL access only.
- The Google Places API key is never exposed in client-side URLs. All Places calls are proxied through a server-side API route.
- Stripe webhook replay attacks must be mitigated by verifying the Stripe-Signature header on every webhook before any business logic runs. This is a Sprint B fix.
- Daily.co rooms must require authentication before joining. Unauthenticated room access is a Sprint B fix.

---

## 11. Infrastructure Costs at Scale

The product runs within a CAD 250 per month founder budget up to approximately 8,000 total users. At 10,000 total users the Vercel Analytics step cost and variable costs push the monthly total above this threshold. External capital or revenue must cover costs from 10,000 users onward.

The major cost drivers above 10,000 users: Vercel Analytics overage, Supabase storage and egress overages, Google Places API calls above the free tier, Daily.co participant-minutes for video calls. Full cost model is in the supplementary Cost Model document.

---

*NODE Kollective Inc. | Knot Technical Architecture | Document 02 | August 2026 | Confidential*
