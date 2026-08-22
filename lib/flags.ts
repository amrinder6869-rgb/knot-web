export async function getFlag(supabase: any, flagKey: string): Promise<boolean> {
  const { data } = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('flag_key', flagKey)
    .single()
  return data?.enabled ?? false
}
