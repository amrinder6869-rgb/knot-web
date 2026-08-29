import { NextResponse } from 'next/server'
import https from 'https'
import { createClient } from '@supabase/supabase-js'
import { getRandom, AGENT_MESSAGES, PLANNER_NUDGE, AGENT_VENUE_PROMPT, PLAN_UNTITLED, CTA_CONFIRM } from '@/lib/copy'
import { biasVenueQuery, parseScheduledFor, timeZoneForCity } from '@/lib/parseScheduledFor'

const NUDGE_THRESHOLD_MS = 48 * 60 * 60 * 1000

const SYSTEM_PROMPT = `You are Knot, the planning assistant living inside a private friend group chat. You are a participant in an ongoing conversation, not a one-shot bot. You read the full conversation history before every reply so you never forget what the group already decided.

Your job across the conversation:
1. Help the group fill in the three core plan fields: when, where, and who is coming.
2. Ask at most one clarifying question per reply. Never ask two things at once.
3. Propose specific options when the group is vague. Do not ask open-ended questions when you can propose concrete chips instead.
4. When a chip is tapped (a value confirmed), acknowledge it in one short sentence and move to the next open field.
5. When all three core fields are filled, suggest the group locks it in.

Tone: the sharpest person in the group chat. Short. Present tense. No hedging. No exclamation points. No em dashes. Never say "Great", "Sure", "Of course", "Sounds good", "We've got X locked in", "I'd be happy to", or anything that sounds like a support bot. If you would not say it to a friend, do not write it.

agent_message must be one or two short sentences maximum. Never more than 20 words total. Examples of correct tone: "Boston Pizza is locked. Switch to KFC?" or "Done. KFC it is." or "Saturday works. Where are you thinking?"

You have access to the current plan state and the full conversation so far. Read both before responding. Do not repeat information the group already confirmed.

Respond only with valid JSON:
{
  "agent_message": string | null,
  "chips": [{ "label": string, "action": string, "value": any }] | null,
  "plan_updates": { field: value } | null,
  "todo_updates": [{ "member_id": string, "type": "rsvp" | "poll" | "bill", "ref_id": string }] | null,
  "revenue_suggestion": { "type": "opentable" | "uber" | "mixtiles" | "lyft", "label": string, "url": string } | null,
  "venueSearchQuery": string | null
}

Rules:
- agent_message null only when the message has zero planning relevance. Never null when venueSearchQuery is set.
- Weak planning intent with no extractable fields (for example "thinking about a hangout") is still planning. Produce a short clarifying question, never a null agent_message. Example: "What are we doing?" plus chips of activity types.
- chips maximum three. Labels maximum three words each.
- plan_updates only when a chip has been tapped confirming a value, or the user explicitly states a confirmed value. Never from inference alone. Exception: plan_updates.title on the first message that introduces a plan.
- scheduled_for may be ISO 8601 or a natural phrase like "Saturday 7pm" or "Friday at 8pm". Prefer ISO when you can.
- When asked who is coming, answer from the RSVP list in the context. Do not ask a generic headcount question if RSVP data is present.
- revenue_suggestion only when directly relevant to what was just discussed. One per message maximum. Never unsolicited.
- If two members propose conflicting values, return agent_message describing the conflict and plan_updates as null.
- venueSearchQuery: set whenever the message contains a named venue, a venue type or category, a phrase asking for suggestions, or an activity implying a venue. Format: "[venue type or name] near [city]". Always include the sender city after near. Whenever venueSearchQuery is set, agent_message must be exactly "Here are some options nearby." Never set venueSearchQuery alongside plan_updates.venue_name in the same reply.

Title rules (plan_updates.title) — the only field you may infer on the opening message of a new plan:
- Named venue mentioned: title is the venue name.
- Activity mentioned with no venue: title is the activity.
- Occasion mentioned: use it. "Birthday drinks for Simar" becomes "Simar's birthday drinks".
- Set title to null when the message carries zero planning intent.
- Never overwrite an already-confirmed title from inference; changing an existing title requires a tapped chip.`

const ALLOWED_PLAN_FIELDS = new Set([
  'title', 'venue_name', 'venue_address', 'scheduled_for', 'status',
  'brief', 'brief_vibe', 'brief_budget',
])

const ALLOWED_HANGOUT_STATUS = new Set(['voting', 'confirmed', 'live', 'ended', 'locked', 'cancelled'])

function filterPlanUpdates(
  updates: Record<string, any> | null,
  existingScheduledFor: string | null | undefined,
  timeZone: string,
): Record<string, any> | null {
  if (!updates) return null
  const out: Record<string, any> = {}
  for (const key of Object.keys(updates)) {
    if (ALLOWED_PLAN_FIELDS.has(key)) out[key] = updates[key]
  }
  if ('scheduled_for' in out) {
    const iso = parseScheduledFor(out.scheduled_for, existingScheduledFor, timeZone)
    if (iso) out.scheduled_for = iso
    else delete out.scheduled_for
  }
  if ('status' in out && !ALLOWED_HANGOUT_STATUS.has(String(out.status))) {
    delete out.status
  }
  return Object.keys(out).length > 0 ? out : null
}

function formatRsvpContext(rows: { status: string; profiles?: { name?: string } | { name?: string }[] | null }[] | null): string {
  if (!rows || rows.length === 0) return 'RSVPs: No responses yet.'
  const nameOf = (row: { profiles?: { name?: string } | { name?: string }[] | null }) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return profile?.name?.trim() || ''
  }
  const names = (statuses: string[]) => {
    const list = rows.map(r => statuses.includes(r.status) ? nameOf(r) : '').filter(Boolean)
    return list.length ? list.join(', ') : 'none'
  }
  return `RSVPs: Going: ${names(['yes', 'going'])}. Maybe: ${names(['maybe'])}. Can't go: ${names(['no', 'declined'])}.`
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res: any) => {
      let body = ''
      res.on('data', (chunk: any) => body += chunk)
      res.on('end', () => resolve(body))
    }).on('error', reject)
  })
}

async function searchVenues(query: string, token: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return []
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
    const body = await httpsGet(url)
    const data = JSON.parse(body)
    if (data.status !== 'OK') return []
    return (data.results || []).slice(0, 3).map((p: any) => ({
      place_id: p.place_id,
      name: p.name,
      formatted_address: p.formatted_address || '',
      rating: p.rating ?? null,
      open_now: p.opening_hours?.open_now ?? null,
      photo_url: p.photos?.[0]?.photo_reference
        ? `/api/place-photo?ref=${encodeURIComponent(p.photos[0].photo_reference)}&t=${encodeURIComponent(token)}`
        : null,
    }))
  } catch {
    return []
  }
}

async function welcomeForHangout(
  serviceClient: any,
  hangoutId: string,
  agentUserId: string,
) {
  const { count } = await serviceClient
    .from('hangout_messages')
    .select('id', { count: 'exact', head: true })
    .eq('hangout_id', hangoutId)
  if ((count || 0) > 0) {
    return { agent_message: null, chips: null, venue_suggestions: null as any[] | null }
  }

  const { data: hangout } = await serviceClient
    .from('hangouts')
    .select('id, title, planning_status, status, scheduled_for, venue_name, venue_address')
    .eq('id', hangoutId)
    .maybeSingle()
  if (!hangout) {
    return { agent_message: null, chips: null, venue_suggestions: null as any[] | null }
  }

  const phase = String(hangout.planning_status || hangout.status || 'voting')
  const title = (hangout.title || '').trim()
  const untitled = !title || title === PLAN_UNTITLED || title === 'Hangout'
  let agentMessage = getRandom(AGENT_MESSAGES.WELCOME)
  let chips: { label: string; action: string; value: any }[] | null = null

  if (phase === 'confirmed' || phase === 'locked') {
    const when = hangout.scheduled_for
      ? new Date(hangout.scheduled_for).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : null
    const summary = [title || PLAN_UNTITLED, when, hangout.venue_name].filter(Boolean).join(' · ')
    agentMessage = summary ? `Locked in. See you there. ${summary}` : 'Locked in. See you there.'
    chips = [{ label: CTA_CONFIRM, action: 'lock', value: true }]
  } else if (phase === 'live') {
    agentMessage = "It's happening. Drop some photos."
    chips = [{ label: 'Photo', action: 'camera', value: 'photo' }]
  } else if (untitled) {
    agentMessage = 'What are we doing?'
    chips = null
  } else if (!hangout.scheduled_for) {
    agentMessage = 'When are you thinking?'
    chips = [
      { label: 'Today', action: 'when', value: 'today' },
      { label: 'This Friday', action: 'when', value: 'friday' },
      { label: 'This Weekend', action: 'when', value: 'weekend' },
    ]
  } else if (!hangout.venue_name) {
    agentMessage = 'Where are you going?'
  }

  if (agentMessage) {
    const { error: welcomeError } = await serviceClient.from('hangout_messages').insert({
      hangout_id: hangoutId,
      author_id: agentUserId,
      content: agentMessage,
    })
    if (welcomeError) console.error('[planning-agent] welcome insert failed:', welcomeError)
  }

  return {
    agent_message: agentMessage,
    chips,
    venue_suggestions: null as any[] | null,
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const agentUserId = process.env.KNOT_AGENT_USER_ID
  if (!agentUserId) return NextResponse.json({ error: 'Agent not configured' }, { status: 500 })

  try {
    const { message, hangout_id, knot_id, current_plan_state, detection_mode } = await request.json()
    if (!message || typeof message !== 'string' || !message.trim() || !knot_id) {
      return NextResponse.json({ error: 'Missing message or knot_id' }, { status: 400 })
    }

    const senderId = user.id

    const { data: membership } = await userClient
      .from('knot_members')
      .select('user_id')
      .eq('knot_id', knot_id)
      .eq('user_id', senderId)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Not a member of this knot' }, { status: 403 })

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (detection_mode) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return NextResponse.json({ plan_detected: false, agent_message: null })

      const detectionPrompt = [
        'You are detecting planning intent in a group chat message.',
        'Respond only with JSON: { "plan_detected": boolean, "agent_message": string | null }',
        'plan_detected is true when the message clearly suggests a group activity, meetup, event, or outing.',
        'agent_message is a short (max 10 words) message to show if plan_detected is true.',
        'Example: "Sounds like a plan. Want to make it official?"',
        'If plan_detected is false, agent_message must be null.',
      ].join('\n')

      try {
        const detectResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 100,
            system: detectionPrompt,
            messages: [{ role: 'user', content: message.trim() }],
          }),
        })

        if (!detectResponse.ok) {
          return NextResponse.json({ plan_detected: false, agent_message: null })
        }

        const detectData = await detectResponse.json()
        const detectText = detectData.content?.find((b: any) => b.type === 'text')?.text || '{}'
        const cleanText = detectText.replace(/```json|```/g, '').trim()
        const detectParsed = JSON.parse(cleanText)

        return NextResponse.json({
          plan_detected: !!detectParsed.plan_detected,
          agent_message: detectParsed.plan_detected ? (detectParsed.agent_message ?? null) : null,
        })
      } catch (err) {
        console.error('[planning-agent] detection_mode error:', err)
        return NextResponse.json({ plan_detected: false, agent_message: null })
      }
    }

    if (message.trim() === '__init__') {
      if (!hangout_id) return NextResponse.json({ error: 'Missing hangout_id' }, { status: 400 })
      const welcome = await welcomeForHangout(serviceClient, hangout_id, agentUserId)
      return NextResponse.json({
        agent_message: welcome.agent_message,
        chips: welcome.chips,
        plan_updates: null,
        todo_updates: null,
        revenue_suggestion: null,
        venue_suggestions: welcome.venue_suggestions,
        hangout_id,
      })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[planning-agent] ANTHROPIC_API_KEY missing')
      return NextResponse.json({ agent_message: null, chips: null, plan_updates: null, todo_updates: null, revenue_suggestion: null })
    }

    const { data: senderProfile } = await serviceClient
      .from('profiles')
      .select('resident_city, name')
      .eq('id', senderId)
      .maybeSingle()
    const locationHint = senderProfile?.resident_city?.trim() || 'Toronto'
    const senderName = senderProfile?.name?.trim() || 'Someone'

    // Fetch group members for context
    const { data: memberRows } = await serviceClient
      .from('knot_members')
      .select('profiles:user_id(id, name)')
      .eq('knot_id', knot_id)
    const memberNames = (memberRows || [])
      .map((r: any) => r.profiles?.name)
      .filter(Boolean)
      .join(', ')
    const memberCount = (memberRows || []).length

    let rsvpContext = 'RSVPs: No responses yet.'
    if (hangout_id) {
      const { data: rsvpRows } = await serviceClient
        .from('hangout_rsvps')
        .select('status, profiles:user_id(name)')
        .eq('hangout_id', hangout_id)
      rsvpContext = formatRsvpContext(rsvpRows as any)
    }

    // Fetch conversation history — last 12 messages for context window
    let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
    if (hangout_id) {
      const { data: recentMessages } = await serviceClient
        .from('hangout_messages')
        .select('author_id, content')
        .eq('hangout_id', hangout_id)
        .order('created_at', { ascending: false })
        .limit(12)
      if (recentMessages && recentMessages.length > 0) {
        // Reverse so oldest is first, exclude the current message (not yet inserted)
        conversationHistory = recentMessages
          .reverse()
          .filter((m: any) => m.content)
          .map((m: any) => ({
            role: m.author_id === agentUserId ? 'assistant' : 'user',
            content: m.content as string,
          }))
      }
    }

    // Build the final user turn with full context
    const contextBlock = [
      `Current plan state: ${current_plan_state ? JSON.stringify(current_plan_state) : 'no active plan yet'}`,
      `Group members (${memberCount}): ${memberNames || 'unknown'}`,
      rsvpContext,
      `Sender: ${senderName} (city: ${locationHint})`,
      `New message from ${senderName}: "${message.trim()}"`,
    ].join('\n')

    // Merge history + current message into the messages array
    // History messages go in as prior turns; the new context block is the final user turn
    const anthropicMessages: { role: 'user' | 'assistant'; content: string }[] = [
      ...conversationHistory,
      { role: 'user', content: contextBlock },
    ]

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: anthropicMessages,
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('[planning-agent] Anthropic API error:', response.status, errText)
      return NextResponse.json({ agent_message: null, chips: null, plan_updates: null, todo_updates: null, revenue_suggestion: null })
    }

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text || '{}'

    let parsed: any
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch (err) {
      console.error('[planning-agent] failed to parse model response as JSON:', err, 'raw text:', text)
      return NextResponse.json({ agent_message: null, chips: null, plan_updates: null, todo_updates: null, revenue_suggestion: null })
    }

    const timeZone = timeZoneForCity(locationHint)
    const planUpdates = filterPlanUpdates(
      parsed.plan_updates ?? null,
      current_plan_state?.scheduled_for ?? null,
      timeZone,
    )
    let resolvedHangoutId: string | null = hangout_id || null
    let agentMessage: string | null = parsed.agent_message ?? null

    let skipVenueSearch = false
    if (hangout_id && !current_plan_state?.venue_name) {
      const { data: lastMsg } = await serviceClient
        .from('hangout_messages')
        .select('content, author_id')
        .eq('hangout_id', hangout_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      skipVenueSearch = !!(lastMsg && lastMsg.author_id === agentUserId && lastMsg.content?.includes(AGENT_VENUE_PROMPT))
    }

    const rawVenueQuery: string | null = typeof parsed.venueSearchQuery === 'string' ? parsed.venueSearchQuery.trim() : null
    const venueSearchQuery = rawVenueQuery ? biasVenueQuery(rawVenueQuery, locationHint) : null
    let venueSuggestions: Awaited<ReturnType<typeof searchVenues>> = []
    if (venueSearchQuery && !skipVenueSearch) {
      venueSuggestions = await searchVenues(venueSearchQuery, token)
    }
    if (venueSearchQuery && !skipVenueSearch) agentMessage = AGENT_VENUE_PROMPT

    const wasExisting = !!resolvedHangoutId
    const needsHangout = !resolvedHangoutId && (planUpdates || agentMessage)

    if (needsHangout || wasExisting) {
      const wasNewPlan = !resolvedHangoutId
      let writeFailed = false

      let nudgeMessage: string | null = null
      if (wasExisting && resolvedHangoutId) {
        const { data: existing } = await serviceClient
          .from('hangouts')
          .select('last_planning_activity_at, planning_status')
          .eq('id', resolvedHangoutId)
          .maybeSingle()
        if (existing?.planning_status === 'planning' && existing.last_planning_activity_at) {
          const silentMs = Date.now() - new Date(existing.last_planning_activity_at).getTime()
          if (silentMs > NUDGE_THRESHOLD_MS) nudgeMessage = getRandom(PLANNER_NUDGE)
        }
      }

      if (wasNewPlan) {
        const { data: newHangout, error: createError } = await serviceClient
          .from('hangouts')
          .insert({ knot_id, created_by: senderId, status: 'voting', ...(planUpdates || {}) })
          .select('id')
          .single()
        if (createError || !newHangout) {
          console.error('[planning-agent] hangout insert failed:', createError)
          writeFailed = true
        } else {
          resolvedHangoutId = newHangout.id
        }
      } else if (planUpdates) {
        const { error: updateError } = await serviceClient
          .from('hangouts')
          .update(planUpdates)
          .eq('id', resolvedHangoutId)
        if (updateError) {
          console.error('[planning-agent] hangout update failed:', updateError, 'payload:', planUpdates)
          writeFailed = true
        }
      }

      if (writeFailed) {
        agentMessage = getRandom(AGENT_MESSAGES.CONFLICT)
      } else if (venueSuggestions.length === 0 && planUpdates && resolvedHangoutId) {
        if (wasNewPlan) agentMessage = getRandom(AGENT_MESSAGES.PLAN_CREATED)
        else if ('venue_name' in planUpdates || 'venue_address' in planUpdates) agentMessage = getRandom(AGENT_MESSAGES.VENUE_CONFIRMED)
        else if ('scheduled_for' in planUpdates) agentMessage = getRandom(AGENT_MESSAGES.TIME_CONFIRMED)
      }

      if (nudgeMessage) agentMessage = agentMessage ? `${agentMessage} ${nudgeMessage}` : nudgeMessage

      if (resolvedHangoutId) {
        const { error: activityError } = await serviceClient
          .from('hangouts')
          .update({ last_planning_activity_at: new Date().toISOString() })
          .eq('id', resolvedHangoutId)
        if (activityError) console.error('[planning-agent] last_planning_activity_at update failed:', activityError)
      }

      if (agentMessage && resolvedHangoutId) {
        const { error: messageError } = await serviceClient.from('hangout_messages').insert({
          hangout_id: resolvedHangoutId,
          author_id: agentUserId,
          content: agentMessage,
        })
        if (messageError) console.error('[planning-agent] agent message insert failed:', messageError)
      }
    }

    return NextResponse.json({
      agent_message: agentMessage,
      chips: parsed.chips ?? null,
      plan_updates: planUpdates,
      todo_updates: parsed.todo_updates ?? null,
      revenue_suggestion: parsed.revenue_suggestion ?? null,
      venue_suggestions: venueSuggestions.length > 0 ? venueSuggestions : null,
      hangout_id: resolvedHangoutId,
    })
  } catch (err) {
    console.error('[planning-agent] unhandled error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
