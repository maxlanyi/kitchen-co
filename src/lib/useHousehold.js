import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAll, saveKey } from '../supabase.js'
import { RECIPES } from '../recipes.js'

export const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

// App field -> Supabase key (keys unchanged so older copies of the app keep working).
export const FIELDS = {
  recipes:'recipes', dinners:'dinners', lauren:'lauren_lunches', max:'max_lunches',
  checked:'checked', customItems:'custom_items', catOverrides:'cat_overrides', hidden:'deleted_ings', history:'history',
}
const FIELD_NAMES = Object.keys(FIELDS)
const CACHE_KEY = 'kitchen-co-cache-v1'
const POLL_MS = 15000

export const emptyWeek = () => Object.fromEntries(DAYS.map(d => [d, []]))
const isObj = v => v && typeof v === 'object' && !Array.isArray(v)

function normalizeWeek(v) {
  const w = emptyWeek()
  if (isObj(v)) for (const d of DAYS) w[d] = (Array.isArray(v[d]) ? v[d] : v[d] ? [v[d]] : []).filter(x => typeof x === 'string' && x)
  return w
}

const NORMALIZE = {
  recipes: v => (Array.isArray(v) ? v : RECIPES).filter(r => r && r.id).map(r => ({
    emoji:'🍽️', description:'', instructions:'', servings:4, ...r, id:String(r.id), name:String(r.name ?? 'Untitled'),
    ingredients:Array.isArray(r.ingredients) ? r.ingredients.filter(Boolean).map(i => ({ name:String(i.name ?? ''), amount:String(i.amount ?? ''), unit:String(i.unit ?? '') })) : [],
  })),
  dinners: normalizeWeek, lauren: normalizeWeek, max: normalizeWeek,
  checked: v => (isObj(v) ? v : {}),
  customItems: v => (Array.isArray(v) ? v.filter(x => x && x.id && x.name) : []),
  catOverrides: v => (isObj(v) ? v : {}),
  hidden: v => (isObj(v) ? v : {}),
  history: v => (Array.isArray(v) ? v.slice(0, 12) : []),
}

function parseRaw(raw) {
  if (raw == null) return undefined
  if (typeof raw !== 'string') return raw
  try { return JSON.parse(raw) } catch { return undefined }
}

function readCache() {
  try { const c = JSON.parse(localStorage.getItem(CACHE_KEY)); return c && c.values ? c : null } catch { return null }
}
function writeCache(c) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* storage full or blocked */ }
}

export function useHousehold() {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [sync, setSync] = useState('synced')      // synced | saving | offline
  const dataRef = useRef(null)
  const lastSaved = useRef({}) // field -> JSON last confirmed in Supabase
  const seen = useRef({})      // field -> updated_at last seen from Supabase
  const saving = useRef(new Set())
  const failed = useRef(new Set())
  const refreshing = useRef(false)

  dataRef.current = data

  const persistCache = useCallback(() => {
    if (dataRef.current) writeCache({ values:dataRef.current, lastSaved:lastSaved.current, seen:seen.current })
  }, [])

  const updateSync = useCallback(() => {
    setSync(failed.current.size ? 'offline' : saving.current.size ? 'saving' : 'synced')
  }, [])

  const saveField = useCallback(async field => {
    if (saving.current.has(field) || !dataRef.current) return
    const raw = JSON.stringify(dataRef.current[field])
    if (raw === lastSaved.current[field]) { failed.current.delete(field); return }
    saving.current.add(field); updateSync()
    try {
      seen.current[field] = await saveKey(FIELDS[field], raw)
      lastSaved.current[field] = raw
      failed.current.delete(field)
    } catch {
      failed.current.add(field)
    } finally {
      saving.current.delete(field)
      updateSync(); persistCache()
    }
    // Edited again while saving? Save the newer version.
    if (!failed.current.has(field) && JSON.stringify(dataRef.current[field]) !== lastSaved.current[field]) saveField(field)
  }, [persistCache, updateSync])

  const flush = useCallback(() => { for (const f of FIELD_NAMES) saveField(f) }, [saveField])

  // Pull the other phone's changes. Fields with unsaved local edits are left alone.
  const refresh = useCallback(async () => {
    if (refreshing.current || !dataRef.current) return
    refreshing.current = true
    try {
      const remote = await fetchAll(Object.values(FIELDS))
      const cur = dataRef.current
      let next = cur
      for (const f of FIELD_NAMES) {
        const r = remote[FIELDS[f]]
        if (!r || r.updatedAt === seen.current[f] || saving.current.has(f)) continue
        if (JSON.stringify(cur[f]) !== lastSaved.current[f]) continue
        const parsed = parseRaw(r.raw)
        if (parsed === undefined) continue
        const value = NORMALIZE[f](parsed)
        seen.current[f] = r.updatedAt
        lastSaved.current[f] = JSON.stringify(value)
        if (lastSaved.current[f] !== JSON.stringify(cur[f])) next = { ...next, [f]: value }
      }
      if (next !== cur) { dataRef.current = next; setData(next) }
      persistCache()
      flush()
    } catch { /* offline — try again on the next tick */ }
    finally { refreshing.current = false }
  }, [flush, persistCache])

  const load = useCallback(async () => {
    setStatus('loading')
    const cache = readCache()
    if (cache) {
      const values = Object.fromEntries(FIELD_NAMES.map(f => [f, NORMALIZE[f](cache.values[f])]))
      lastSaved.current = cache.lastSaved || {}
      seen.current = cache.seen || {}
      dataRef.current = values
      setData(values); setStatus('ready')
      refresh()
      return
    }
    try {
      const remote = await fetchAll(Object.values(FIELDS))
      const values = {}
      for (const f of FIELD_NAMES) {
        const r = remote[FIELDS[f]]
        const parsed = r ? parseRaw(r.raw) : undefined
        values[f] = NORMALIZE[f](parsed)
        if (r && parsed !== undefined) { lastSaved.current[f] = JSON.stringify(values[f]); seen.current[f] = r.updatedAt }
      }
      dataRef.current = values
      setData(values); setStatus('ready')
      persistCache()
    } catch {
      // Never fall back to defaults here: saving them would overwrite real data.
      setStatus('error')
    }
  }, [refresh, persistCache])

  useEffect(() => { load() }, [load])

  // Save whatever changed.
  useEffect(() => { if (data) { persistCache(); flush() } }, [data, flush, persistCache])

  // Refresh when the app comes back to the foreground, and every 15s while open.
  useEffect(() => {
    if (status !== 'ready') return
    const onWake = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    window.addEventListener('online', onWake)
    window.addEventListener('pageshow', onWake)
    const t = setInterval(onWake, POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('online', onWake)
      window.removeEventListener('pageshow', onWake)
      clearInterval(t)
    }
  }, [status, refresh])

  const update = useCallback((field, valOrFn) => {
    setData(d => {
      if (!d) return d
      const v = typeof valOrFn === 'function' ? valOrFn(d[field]) : valOrFn
      return v === d[field] ? d : { ...d, [field]: v }
    })
  }, [])

  return { data, status, sync, update, retry: load, refresh }
}
