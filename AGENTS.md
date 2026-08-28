<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

`knot-web` is a Next.js 16 (App Router) app whose entire backend is **Supabase**
(auth + Postgres + Storage). Standard scripts live in `package.json` (`dev`,
`build`, `start`, `lint`); the update script already runs `npm install`.

### Backend: local Supabase (required to get past the login screen)
The repo ships no hosted credentials, so local development uses a local Supabase
stack. Docker and the Supabase CLI are preinstalled in the VM snapshot, and the
schema lives in `supabase/migrations/` (reverse-engineered from the client
queries: 17 tables, a `handle_new_user` trigger that auto-creates a `profiles`
row on signup, and the public `knot-photos` storage bucket).

Start everything (each fresh session) with:

```bash
# 1. Docker daemon is not auto-started in the VM; start it once per session.
sudo nohup dockerd > /tmp/dockerd.log 2>&1 &   # wait ~8s
sudo chmod 666 /var/run/docker.sock            # let non-root use docker

# 2. Bring up Supabase (URL http://127.0.0.1:54321, Studio :54323).
cd /workspace && supabase start

# 3. Apply the schema (only needed the first time after a fresh `supabase start`,
#    or whenever migrations change). NOTE: db reset wipes all local data.
supabase db reset

# 4. Run the app.
npm run dev    # http://localhost:3000
```

### Environment variables (`.env.local`, git-ignored)
The app reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
The local stack uses fixed, well-known defaults, so recreate `.env.local` if it
is missing:

```bash
cat > /workspace/.env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
EOF
```
`GOOGLE_PLACES_API_KEY` is optional — only the **Discover** tab uses it; every
other feature works without it.

### Gotchas
- Email confirmation is disabled (`supabase/config.toml`: `enable_confirmations =
  false`), so a signed-up account can sign in immediately. The signup screen
  still shows "Check your email…" and does **not** auto-redirect — switch to
  "Sign in" and log in to reach `/dashboard`.
- `supabase db reset` skips any migration literally named `*_init.sql`; that is
  why the schema file is `00000000000001_schema.sql`.
- Local dev uses broad `anon`/`authenticated` grants with RLS left disabled
  (see the migration). This is intentional for local dev only, not production.
- Docker uses the `fuse-overlayfs` storage driver with the containerd snapshotter
  disabled (`/etc/docker/daemon.json`) — required for Docker to run in this VM.
- `npm run lint` currently reports pre-existing errors in the app code
  (`@typescript-eslint/no-explicit-any`, a `react-hooks` rule). These are not
  environment issues; the lint command itself works.
