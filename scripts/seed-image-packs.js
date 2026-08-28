// Run this once with: node scripts/seed-image-packs.js
// Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local.
/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS Node script, not part of the Next.js build */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const envPath = path.join(__dirname, '..', '.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match) process.env[match[1]] = match[2]
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const packs = [
  { name: 'Night Out', category: 'drinks', tier: 'free', sort_order: 1, images: [
    'https://picsum.photos/seed/bar1/800/600',
    'https://picsum.photos/seed/cocktail1/800/600',
    'https://picsum.photos/seed/nightout1/800/600',
    'https://picsum.photos/seed/rooftop1/800/600',
  ]},
  { name: 'Dinner', category: 'dinner', tier: 'free', sort_order: 2, images: [
    'https://picsum.photos/seed/dinner1/800/600',
    'https://picsum.photos/seed/restaurant1/800/600',
    'https://picsum.photos/seed/food1/800/600',
    'https://picsum.photos/seed/dining1/800/600',
  ]},
  { name: 'Brunch', category: 'brunch', tier: 'free', sort_order: 3, images: [
    'https://picsum.photos/seed/brunch1/800/600',
    'https://picsum.photos/seed/morning1/800/600',
    'https://picsum.photos/seed/coffee1/800/600',
    'https://picsum.photos/seed/breakfast1/800/600',
  ]},
  { name: 'Outdoors', category: 'hike', tier: 'free', sort_order: 4, images: [
    'https://picsum.photos/seed/hiking1/800/600',
    'https://picsum.photos/seed/nature1/800/600',
    'https://picsum.photos/seed/park1/800/600',
    'https://picsum.photos/seed/lake1/800/600',
  ]},
  { name: 'Birthday', category: 'birthday', tier: 'free', sort_order: 5, images: [
    'https://picsum.photos/seed/birthday1/800/600',
    'https://picsum.photos/seed/party1/800/600',
    'https://picsum.photos/seed/celebrate1/800/600',
    'https://picsum.photos/seed/confetti1/800/600',
  ]},
  { name: 'Movies', category: 'movies', tier: 'free', sort_order: 6, images: [
    'https://picsum.photos/seed/cinema1/800/600',
    'https://picsum.photos/seed/movie1/800/600',
    'https://picsum.photos/seed/film1/800/600',
    'https://picsum.photos/seed/theater1/800/600',
  ]},
  { name: 'Sports', category: 'sports', tier: 'free', sort_order: 7, images: [
    'https://picsum.photos/seed/sport1/800/600',
    'https://picsum.photos/seed/soccer1/800/600',
    'https://picsum.photos/seed/basketball1/800/600',
    'https://picsum.photos/seed/gym1/800/600',
  ]},
  { name: 'Travel', category: 'travel', tier: 'free', sort_order: 8, images: [
    'https://picsum.photos/seed/travel1/800/600',
    'https://picsum.photos/seed/city1/800/600',
    'https://picsum.photos/seed/adventure1/800/600',
    'https://picsum.photos/seed/explore1/800/600',
  ]},
]

async function seed() {
  const { data, error } = await supabase.from('image_packs').insert(packs).select('id, name')
  if (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }
  console.log(`Inserted ${data.length} image packs:`)
  for (const pack of data) console.log(`  ${pack.name} (${pack.id})`)
}

seed()
