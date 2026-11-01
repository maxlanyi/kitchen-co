// Vercel serverless function for the "Add to Kitchen" Siri shortcut.
// POST /api/add  JSON { "text": "paper towels and eggs", "by": "Max", "key": "<shortcut code>" }
// Replies with a short plain-text sentence that Siri reads aloud.
import { createHash, timingSafeEqual } from 'node:crypto'
import { supabase } from '../src/supabase.js'
import { RECIPES } from '../src/recipes.js'
import { planVoiceAdd, spokenReply } from '../src/lib/voiceAdd.js'

// SHA-256 of the shortcut code. The code itself is never stored in the repo.
const KEY_HASH = 'd143544c6147b584881dd68d544828b57334918cf8b8fcc12817349212415772'
const PEOPLE = ['Max', 'Lauren']
const KEYS = { recipes:'recipes', dinners:'dinners', lauren:'lauren_lunches', max:'max_lunches', checked:'checked', customItems:'custom_items', hidden:'deleted_ings' }

function keyMatches(key) {
  if (typeof key !== 'string' || !key) return false
  const a = createHash('sha256').update(key.trim()).digest()
  return timingSafeEqual(a, Buffer.from(KEY_HASH, 'hex'))
}

function readBody(req) {
  let b = req.body
  if (typeof b === 'string') { try { b = JSON.parse(b) } catch { b = Object.fromEntries(new URLSearchParams(b)) } }
  return { ...(req.query || {}), ...(b && typeof b === 'object' ? b : {}) }
}

const parse = raw => { if (raw == null) return undefined; if (typeof raw !== 'string') return raw; try { return JSON.parse(raw) } catch { return undefined } }

async function loadRows() {
  const { data, error } = await supabase.from('household_data').select('key, value, updated_at').in('key', Object.values(KEYS))
  if (error) throw error
  return Object.fromEntries((data || []).map(r => [r.key, r]))
}

const say = (res, code, text) => { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); return res.status(code).send(text) }

export default async function handler(req, res) {
  if (req.method !== 'POST') return say(res, 405, 'Use POST.')
  const body = readBody(req)
  if (!keyMatches(body.key)) return say(res, 401, 'That shortcut’s secret code doesn’t match. Check the key field in the shortcut.')
  const text = String(body.text ?? '').slice(0, 500)
  if (!text.trim()) return say(res, 400, 'I didn’t catch anything to add.')
  const by = PEOPLE.find(p => p.toLowerCase() === String(body.by ?? '').trim().toLowerCase())

  try {
    // Retry if one of the phones saves the list at the same moment.
    for (let attempt = 0; attempt < 4; attempt++) {
      const rows = await loadRows()
      const data = {}
      for (const [field, key] of Object.entries(KEYS)) data[field] = parse(rows[key]?.value)
      if (!Array.isArray(data.recipes)) data.recipes = RECIPES
      const result = planVoiceAdd(text, by, data)
      if (!result.added.length) return say(res, 200, spokenReply(result))

      const value = JSON.stringify(result.customItems)
      const updatedAt = new Date().toISOString()
      const row = rows[KEYS.customItems]
      let ok
      if (row) {
        const { data: changed, error } = await supabase.from('household_data')
          .update({ value, updated_at:updatedAt }).eq('key', KEYS.customItems).eq('updated_at', row.updated_at).select('key')
        if (error) throw error
        ok = changed?.length === 1
      } else {
        const { error } = await supabase.from('household_data').insert({ key:KEYS.customItems, value, updated_at:updatedAt })
        ok = !error
      }
      if (ok) return say(res, 200, spokenReply(result))
    }
    return say(res, 503, 'The list was busy. Try again in a second.')
  } catch {
    return say(res, 502, 'I couldn’t reach your kitchen list. Try again in a minute.')
  }
}
