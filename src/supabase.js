import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://feylbkejofdgapvgzzeq.supabase.co'
const SUPABASE_KEY = 'sb_publishable_MpZvQpUXlWQ_z9uBI710Qw_ui7E5dgJ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Fetch every key in one request. Throws on any network/database error —
// callers must NOT treat a failed load as "no data" (that used to wipe the plan).
export async function fetchAll(keys) {
  const { data, error } = await supabase
    .from('household_data')
    .select('key, value, updated_at')
    .in('key', keys)
  if (error) throw error
  const out = {}
  for (const row of data || []) out[row.key] = { raw: row.value, updatedAt: row.updated_at }
  return out
}

// Save one key. Throws on failure so the caller can retry later.
export async function saveKey(key, raw) {
  const updatedAt = new Date().toISOString()
  const { error } = await supabase
    .from('household_data')
    .upsert({ key, value: raw, updated_at: updatedAt }, { onConflict: 'key' })
  if (error) throw error
  return updatedAt
}
