# Knot Product Audit — Design / UI / UX

**Product:** Knot — private social circle + hangout collaboration  
**Lens:** Does this feel like a modern social + collaboration product (Discord/iMessage group + BeReal/Instagram private + Splitwise + When2meet)?  
**Verdict:** The concept is strong. The UI currently reads as a functional internal tool with a yellow accent — not a social product. Collaboration features exist but are buried, inconsistently named, and visually unfinished.

---

## Executive summary

Knot has real product substance (closed groups, hangouts, RSVPs, bills, media, invites, discover). The design system and interaction model have not caught up. The product feels like **gray boxes + yellow buttons + emoji**, not a living circle of people.

Three structural problems dominate:

1. **No social presence** — avatars are mostly initials; reactions are broken; comments are collapsed; home feed is read-only.
2. **No visual hierarchy** — every chip, tab, and outbound link weighs the same; HangoutCard is a feature dump.
3. **No design system** — ~1,200+ inline `style={{}}` blocks, almost zero shared components, Tailwind imported but unused, ~1 aria attribute across the app.

---

## 1. Brand & visual identity

### What works
- Logo lockup (`kn` + yellow `o` + `t`) and Manrope are distinctive enough.
- Yellow `#F8BD03` on light neutrals is a clear brand signal (not the default purple-AI look).
- Invite-only positioning on the landing page is clear.

### Gaps

| Issue | Detail | Severity |
|---|---|---|
| Flat white canvas | Landing and app use flat `--bg` / `--bg2`. No atmosphere, photography, texture, or full-bleed social imagery. | High |
| Landing pill clutter | Feature pills (`Hangout polls`, `Bill splitting`, …) compete with the brand and headline. Reads like a feature checklist, not a social promise. | High |
| No motion | Only 0.15s tab transitions and a live hangout glow. No presence animations, no post-success feedback, no RSVP celebration. | High |
| Token drift | `--indigo` aliases to yellow. Live hangout hardcodes `#4ade80` / `#f87171`. Merchant pages hardcode hex and fork the system. | Med |
| Yellow semantic overload | Brand, primary CTA, warnings, and delete all use yellow. Errors look like tips. | High |
| Skeleton unused | `skeleton-shimmer` keyframes exist in CSS; loading states are mostly `"Loading..."` text. | Med |

**Brand test failure:** Remove the nav logo and the first viewport could be any SaaS tool with a yellow accent. There is no visual of *people together*.

---

## 2. Design system & craft debt

| Metric | Reality |
|---|---|
| Shared UI kit (`components/ui`) | Does not exist |
| Inline styles | Dashboard alone ~152; HangoutCard ~136; Discover ~94; Memories ~84; Composer ~77 |
| `className` usage | ~7 across app (mostly layout hooks) |
| Tailwind | Imported, effectively unused for UI |
| Accessibility (`aria-*` / `role`) | ~1 hit across the product |
| Focus / keyboard hover | Hover via `onMouseEnter` DOM mutation; no focus rings |

**Impact:** Every surface reinvents padding (`9px 12px` vs `8px 14px` vs `11px`), radius (`8` / `10` / `12` / `16`), and button styles. Visual rhythm breaks between Feed, Discover, Bills, and Merchant. Shipping consistency is impossible without a primitive layer (Button, Input, Avatar, Card, Sheet, EmptyState, Toast).

Radix packages are already in `package.json` (dialog, tabs, dropdown, tooltip, avatar) but almost unused for real UI composition.

---

## 3. Information architecture

### Naming mismatch (mental model fail)

| UI label | Actual feature | User expectation |
|---|---|---|
| Discussion | Feed / moments | Chat? Forum? |
| Tonight | Hangouts (any date) | Only tonight’s plans |
| Media | Memories / photos | Any media, not “memories vault” |
| Home Feed / Events / Bills | Cross-knot activity | Social home |

Social products use plain words people already know: **Feed, Plans, Photos, People**. Current labels feel corporate and obscure the product.

### Navigation gaps
- Bottom nav is **text-only** (no icons) and only appears inside a Knot — Home is orphaned on mobile.
- Desktop has Discover in top tabs; mobile buries Bills / Games / Discover under **More**.
- “Invite” button just switches to the Members tab — no invite sheet.
- Knot switcher can remain visually “selected” while viewing Home — state mismatch.

### One-job-per-section violations
HangoutCard (~1016 lines) mixes: status, title, venue, brief, votes, RSVP, outbound booking (Uber/Lyft/OpenTable/Resy/Viator/GetYourGuide), pre-order, video call, live photo, post-hangout loop, bills, crew roles, and comments. That is a product surface, not a card.

---

## 4. Surface-by-surface critique

### 4.1 Landing (`app/page.tsx`)
- Centered logo + headline is fine; brand is hero-level.
- Feature pill cluster and merchant footer link dilute the first viewport.
- No social proof, no product screenshot, no people imagery.
- Auth forms are clean but utilitarian.

### 4.2 Dashboard shell
- Sticky 52px bar is serviceable.
- Cover banner with emoji placeholder is weak; gray gradient with a giant emoji does not sell “our circle.”
- Member stack always paints yellow initials — ignores `MEMBER_COLORS` and profile photos.
- Sidebar “About” uses decorative `⊕` placeholders — unfinished iconography.
- Empty recent media renders **6 blank gray tiles** that look like broken images, not an empty state.

### 4.3 Home feed (`HomeFeed.tsx`) — critical social miss
- Cards look decent (16px radius, light shadow, knot badges).
- Entire card click only opens the Knot — **no like, comment, react, or deep-link to the post**.
- “View” is static yellow text, not a control.
- Activity types use letter glyphs (`$`, `?`, `!`, `T`) instead of icons or media.
- Avatars = initials only.
- Empty state has no CTA (“Start a hangout” / “Post a moment”).

A social home feed that cannot be engaged with is an activity log.

### 4.4 Discussion / Feed (`Feed.tsx`)
- Top stat strip (Tonight / Members / Bills) pushes the composer down and duplicates Composer + sidebar.
- Moments render as log lines (`Author` + `action`), not posts with clear hierarchy.
- Reactions: button says `+ React` and writes the string `'heart'` — UI shows `heart N`, not ♥. Broken for a social product.
- Comments hidden behind collapse — feed feels dead.
- Avatar colors (pastel hash) disagree with Home/Dashboard (solid yellow).

### 4.5 Composer
- Moment uses single-line `<input>` — discourages real posts; social products use multiline.
- Hangout form is dense (vibe + budget + when + where modes). High abandon risk.
- Embedding full Discover inside Where explodes height.
- Dead `whereMode: 'manual'` branch with no UI.
- Errors styled in yellow-soft — look like tips.

### 4.6 HangoutCard — worst UX density
Action row can surface 8+ equal-weight chips: We are here, End night, Join call, Directions, Uber, Lyft, OpenTable, Resy, Viator, GetYourGuide, Virtual experiences, Edit, Cancel.

Outbound affiliate tools outrank the social core (who’s going, what’s the vibe, talk about it).

Comment tools labeled `"P"` and `"L"` (photo / location) are unfinished iconography.

RSVP is shown three ways (name chips + Going/Maybe/Can’t + count). Votes are one-shot with no change-of-mind.

Live dark card is the only rich visual moment in the product — evidence that atmosphere is possible and unused elsewhere.

### 4.7 Discover
- Category grid defines mood emojis but **never renders them** — barren text tiles in a 4-col grid.
- 4-col categories + group size crush on mobile.
- GPS denial silently defaults to Mississauga — surprising for non-GTA users.
- Standalone Discover “lock-in” does not create a hangout — dead-end vs Composer embed path.
- “Top Pick” sticker on first result is promotional chrome on a private-circle tool.

### 4.8 Members
- 2-col grid with no mobile collapse.
- Invite generation can fail silently.
- Vote UX inconsistent (Abstain immediate; Yes/No need Submit).
- Splinter creates `'New Knot'` + full page reload.
- No presence, last active, or profile beyond name/role.
- Source mojibake in comments (`â€"`).

### 4.9 Media / Memories
- Strongest polished surface (upload, captions, hangout linking, lightbox comments).
- Stats strip feels dashboard-y atop an album.
- 3-col grid too tight on phones.
- Upload `accept="image/*"` while Feed supports video — inconsistency.
- Loading is plain text.

### 4.10 Notifications
- Opening dropdown marks **all** read immediately — badge vanishes before scanning.
- Type avatar shows first two letters of type (`NE`, `BI`), not actor identity.
- No deep-link to the entity (post/hangout) — only selects knot.
- Fixed 340px panel will clip on small screens.

### 4.11 Bills
- Most coherent interaction model (owed/owe, balances, activity).
- Visually consistent with tokens.
- Finance polish exceeds social polish — inverted priorities for a social product.

### 4.12 Invite page
- **Encoding corruption** on trust-critical surface: `Ã¢ÂÅ’`, `Ã°Å¸â€Â`, `—`. Looks broken.
- Emoji reliance; logo ring color differs from landing.

### 4.13 Merchant
- Hardcoded hex fork of the design system.
- Emoji feature rows; auth Enter key always wired to sign-up path.
- Divergent from consumer app — feels bolted on.

---

## 5. Social & collaboration gaps (vs category expectations)

Compared to what users expect from private social + group planning tools:

| Expectation | Knot today |
|---|---|
| Faces of the circle everywhere | Initials; photos rarely propagate |
| Easy reactions / emoji | `+ React` → literal `heart` string |
| Visible conversation | Comments collapsed by default |
| “Who’s free / who’s going” at a glance | Buried in HangoutCard; Home Events has no RSVP preview |
| Live presence / online | Missing |
| Feed you can act on | Home feed is teaser-only |
| Clear plan object | Hangout overloaded with booking chips |
| Celebrate moments (RSVP, lock-in, photo) | No motion / feedback |
| Trustworthy invites | Mojibake + native `alert`s |
| Mobile-first social chrome | Bottom nav text-only; Home orphaned |

**Collaboration that works but doesn’t feel collaborative:** bill split, hangout RSVP, member voting, crew roles. These are solid feature-wise and weak presentation-wise.

---

## 6. Interaction & state maturity

| Pattern | Assessment |
|---|---|
| Empty states | Mixed — Feed/Memories/Bills OK; media sidebar fake tiles; HomeFeed no CTA |
| Loading | Almost everywhere: `"Loading..."` text; shimmer CSS unused |
| Errors | Yellow soft boxes; silent fails (invite generate, live photo upload); native `alert`/`confirm` for destructive actions |
| Toasts | None — no in-product feedback system |
| Realtime | Notifications exist; feeds feel one-shot |
| Destructive UX | Browser `confirm()` — breaks immersion |

---

## 7. Mobile UX

- Breakpoints at 768px via a few CSS classes — not a mobile-first layout.
- Crush points: Members 2-col, Discover 4-col, Feed 3-stat strip, Memories 3-col, HangoutCard chip wrap.
- Bottom nav: labels only, no icons, no Home entry.
- Touch targets often 32–34px square — below comfortable 44px.
- No safe-area / notch handling beyond `paddingBottom: 80` on knot layout.

---

## 8. Accessibility

- Essentially no `aria-*` / roles.
- Icon buttons labeled with letters (`P`, `L`) or missing labels.
- Color-only active states (yellow underline/text).
- Hover-only interactivity without keyboard equivalents.
- Images often without meaningful `alt`.
- Toggle switches are `div`s, not buttons/switches.

Not shippable as an inclusive social product in current form.

---

## 9. Severity-ranked backlog

### P0 — breaks social credibility
1. Fix reactions (real heart/emoji UI; stop storing/displaying raw `'heart'` text).
2. Fix invite page encoding / glyphs.
3. Replace `"P"` / `"L"` / `$` / `?` letter placeholders with real icons (Lucide is already a dependency).
4. Stop using yellow for errors; use `--danger` / sage correctly.
5. Make Home feed actionable (open post, show counts) or stop calling it a feed.

### P1 — hierarchy & density
6. Split HangoutCard: primary actions (RSVP, Join call, We’re here) vs overflow “Get there / Book” menu.
7. Rename tabs to plain language (Feed / Plans / Photos / People) or equivalent.
8. Unify Avatar component (photo → initials fallback; one color system).
9. Collapse Discover / Members / Memories grids on mobile; add Home to bottom nav with icons.
10. Replace blank media tiles and `⊕` placeholders with real empty states / icons.

### P2 — system & polish
11. Extract Button / Input / Avatar / Sheet / Toast / EmptyState primitives; start killing inline styles.
12. Use Radix for dialogs (kill `alert`/`confirm`).
13. Wire skeleton shimmer; add 2–3 intentional motions (RSVP, post, lock-in).
14. Landing: kill feature pills; one composition with people/place imagery and brand-first hero.
15. Notifications: don’t mark-all-read on open; deep-link to entity; show actor avatar.
16. Composer: textarea for moments; simplify hangout steps; don’t embed full Discover inline.
17. Accessibility pass (focus rings, labels, roles, 44px targets).

---

## 10. What “good” looks like for Knot

A private social + collaboration product should feel like:

- **Opening the app:** faces of your circle, what’s live tonight, unread chatter — not a SaaS dashboard.
- **Discussion:** posts with media, reactions, and open conversation — not an activity log.
- **Plans:** one clear hangout object — who’s in, where, when — with booking tools secondary.
- **Photos:** a shared album that feels precious, not a CMS with stat cards.
- **Invite:** trustworthy, beautiful, zero encoding bugs.

Knot already has most of the verbs. It needs a visual and interaction pass so those verbs feel human.

---

## Appendix — surface scorecard

| Surface | Visual consistency | Social depth | Mobile | Finish |
|---|---|---|---|---|
| Landing | Med | n/a | OK | Med |
| Dashboard shell | Med | Low | Med | Med |
| HomeFeed | Med–High | Low | Med | Med |
| Feed + Composer | Med | Med | Low–Med | Med |
| HangoutCard | Low | High but buried | Low | Uneven |
| Discover | Med | Low | Low | Med–High |
| Members | Med | Med | Low | Med |
| Memories | Med–High | Med | Low | High |
| Notifications | Med | Low | Med | Med |
| Bills | High | n/a | Med | High |
| Invite | Low | High intent | OK | Low |
| Merchant | Divergent | n/a | OK | Low–Med |

*Audit based on codebase review of `app/` and `components/` (Aug 2026). Visual QA against live authenticated sessions was limited by missing local Supabase env in this environment; findings are grounded in source structure and styles.*
