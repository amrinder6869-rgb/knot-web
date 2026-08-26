import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SYSTEM_PROMPT = `You are a meetup plan resolver for a private friend group app. Extract structured fields from natural language input. Respond only with valid JSON — no other text, no markdown, no explanation.

Schema:
{
  "hangoutTitle": string | null,
  "hangoutType": "planned" | "live" | null,
  "whenType": "now" | "pick" | "weekly" | null,
  "scheduledFor": "ISO datetime string" | null,
  "whereMode": "search" | "home" | "online" | "outdoor" | "cinema" | "tbd" | null,
  "venueName": string | null,
  "venueSearchQuery": string | null,
  "occasionType": "birthday" | "surprise_birthday" | "movies" | "drinks" | "dinner" | "brunch" | "coffee" | "hike" | "concert" | "gaming" | "study" | null,
  "isRecurring": boolean,
  "clarifyingQuestion": string | null,
  "quickOptions": string[]
}

Rules:
- hangoutType "live" only when input clearly means right now (grabbing food now, anyone coming)
- whenType "now" when live
- scheduledFor: resolve relative dates (tonight = today evening, Friday = next Friday ISO)
- whereMode "home" when someone's place, house party, home session
- whereMode "outdoor" when park, trail, beach, hiking, camping
- whereMode "cinema" when movie at a theatre
- whereMode "online" when virtual, video call, watch party
- venueName: only when a specific named venue is stated
- venueSearchQuery: when a venue type is implied but not named ("somewhere to eat", "a bar", "Mexican restaurant")
- clarifyingQuestion: only when date is ambiguous between two equally plausible options. Never ask about venue. Never ask about who is coming.
- quickOptions: 2 to 3 short answers to the clarifying question if one exists
- If nothing is clear, return all nulls and no clarifying question. Post anyway.`

const EMPTY_PAYLOAD = {
  hangoutTitle: null,
  hangoutType: null,
  whenType: null,
  scheduledFor: null,
  whereMode: null,
  venueName: null,
  venueSearchQuery: null,
  occasionType: null,
  isRecurring: false,
  clarifyingQuestion: null,
  quickOptions: [] as string[],
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json(EMPTY_PAYLOAD, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(EMPTY_PAYLOAD, { status: 401 })

  try {
    const { input, knotContext } = await request.json()
    if (!input || typeof input !== 'string' || !input.trim()) {
      return NextResponse.json(EMPTY_PAYLOAD, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json(EMPTY_PAYLOAD)

    const knotName = knotContext?.knotName || 'this group'
    const memberCount = knotContext?.memberCount
    const preferredDay = knotContext?.preferredDay
    const topVenue = knotContext?.topVenue

    const contextLines = [
      `Group: ${knotName}`,
      memberCount != null ? `Members: ${memberCount}` : null,
      preferredDay ? `This group usually hangs out on ${preferredDay}` : null,
      topVenue ? `This group's most-used venue: ${topVenue}` : null,
      `Current date/time: ${new Date().toISOString()}`,
    ].filter(Boolean).join('\n')

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
        messages: [
          { role: 'user', content: `${contextLines}\n\nInput: "${input.trim()}"` },
        ],
      }),
    })

    if (!response.ok) {
      return NextResponse.json(EMPTY_PAYLOAD)
    }

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text || '{}'

    try {
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      return NextResponse.json({ ...EMPTY_PAYLOAD, ...parsed })
    } catch {
      return NextResponse.json(EMPTY_PAYLOAD)
    }
  } catch {
    return NextResponse.json(EMPTY_PAYLOAD)
  }
}
