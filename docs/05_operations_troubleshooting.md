# Knot - Operations and Troubleshooting Guide

NODE Kollective Inc. | Document 05 | August 2026 | Confidential

---

## 1. Environment Reference

| Detail | Value |
|---|---|
| Supabase project ID | vcrnktkttgprbnoyjeff |
| Supabase region | ca-central-1 |
| Vercel team ID | team_K7Ugwh6aScNisATEGFUq3eQX |
| Production URL | knot-web-am-woad.vercel.app |
| GitHub repo | amrinder6869-rgb/knot-web |
| Local repo path (Windows) | C:\Users\amrin\Documents\knot-web |
| Git binary path (Windows) | "C:\Program Files\Git\bin\git.exe" |
| Test Knot name | Toronto Crew |
| Test Knot ID | f3506a80-eb2c-4d61-a784-ef4f25cbbcc0 |
| Planning agent UUID | b1d28ee7-8aa2-416c-a8fa-ccc260edd431 |
| Planning agent email | agent@knot.app |
| GitHub raw URL pattern | https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/[filepath] |

---

## 2. Environment Variables

Set in Vercel dashboard and in the local `.env.local` file.

| Variable | Purpose |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL. |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anonymous key for client-side auth. |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key for server-side admin operations. Never expose client-side. |
| NEXT_PUBLIC_GOOGLE_PLACES_API_KEY | Google Places API key. Used server-side only via the places proxy route. Never passed in client URL parameters. |
| ANTHROPIC_API_KEY | API key for the planning assistant. |
| STRIPE_SECRET_KEY | Stripe secret key for server-side payment operations. |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret for verifying webhook payloads. |
| KNOT_AGENT_USER_ID | UUID of the planning assistant user account in Supabase Auth. |
| NEXT_PUBLIC_KNOT_AGENT_USER_ID | Public-safe version of the agent UUID for client-side agent message detection. |
| RESEND_API_KEY | Resend API key for transactional email. |
| DAILY_API_KEY | Daily.co API key for video room creation. |

---

## 3. Local Development Setup

### Prerequisites
- Node.js 18 or higher.
- npm or yarn.
- Git installed at `C:\Program Files\Git\bin\git.exe` on Windows.

### Setup steps
1. Clone the repository from amrinder6869-rgb/knot-web.
2. Copy `.env.local.example` to `.env.local` and populate all required variables.
3. Run `npm install`.
4. Run `npm run dev` to start the local development server.
5. Verify the Supabase project ID matches vcrnktkttgprbnoyjeff in the environment config before running any migrations.

### Running the linter

```bash
npx eslint . --ext .tsx,.ts
```

Current state: multiple warnings present, zero blocking errors. The build compiles successfully. Warnings are documented in Document 03 Section 4.

---

## 4. Deployment

### Deploy to Vercel
Deployment is automatic on push to the master branch. Vercel builds and deploys on every push. Preview deployments are created for every branch push automatically.

### Verify a deployment
Use the Vercel dashboard or Vercel MCP integration to list deployments and confirm build status. Runtime logs are filterable by query string and by the `since` parameter.

### Rollback
Redeploy a prior successful deployment from the Vercel dashboard. Do not push a revert commit if the issue is in the database schema. Schema changes do not roll back with code reverts.

---

## 5. Database Operations

### Running a migration
Use the Supabase MCP `apply_migration` tool with a migration name and the SQL query.

Before any migration, run these checks:

```sql
-- Check existing columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tablename' 
ORDER BY ordinal_position;

-- Check existing RLS policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'tablename';
```

### Realtime setup on new tables
After creating a new table and confirming its policies:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE tablename;
```

This must be a separate migration step, not bundled with table creation.

### Inspecting data
Use Supabase MCP `execute_sql` for read-only queries. Multi-statement queries return only the last result. Run one query per call when you need to see each result.

---

## 6. Known Failure Patterns

### PowerShell file writes produce corrupted files
**Cause:** PowerShell heredoc encodes content differently than UTF-8. Multi-line strings and emoji are silently corrupted.
**Fix:** Always write files using a Node.js script. Never use PowerShell heredocs for file content.

### Git commands fail with command not found
**Cause:** Git is not in the Windows system PATH on this machine.
**Fix:** Use the full path: `& "C:\Program Files\Git\bin\git.exe" [command]`

### Supabase migration fails with duplicate column error
**Cause:** The column was added in a previous migration that was not tracked, or the migration was run twice.
**Fix:** Query `information_schema.columns` before every migration. Wrap column additions in `IF NOT EXISTS` blocks where the syntax permits.

### Supabase migration fails with duplicate policy error
**Cause:** The RLS policy was added in a previous migration or directly in the dashboard.
**Fix:** Query `pg_policies` before every migration. Wrap policy creation in `DO $$ BEGIN IF NOT EXISTS ... END $$` blocks.

### planning_status shows the wrong value
**Cause:** `planning_status` is a derived field computed in `lib/hangoutPhase.ts`. It should never be written directly.
**Fix:** Inspect the raw hangout record fields in Supabase. Compare against the derivation logic in `lib/hangoutPhase.ts`. Do not write `planning_status` directly to the database.

### Planning assistant returns wrong city venue results
**Cause:** Known unresolved issue. The `venueSearchQuery` field is not resolving the sender city correctly in some sessions.
**Fix:** Inspect the `venueSearchQuery` value in the planning agent API route logs. Confirm the sender city is being passed correctly in the request context.

### Double agent messages after venue card tap
**Cause:** Known unresolved issue. The venue card tap is triggering two separate planning assistant calls in some sessions.
**Fix:** Inspect the client-side event handler on venue card taps in HangoutChatView.tsx. Confirm no duplicate event is being fired.

### Stripe webhook events processed twice
**Cause:** Missing `Stripe-Signature` header verification allows replayed webhooks to be processed.
**Fix:** Sprint B item. Add `Stripe-Signature` verification as the first step in every Stripe webhook handler before any business logic runs.

### Daily.co rooms accessible without authentication
**Cause:** Unauthenticated room access is enabled in the current Daily.co configuration.
**Fix:** Sprint B item. Update Daily.co room creation to require token-based authentication. Verify the DailyCall component passes a valid token when joining.

### Ludo game pieces disappear during play
**Cause:** Ludo path-position rendering is not implemented. Pieces disappear when they move from home positions onto the path.
**Fix:** Either implement path rendering using the piecesHere variable pattern already present in Ludo.tsx, or gate the game behind a feature flag in `lib/flags.ts` until the implementation is complete.

### New user sees blank Home screen
**Cause:** `showHome` initialises as true in `app/dashboard/page.tsx`. The empty state with the create-Knot prompt only renders when `showHome` is false. A user with zero Knots arrives at a blank screen.
**Fix:** After Knots are fetched, add `if (knots.length === 0) setShowHome(false)`. Or render the empty state inline within the `showHome === true` branch when `knots.length === 0`.

### Bottom nav taps appear to do nothing
**Cause:** Tab changes in the bottom nav do not reset `showHome` state. If `showHome` is true, the home view renders on top of the selected tab regardless of which tab was tapped.
**Fix:** Add `setShowHome(false)` at the top of the tab-change handler in `app/dashboard/page.tsx` before setting the active tab.

---

## 7. Cron Jobs

| Job | Schedule | Purpose |
|---|---|---|
| archive-stale-plans-daily | 0 9 * * * UTC | Archives hangout plans that have exceeded the inactivity threshold without being confirmed or cancelled. |

---

## 8. Supabase Storage

- The `hangout-covers` bucket holds Knot cover photos and event cover images.
- All storage buckets are private. Access is via signed URLs only.
- User media (photos posted in moments and memories) is stored in private buckets. No media is publicly accessible without explicit user export.

---

## 9. Supplementary Reference Documents

The following documents are archived as supplementary reference material. They should not be treated as the current authoritative source on any topic. The six primary documents in this knowledge base supersede them for all current-state questions.

| Document | Use |
|---|---|
| Knot_Product_Definition.docx | Full product vision including features not yet built. Useful for understanding the intended long-term product surface but contains aspirational content that has not been implemented. |
| Knot_Composer_Architecture_Handoff.docx | Full composer architecture session from August 2026. Contains the complete 51-scenario validation set, full chip system specification, agent contract detail, and ComposerStatePayload specification. Document 02 summarises the locked decisions. This is the reference for implementation detail. |
| Knot_Fix_Plan.docx | Source-code review from June 2026. Some issues have since been resolved. Open issues are documented in Document 03 Section 4. |
| Knot_Cost_Model_v1_July2026.docx | Full 24-month infrastructure cost model with variable, fixed, and step cost classifications by service. Reference for any investor conversation involving operational costs. |
| Knot_Revenue_Opportunities_2026.docx | Full revenue opportunity map across all ten revenue types with partner programs, commission rates, and phase activation timing. Reference for any investor conversation involving revenue model detail. |

---

*NODE Kollective Inc. | Knot Operations and Troubleshooting Guide | Document 05 | August 2026 | Confidential*
