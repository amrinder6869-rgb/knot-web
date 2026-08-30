# Knot - Product Overview

NODE Kollective Inc. | Document 01 | August 2026 | Confidential

---

## 1. What Knot Is

Knot is a private social planning platform built for close friend groups of one to twenty people. It functions as an end-to-end meetup operating system, covering the complete lifecycle of a social plan from the first idea through to shared memories after the night ends.

Unlike general social media, Knot is intentionally small. The product becomes more useful as the group gets closer, and less useful as the group gets larger. That constraint is the product.

Knot sits at the intersection of three things that have not been combined before: a private social layer for existing friend circles, a full-stack coordination and commerce tool for going out together, and an AI-assisted planning layer that helps groups decide faster without taking over the decision.

---

## 2. Core Principles

### Private by design
Everything inside a Knot is visible only to its members. No public feed, no algorithmic discovery of private content, no strangers. Privacy is not a feature toggle. It is the foundation of the product.

### The feed is everything
All activity inside a Knot surfaces as posts in a single chronological feed. Hangouts, moments, bills, polls, and games are structured post types in the same stream. Planning happens inline through the composer embedded at the top of the feed. There is no separate planning screen.

### Intentional smallness
The one to twenty person cap is not a limitation. It is the feature. Knot is built for groups where everyone already knows each other. Features that require strangers, algorithmic discovery, or large audiences are explicitly out of scope.

### Utility first
Knot earns its place on the home screen by solving a recurring real-world problem: organising people. The social layer exists to support that job, not the other way around. Every feature must earn its place by making planning easier, faster, or more likely to happen.

### Commerce is embedded
Every monetisation surface appears at the natural moment it is useful in the hangout lifecycle. Affiliate touchpoints, merchant specials, and pre-orders are product features first and revenue sources second. Users are free forever. Revenue comes entirely from commerce and the merchant side.

---

## 3. The Three Data Layers

Knot is built on three compounding data layers that together create a competitive moat that cannot be replicated quickly.

| Layer | Description |
|---|---|
| Structured place data | Sourced from Google Places, enriched over time by merchant-claimed profiles and user-generated tags. Every hangout with a confirmed venue contributes to this layer. |
| Experiential signals | Extracted from creator content and integrated into Discover recommendations. Creators never appear inside groups. Their signal informs recommendations invisibly. |
| Private group behavioural data | Accumulated through real usage: where groups go, what they enjoy, how they spend, and when they plan. This is the moat. It takes time to build and cannot be purchased or replicated. |

---

## 4. Product Structure

### Primary surfaces (currently implemented)

| Surface | Description |
|---|---|
| Home | Unified feed across all Knots the user belongs to. Top tabs: Feed, Events, Bills. Right sidebar: Knot list, New Knot button, Create event button. |
| Knot | Activity space inside a single circle. Top tabs: Feed, Photos, People, Discover, Bills, Games. Feed contains an inline composer and all hangout cards, moments, and bills. |
| Discover | Venue and experience search. Accessible as a tab inside the Knot navigation and inline during hangout planning through the composer. |

### Extended surfaces (pending build decision)

The following surfaces are defined in the product vision but are not yet implemented. Each requires a separate scoping and build decision before any engineering begins.

- Public Profile: optional outward-facing identity layer with privacy tiers, stats, highlights, and a places grid.
- Knot Trips: dedicated travel planning mode with itinerary builder, shared trip budget, and AI travel companion.
- Merchant Portal: business-facing interface for restaurants, bars, venues, and experience providers to claim listings, create Knot Specials, manage menus, and accept group pre-orders.

---

## 5. Navigation

### Home level
Top tab bar: Feed, Events, Bills. Right sidebar on desktop: Knot list, New Knot button, Create event button.

### Knot level
Top tab bar: Feed, Photos, People, Discover, Bills, Games.

The composer sits at the top of the Feed tab with three post type options: Moment, Plan a hangout, and Bill. All planning begins from this surface. A floating chat button is present on the Knot screen providing access to the group chat.

### Hangout cards in the feed
Hangout cards render in the feed with open chips for unresolved plan fields (When, What time, Where) and the current RSVP count. Tapping a card opens the full-screen HangoutChatView where all planning conversation and chip resolution happens.

---

## 6. Knots

A Knot is a private circle of one to twenty people. It is the primary organisational unit of the product. Members join via an invite link generated by the creator. Knots have a name, optional emoji, and optional cover photo stored in the hangout-covers Supabase Storage bucket.

### Roles

| Role | Description |
|---|---|
| Master Planner | Creator and primary organiser. Full control over Knot settings, member management, and hangout editing. |
| Co-Planner | Can create and edit hangouts and manage the group brief. |
| Treasurer | Owns the bill split flow, initiates and closes settlements, manages the running group balance. |
| Hype Person | Drives RSVP momentum. Receives nudge notifications when RSVP completion is low. |

Task roles are assigned per hangout, not per Knot: Ride Coordinator, Table Booker, Food Orderer, Photographer, Playlist Curator.

---

## 7. Hangouts

A hangout is the primary event object in Knot. It is created through the inline feed composer and moves through four lifecycle states.

| State | What the user sees | Available actions |
|---|---|---|
| Voting | Proposed details, open chips for unresolved fields (When, What time, Where), RSVP buttons, RSVP count. | RSVP. Comment. React. Edit hangout (organiser). Cancel hangout (organiser). |
| Confirmed | Confirmed details, full RSVP list, affiliate chips for table booking, rideshare, and experiences. | RSVP still editable. Start the hangout. Share details. Tap affiliate chips. |
| Live | Active hangout banner. Photo capture prompt for Photographer role. Group check-in count. | Post moments. Settle partial bills. End the hangout (organiser). |
| Ended | Recap card with attendees, venue, duration. Photo grid. Bill settlement summary. | Rate the hangout and venue. Settle outstanding bills. Order prints. Save memories. |

### Planning in the thread

When a hangout card is tapped it opens HangoutChatView. All planning conversation happens here. A planning assistant participates in the thread, reads the full conversation history before every reply, proposes specific options through tappable chips, and acknowledges confirmed values. The group remains in control of every decision.

### Hangout object

The hangout object has 11 dimensions: Mode, What, Who, When, Where, How, Money, Booking, Rules, Contributions, and Relationships. Planning status is always derived from field values and participant state, never entered by a user. The full data model is in Document 02.

---

## 8. Bills and Splitting

Bill splitting is a persistent group financial tool accessible within hangout cards and from the Bills tab.

### Split methods
- Equal split across all attendees.
- Itemised split per person using OCR receipt upload (BillItemiser component).
- Custom amounts per person.
- Percentage split.
- Exclude specific members from a bill.

### Running group balance
A simplified debt graph shows who owes whom across all expenses. Debt simplification uses greedy creditor-debtor matching to minimise the number of transactions required to settle all debts. Implemented in `lib/ledger.ts` as `simplifyDebts`, backed by the `knot_net_balances` Supabase view.

### Cross-Knot balances
A dedicated view shows outstanding balances across all Knots a user belongs to. Implemented as the `cross_knot_balances` Supabase view and the CrossKnotBalances component.

### Settlement
Real money settlement via Stripe Connect is defined in the product architecture. Interac e-Transfer is available as a supplement for Canadian users.

---

## 9. Discover

Discover is the venue and experience search layer. Accessible as a Knot tab and inline during hangout planning. Category filters: Food, Drinks, Coffee, Activities, Outdoors, Entertainment. Group size filter and open now toggle. Multi-type parallel fetching is used for activity categories to return richer results.

Behavioural recommendation weighting based on group hangout history is defined in the product architecture and the schema supports it. The recommendation engine weighting logic is a future sprint item.

---

## 10. Games

| Game | Status |
|---|---|
| Most Likely To | Implemented. Voting game with anonymous voting and automatic result reveal. |
| Among Us Lite | Implemented. Async social deduction game with server-side role assignment via SECURITY DEFINER function. |
| Snake | Implemented. Single-player with per-Knot leaderboard. |
| Tetris | Implemented. Single-player with per-Knot leaderboard. |
| Ludo | Partially implemented. Board and home position pieces render. Path-position rendering is incomplete. Requires a gate or completion decision before enabling. |

---

## 11. Memories

The Memories component (Memories.tsx) is implemented. It is a private media archive organised by hangout, date, and venue. On This Day surface is defined in the product vision and requires a separate build decision.

---

## 12. Vibes Points

Vibes is the loyalty and engagement currency. Points are earned through real participation: posting moments (capped at 3 per day), creating hangouts, attending hangouts, settling bills, winning games, completing task roles, maintaining hangout streaks. Points are spent in the Rewards Shop on cosmetic unlocks only. No functional features are gated behind Vibes. No monetary value.

---

## 13. Notifications

Push notifications are a coordination tool, not a growth mechanism. Implemented via Expo push notifications on Supabase Realtime.

Notification types in use: RSVP momentum nudge, hangout confirmed, hangout going live, bill settlement reminder, new moment from a connection, venue trending, next plan nudge after a hangout ends.

---

## 14. Monetisation Model

Users are free forever. All revenue comes from commerce, affiliate, and merchant sources. No advertising. No user data is sold or shared.

| Revenue type | Mechanism | Phase |
|---|---|---|
| Experiences affiliate | Commission on activity bookings via Viator and GetYourGuide chips on confirmed hangout cards and in Discover. | Phase 1 (launch) |
| Photo prints affiliate | Commission on print orders via Printique and Mixtiles chips on ended hangout cards and in Memories. | Phase 1 (launch) |
| Table booking | Commission per cover via OpenTable and Resy. Revenue activates at approximately 100 monthly referred covers. | Phase 2 |
| Rideshare | Deep link as UX feature at launch. Revenue requires direct commercial partnership with Uber and Lyft. Not available via public affiliate program. | Phase 2 |
| B2B listing fees | Monthly fee for verified business profiles in Discover. CAD 49 to 299 per month depending on business type. | Phase 3 |
| Premium Merchant Knot | B2B subscription. CAD 149/month standard, CAD 299/month professional. Includes unlimited Specials, event posting, subscriber push notifications, and analytics. | Phase 3 |
| Knot Specials commission | 10% of prepaid group transaction value. Collected via Stripe Connect before the group arrives. | Phase 3 |
| Group pre-order commission | 10% of direct pre-order value to restaurants. Bypasses delivery platforms entirely. | Phase 3 |
| Bill settlement margin | Platform processing margin on Stripe Connect settlements between group members. | Phase 3 |
| Merchant domain sales | Retail markup on domain purchases via Namecheap reseller API for merchant profiles and user profiles. | Phase 4 |
| Knot Trips commerce | Flights, accommodation, experiences, travel insurance, currency cards. KnotAI subscription is the only user-facing paid feature in the product. | Phase 6 |
| Intent marketplace | Bidded placement against confirmed group behavioural profiles. Requires data maturity from Phases 1 to 5. | Phase 7 (post-raise) |

---

## 15. Sprint Queue

Sprint A is the current active sprint as of August 2026.

| Sprint | Focus | Deliverable |
|---|---|---|
| Sprint A | Backend foundation | Replace the 7-step non-transactional hangout write chain with a single atomic create_hangout Postgres RPC. Composer UI redesign begins after Sprint A ships and is verified. |
| Sprint B | Security and trust | Stripe verify-payment replay fix, Daily.co unauthenticated room fix, invite signup pending_invite redemption, settlement undo confirm, founder-only menu gating, notification dead taps. 3 fixes per week cadence. |
| Sprint C | Instrumentation | Events table, feature flags table, baseline event tracking. Recruit 5 to 8 Toronto cohort groups for real usage data. |
| Sprint D | Onboarding v2 | Two-screen onboarding (profile and preferences with three-state soft signal model), invite landing page redesign, QR invites, Orient card. |
| Sprint E | Group decision flow | Poll-first with 3 venue options, restriction notes not hard filters, None of these escape hatch. |
| Sprint F | Planning agent | Full agent build using architecture defined in Document 02. Gate: poll participation above 60% in cohort groups. |
| Sprint G | Presence and sessions | Presence indicator, one-tap video session, Most Likely To only during sessions, session recap. Gate: unprompted second hangout above 30% of cohort groups. |
| Composer redesign | UI architecture | Full composer UI redesign implementing the chip system, card preview, and interaction contract defined in Document 02. Begins after Sprint A verification. |

---

## 16. Longer Horizon

The following are on the product roadmap with no active engineering assignment. Each requires a separate scoping decision before build begins.

- Knot Trips: full travel planning extension with itinerary builder, AI travel companion, and trips commerce layer.
- Merchant Portal: business onboarding, Knot Specials creation, group pre-order management, and large events dashboard.
- Knot Wallet: stored-value group wallet. Requires FINTRAC registration, AML and KYC procedures, and RPAA Bank of Canada PSP registration before accepting real funds. Legal timeline is 3 to 6 months.
- Public Profiles: optional outward-facing identity layer with privacy tiers and venue-based discovery.
- Large events mode: coordination tools for events beyond the 20-person cap.
- Group food pre-order: full pre-order flow connecting to merchant menus with per-member item assignment and Stripe pre-payment.
- Intent marketplace and ad network: bidded placement against confirmed group behavioural profiles. Requires data maturity from Phases 1 to 5.

---

*NODE Kollective Inc. | Knot Product Overview | Document 01 | August 2026 | Confidential*
