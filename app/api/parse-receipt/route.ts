import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { imageBase64, mediaType } = await request.json()
    if (!imageBase64 || !mediaType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: `You are a receipt parser. Extract the following from this receipt image and respond ONLY with a JSON object, no other text:
{
  "total": <number, the final total amount to pay, not subtotal>,
  "description": <string, 2-5 word summary of what the receipt is for e.g. "Dinner at Kasa" or "Uber ride" or "Groceries at Loblaws">,
  "category": <one of: "dinner", "drinks", "transport", "accommodation", "activities", "other">,
  "items": [<array of strings, the main line items, max 5>]
}
If you cannot read the receipt clearly, return { "total": null, "description": "", "category": "other", "items": [] }`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'OCR service unavailable' }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text || '{}'

    let parsed
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'Could not parse receipt' }, { status: 422 })
    }

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
