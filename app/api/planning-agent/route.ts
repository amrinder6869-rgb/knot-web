import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRandom, AGENT_MESSAGES } from '@/lib/copy'

// You are Knot, a planning assistant in a private friend group chat. Your job
// is to help the group plan their hangout by proposing options and letting
// them confirm. You never decide for the group. You always end with a
// question or chips for them to tap.
const SYSTEM_PROMPT = `You are Knot, a planning assistant in a private friend group chat. Your job is to help the group plan their hangout by proposing options and letting them confirm. You never decide for the group. You always end with a question or chips for them to tap.

You have access to the current plan state. Read it before responding so you do not repeat confirmed details.

Your messages must be short — maximum two sentences. Dry, warm, human. No exclamation points. No em dashes. No "Great" or "Sure" or "Of course". Sound like the sharpest person in the group chat, not a customer service bot. If you would not say it to a friend, do not write it.

Respond only with valid JSON:
{
  "agent_message": string | null,
  "chips": [{ "label": string, "action": string, "value": any }] | null,
  "plan_updates": { field: value } | null,
  "todo_updates": [{ "member_id": string, "type": "rsvp" | "poll" | "bill", "ref_id": string }] | null,
  "revenue_suggestion": { "type": "opentable" | "uber" | "mixtiles" | "lyft", "label": string, "url": string } | null
}

Rules:
- agent_message null when the message has no planning relevance. Let it be a normal chat message.
- chips maximum three. Labels maximum three words each.
- plan_updates only when a chip has been tapped confirming a value. Never from inference alone.
- revenue_suggestion only when directly relevant to what was just discussed. One per message maximum. Never unsolicited.
- If two members propose conflicting values, return agent_message using the conflict copy and plan_updates as null.`

// hangouts columns the agent is allowed to write. Anything else in
// plan_updates is dropped rather than passed straight into a Supabase
// update() call — the model's field names aren't a trusted schema.
const ALLOWED_PLAN_FIELDS = new Set([
  'title', 'venue_name', 'venue_address', 'scheduled_for', 'status',
  'brief', 'brief_vibe', 'brief_budget',
])

function filterPlanUpdates(updates: Record<string, any> | null): Record<string, any> | null {
  if (!updates) return null
  const out: Record<string, any> = {}
  for (const key of Object.keys(updates)) {
    if (ALLOWED_PLAN_FIELDS.has(key)) out[key] = updates[key]
  }
  return Object.keys(out).length > 0 ? out : null
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
    const { message, hangout_id, knot_id, current_plan_state } = await request.json()
    if (!message || typeof message !== 'string' || !message.trim() || !knot_id) {
      return NextResponse.json({ error: 'Missing message or knot_id' }, { status: 400 })
    }

    // sender_id is trusted from the verified session, not the request body.
    const senderId = user.id

    const { data: membership } = await userClient
      .from('knot_members')
      .select('user_id')
      .eq('knot_id', knot_id)
      .eq('user_id', senderId)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Not a member of this knot' }, { status: 403 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ agent_message: null, chips: null, plan_updates: null, todo_updates: null, revenue_suggestion: null })

    const contextLines = [
      `Current plan state: ${current_plan_state ? JSON.stringify(current_plan_state) : 'no active plan yet'}`,
      `Message: "${message.trim()}"`,
    ].join('\n')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contextLines }],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ agent_message: null, chips: null, plan_updates: null, todo_updates: null, revenue_suggestion: null })
    }

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text || '{}'

    let parsed: any
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      return NextResponse.json({ agent_message: null, chips: null, plan_updates: null, todo_updates: null, revenue_suggestion: null })
    }

    const planUpdates = filterPlanUpdates(parsed.plan_updates ?? null)
    let resolvedHangoutId: string | null = hangout_id || null
    // Confirmation-type replies (a value was actually written) come from the
    // canned AGENT_MESSAGES pools, not the model's own freeform text — the
    // model's agent_message is only used verbatim for open-ended chat
    // relevance (questions, clarifications) where no pool fits.
    let agentMessage: string | null = parsed.agent_message ?? null

    // A hangout gets created the first time the conversation produces
    // anything worth keeping — either a confirmed field (planUpdates) or
    // just a relevant reply (agentMessage non-null). The model correctly
    // withholds plan_updates until a chip is tapped (see system prompt), so
    // gating creation on planUpdates alone would mean the very first message
    // in a fresh knot has nowhere for the agent's reply to attach.
    const needsHangout = !resolvedHangoutId && (planUpdates || agentMessage)

    if (needsHangout || (planUpdates && resolvedHangoutId)) {
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const wasNewPlan = !resolvedHangoutId
      let writeFailed = false

      if (wasNewPlan) {
        const { data: newHangout, error: createError } = await serviceClient
          .from('hangouts')
          .insert({ knot_id, created_by: senderId, status: 'voting', ...(planUpdates || {}) })
          .select('id')
          .single()
        if (createError || !newHangout) {
          writeFailed = true
        } else {
          resolvedHangoutId = newHangout.id
        }
      } else if (planUpdates) {
        const { error: updateError } = await serviceClient
          .from('hangouts')
          .update(planUpdates)
          .eq('id', resolvedHangoutId)
        if (updateError) writeFailed = true
      }

      if (writeFailed) {
        agentMessage = getRandom(AGENT_MESSAGES.CONFLICT)
      } else if (planUpdates && resolvedHangoutId) {
        // Pick the confirmation copy matching what actually changed.
        if (wasNewPlan) agentMessage = getRandom(AGENT_MESSAGES.PLAN_CREATED)
        else if ('venue_name' in planUpdates || 'venue_address' in planUpdates) agentMessage = getRandom(AGENT_MESSAGES.VENUE_CONFIRMED)
        else if ('scheduled_for' in planUpdates) agentMessage = getRandom(AGENT_MESSAGES.TIME_CONFIRMED)
      }

      if (agentMessage && resolvedHangoutId) {
        await serviceClient.from('hangout_messages').insert({
          hangout_id: resolvedHangoutId,
          author_id: agentUserId,
          content: agentMessage,
        })
      }
    } else if (agentMessage && resolvedHangoutId) {
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await serviceClient.from('hangout_messages').insert({
        hangout_id: resolvedHangoutId,
        author_id: agentUserId,
        content: agentMessage,
      })
    }

    return NextResponse.json({
      agent_message: agentMessage,
      chips: parsed.chips ?? null,
      plan_updates: planUpdates,
      todo_updates: parsed.todo_updates ?? null,
      revenue_suggestion: parsed.revenue_suggestion ?? null,
      hangout_id: resolvedHangoutId,
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
