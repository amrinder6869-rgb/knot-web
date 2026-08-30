export async function getFlag(supabase: any, flagKey: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return false

  const { data } = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('flag_key', flagKey)
    .single()
  return data?.enabled ?? false
}
