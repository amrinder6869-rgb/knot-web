import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

export async function getSignedUrl(storagePath: string | null | undefined, expiresIn = 86400): Promise<string | null> {
  if (!storagePath) return null
  // If already a full URL (legacy data), extract the path after /knot-photos/
  let resolvedPath = storagePath
  if (storagePath.startsWith('http')) {
    const match = storagePath.match(/knot-photos\/(.+)$/)
    if (!match) return null
    resolvedPath = match[1]
  }
  const { data, error } = await supabase.storage.from('knot-photos').createSignedUrl(resolvedPath, expiresIn)
  if (error || !data) return null
  return data.signedUrl
}
