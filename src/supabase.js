import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://feylbkejofdgapvgzzeq.supabase.co'
const SUPABASE_KEY = 'sb_publishable_MpZvQpUXlWQ_z9uBI710Qw_ui7E5dgJ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export async function dbGet(key) {
  try {
    const { data, error } = await supabase
      .from('household_data')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error) throw error
    return data?.value ?? null
  } catch {
    return null
  }
}

export async function dbSet(key, value) {
  try {
    const { error } = await supabase
      .from('household_data')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) throw error
  } catch (e) {
    console.error('dbSet error:', e)
  }
}
