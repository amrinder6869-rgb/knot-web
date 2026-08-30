# Knot - Development Standards

NODE Kollective Inc. | Document 04 | August 2026 | Confidential

---

## 1. General Principles

- **Build wide, instrument everything, prune with data.** Features are added broadly during the prototype phase and killed by pre-set kill numbers from real usage data. Quarterly portfolio reviews with product and engineering assess what stays, what grows, and what gets cut.
- **Atomic RPC over multi-step chains.** Any operation that writes to multiple tables and must succeed or fail as a unit must use a SECURITY DEFINER Postgres function called as a single RPC. Never use sequential API calls for multi-table writes.
- **Check schema before every migration.** Query `information_schema.columns` and `pg_policies` before writing any migration. Duplicate column or policy errors are preventable and halt migrations.
- **No hallucinated numbers for investors.** Every financial assumption must be verified against a primary source before inclusion in investor materials. The rideshare affiliate line is structurally invalid in the GTA due to near-100% Uber penetration. OpenTable affiliate revenue is zero until 100 monthly referred covers are reached consistently.
- **Walkthrough ritual before marking any sprint done.** Two-account phone walkthrough covering the core flows of the sprint. No sprint is marked complete without this.
- **Copy pass before marking any sprint done.** Every sprint that adds user-facing strings must include a copy pass. All new strings go into lib/copy.ts. No strings are hardcoded inline. See Document 06 for the full copy system.

---

## 2. File Editing Protocol (Windows Environment)

The development machine runs Windows. The following protocols are mandatory to prevent silent data corruption.

- **All file writes must use Node.js scripts.** Never use PowerShell heredocs for writing file content. PowerShell heredoc encoding corrupts UTF-8 content silently.
- **Never chain commands with && in PowerShell.** PowerShell does not support && as a command separator. Use separate commands or a Node.js script.
- **Emoji and special characters** in source files must use `String.fromCodePoint()` or Unicode escape sequences in the generating script. Never paste emoji directly into file content via PowerShell.
- **For complex multi-location edits**, prefer full file replacement over partial edits. Partial edits on files that have diverged from a known state produce unpredictable results.
- **When patching a file that may have diverged**, fetch the clean source from GitHub before applying any replacement. GitHub raw URL pattern: `https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/[filepath]`
- **Git commands must use the full binary path:** `& "C:\Program Files\Git\bin\git.exe" [command]` Git is not in the system PATH on this machine.

---

## 3. Database Migration Protocol

- Always run `information_schema.columns` queries before adding columns. Duplicate column errors halt migrations.
- Always run `pg_policies` queries before adding RLS policies. Duplicate policy errors halt migrations.
- Wrap RLS policy creation in idempotent `DO $$ BEGIN IF NOT EXISTS ... END $$` blocks.
- After creating any new table that needs Realtime, run `ALTER PUBLICATION supabase_realtime ADD TABLE tablename` as a separate migration step after the table and policies are confirmed.
- Supabase MCP multi-statement queries return only the last result. Run one statement per MCP call when you need to see the result of each.

---

## 4. SECURITY DEFINER Function Protocol

Every SECURITY DEFINER Postgres function must follow this pattern without exception.

```sql
-- Step 1: Create the function
CREATE OR REPLACE FUNCTION function_name(...)
RETURNS ... 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- function body
END;
$$;

-- Step 2: Revoke public access immediately after creation
REVOKE EXECUTE ON FUNCTION function_name FROM PUBLIC;

-- Step 3: Grant access to authenticated users only
GRANT EXECUTE ON FUNCTION function_name TO authenticated;
```

Both steps 2 and 3 are mandatory on every new SECURITY DEFINER function. They are not optional. A function created without them is accessible to unauthenticated callers.

---

## 5. Sprint Protocol

- Each sprint has a single clear deliverable defined before engineering begins.
- No sprint bundles multiple unrelated features.
- Every sprint follows this loop: define scope, update schema if needed, build backend, build UI, manual test, deploy to Vercel, verify deployment.
- No sprint is marked done without a two-account phone walkthrough of the core flows.
- No sprint is marked done without a copy pass on all new user-facing strings.
- Feature-gated sprints (Sprint F and Sprint G) must not begin until the behavioural gate from cohort data is met.

---

## 6. Cursor Handoff Pattern

When handing off file edits to an external editor, structure the prompt with explicit instructions in this order:

1. Check existing RLS policies before adding any new policies.
2. Read the current file content before editing.
3. Apply only the changes described. Do not refactor adjacent code.
4. Run the build after each change to confirm nothing broke.

Do not hand off multiple unrelated edits in a single prompt. One concern per prompt produces cleaner results.

---

## 7. Instrumentation Standards

Instrumentation is Sprint C scope. The following standards apply from Sprint C onward.

- All product events are logged to the events table via `lib/track.ts`.
- Feature flags are managed via the feature_flags table and `lib/flags.ts`.
- Every sprint hypothesis must have a defined kill number before engineering begins. A kill number is the usage threshold below which the feature is removed.
- Portfolio review happens quarterly. Features are assessed against current kill number data and categorised accordingly.

---

## 8. Stripe and Payment Protocol

- All Stripe webhook handlers must verify the `Stripe-Signature` header before processing any webhook payload. Missing this is a replay attack vulnerability and a Sprint B fix.
- All Stripe commission calculations must be based on the net amount after Stripe fees, not the gross transaction value. Net to Knot per CAD 40 Knot Special at 10% commission is approximately CAD 2.54, not CAD 4.00. Stripe takes 2.9% plus CAD 0.30.
- Apple and Google IAP must be avoided for premium subscriptions and Knot Specials. Route all commerce through web checkout to avoid the 15 to 30% platform commission. This is the single most impactful financial decision in the monetisation model.

---

## 9. Google Places API Protocol

- All Places API calls are made server-side only via the proxy route. The API key is never passed in client-side URL parameters.
- `place_id` is the stable linking key between Supabase records and Google Places results. Use `place_id` for all joins and lookups. Never rely on venue name as a key.
- The server-side proxy route follows HTTP redirects on photo URLs. Do not attempt to serve Places photo URLs directly to the client.
- Free tier: 5,000 calls per month per SKU. Cost above this is approximately CAD 0.046 per search query. The free tier is exhausted at approximately 4,500 MAU at 2 searches per MAU with a 20% cache miss rate.

---

*NODE Kollective Inc. | Knot Development Standards | Document 04 | August 2026 | Confidential*
