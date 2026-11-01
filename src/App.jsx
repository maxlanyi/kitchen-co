import { useCallback, useMemo, useState } from 'react'
import { useHousehold, DAYS, emptyWeek } from './lib/useHousehold.js'
import { buildGrocery, getCategory, groceryText, CATEGORIES } from './lib/grocery.js'
import { ingredientKey } from './lib/ingredients.js'
import { Sheet, useToast, todayName } from './ui.jsx'
import Library from './views/Library.jsx'
import Week, { SECTIONS } from './views/Week.jsx'
import Grocery from './views/Grocery.jsx'
import RecipeForm from './views/RecipeForm.jsx'

const TABS = [
  { id:'library', label:'Recipes',   ico:'📖' },
  { id:'week',    label:'This Week', ico:'🗓️' },
  { id:'grocery', label:'Grocery',   ico:'🛒' },
]
const PLAN_FIELDS = ['dinners', 'lauren', 'max']
// A planned value that looks like a recipe id but whose recipe was deleted.
const looksLikeId = v => /^r?\d+$/.test(v)

function readTab() { try { return localStorage.getItem('kitchen-co-tab') || 'week' } catch { return 'week' } }

export default function App() {
  const { data, status, sync, update, retry } = useHousehold()
  const [tab, setTabState] = useState(readTab)
  const [viewId, setViewId] = useState(null)
  const [viewTab, setViewTab] = useState('ingredients')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(null) // recipe | 'new'
  const [planId, setPlanId] = useState(null)
  const [picker, setPicker] = useState(null) // { section, day }
  const [pickerText, setPickerText] = useState('')
  const [catItem, setCatItem] = useState(null)
  const [newWeekOpen, setNewWeekOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toast, toastNode] = useToast()

  const setTab = t => { setTabState(t); try { localStorage.setItem('kitchen-co-tab', t) } catch { /* ignore */ } window.scrollTo(0, 0) }

  const recipes = data?.recipes || []
  const byId = useMemo(() => Object.fromEntries(recipes.map(r => [r.id, r])), [recipes])
  const plans = useMemo(() => data ? { dinners:data.dinners, lauren:data.lauren, max:data.max } : null, [data])
  const grocery = useMemo(() => data ? buildGrocery({ recipes, plans, customItems:data.customItems, hiddenKeys:data.hidden }) : { items:[], hidden:[] }, [data, recipes, plans])
  const catOf = useCallback(i => data?.catOverrides[i.key] || getCategory(i.name), [data])

  // ---- meal planning -------------------------------------------------------
  // Adding a recipe brings its ingredients back onto the list, even if they were
  // removed or checked off before (the original "ingredients don't show up" bug).
  const surfaceIngredients = useCallback(recipeId => {
    const r = byId[recipeId]
    if (!r) return
    const keys = r.ingredients.map(i => ingredientKey(i.name))
    const clear = obj => (keys.some(k => obj[k]) ? Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k))) : obj)
    update('hidden', clear)
    update('checked', clear)
  }, [byId, update])

  const addMeal = (section, day, value) => {
    if (data[section][day].includes(value)) return
    update(section, w => ({ ...w, [day]: [...w[day], value] }))
    surfaceIngredients(value)
  }
  const removeMeal = (section, day, value) => update(section, w => ({ ...w, [day]: w[day].filter(v => v !== value) }))
  const toggleMeal = (section, day, value) => (data[section][day].includes(value) ? removeMeal(section, day, value) : addMeal(section, day, value))

  const plannedDays = useMemo(() => {
    const out = {}
    if (!plans) return out
    for (const day of DAYS) for (const s of PLAN_FIELDS) for (const v of plans[s][day]) {
      if (!byId[v]) continue
      const d = day.slice(0, 3)
      out[v] = out[v] || []
      if (!out[v].includes(d)) out[v].push(d)
    }
    return out
  }, [plans, byId])

  // ---- recipes -------------------------------------------------------------
  const saveRecipe = r => {
    if (editing === 'new') {
      const id = `r${Date.now()}`
      update('recipes', list => [...list, { ...r, id }])
      toast(`Added ${r.name}`)
    } else {
      update('recipes', list => list.map(x => (x.id === r.id ? r : x)))
    }
    setEditing(null)
  }

  const deleteRecipe = r => {
    const snapshot = { recipes:data.recipes, dinners:data.dinners, lauren:data.lauren, max:data.max }
    update('recipes', list => list.filter(x => x.id !== r.id))
    for (const s of PLAN_FIELDS) update(s, w => Object.fromEntries(DAYS.map(d => [d, w[d].filter(v => v !== r.id)])))
    setViewId(null); setConfirmDelete(false)
    toast(`Deleted ${r.name}`, () => { for (const [k, v] of Object.entries(snapshot)) update(k, v) })
  }

  // ---- grocery -------------------------------------------------------------
  const toggleCheck = key => update('checked', c => { const n = { ...c }; if (n[key]) delete n[key]; else n[key] = true; return n })
  const removeItem = item => {
    if (item.custom) {
      const prev = data.customItems
      update('customItems', l => l.filter(x => x.id !== item.id))
      toast(`Removed ${item.name}`, () => update('customItems', prev))
    } else {
      update('hidden', h => ({ ...h, [item.key]: true }))
      toast(`Removed ${item.name} for this week`, () => update('hidden', h => { const n = { ...h }; delete n[item.key]; return n }))
    }
  }
  const restore = key => update('hidden', h => (key ? Object.fromEntries(Object.entries(h).filter(([k]) => k !== key)) : {}))
  const uncheckAll = () => { const prev = data.checked; update('checked', {}); toast('Unchecked everything', () => update('checked', prev)) }
  const addCustom = name => {
    if (grocery.items.some(i => i.name.toLowerCase() === name.toLowerCase() && !data.checked[i.key])) { toast(`${name} is already on the list`); return }
    update('customItems', l => [...l, { id:String(Date.now()), name }])
  }
  const share = async () => {
    const text = `Grocery list\n\n${groceryText(grocery.items, data.checked, catOf)}`
    try {
      if (navigator.share) { await navigator.share({ title:'Grocery list', text }); return }
      await navigator.clipboard.writeText(text)
      toast('List copied — paste it anywhere')
    } catch (e) {
      if (e?.name !== 'AbortError') toast('Couldn’t share the list')
    }
  }

  // ---- weeks ---------------------------------------------------------------
  const mealCount = plans ? PLAN_FIELDS.reduce((n, s) => n + DAYS.reduce((m, d) => m + plans[s][d].length, 0), 0) : 0

  const startNewWeek = () => {
    const snapshot = { dinners:data.dinners, lauren:data.lauren, max:data.max, checked:data.checked, hidden:data.hidden, customItems:data.customItems, history:data.history }
    if (mealCount > 0) update('history', h => [{ id:String(Date.now()), savedAt:new Date().toISOString(), dinners:data.dinners, lauren:data.lauren, max:data.max }, ...h].slice(0, 12))
    for (const s of PLAN_FIELDS) update(s, emptyWeek())
    update('customItems', l => l.filter(i => !data.checked[`custom_${i.id}`]))
    update('checked', {}); update('hidden', {})
    setNewWeekOpen(false)
    toast('New week started', () => { for (const [k, v] of Object.entries(snapshot)) update(k, v) })
  }

  const loadPastWeek = entry => {
    const snapshot = { dinners:data.dinners, lauren:data.lauren, max:data.max }
    const clean = w => Object.fromEntries(DAYS.map(d => [d, (w?.[d] || []).filter(v => byId[v] || !looksLikeId(v))]))
    for (const s of PLAN_FIELDS) update(s, clean(entry[s]))
    for (const s of PLAN_FIELDS) for (const d of DAYS) for (const v of entry[s]?.[d] || []) surfaceIngredients(v)
    setHistoryOpen(false); setTab('week')
    toast('Loaded that week’s meals', () => { for (const [k, v] of Object.entries(snapshot)) update(k, v) })
  }

  // ---- render ----------------------------------------------------------------
  if (status === 'loading' && !data) return (
    <div className="center-screen"><div className="big">🍽️</div><h1>Kitchen & Co.</h1><p>Loading your kitchen…</p></div>
  )
  if (status === 'error' && !data) return (
    <div className="center-screen">
      <div className="big">📡</div><h1>Can’t reach your kitchen</h1>
      <p>Check your connection and try again. Nothing has been changed.</p>
      <button className="btn btn-primary" onClick={retry}>Try again</button>
    </div>
  )

  const viewing = viewId && byId[viewId]
  const planning = planId && byId[planId]
  const cleanPlans = Object.fromEntries(PLAN_FIELDS.map(s => [s, Object.fromEntries(DAYS.map(d => [d, plans[s][d].filter(v => byId[v] || !looksLikeId(v))]))]))
  const todo = grocery.items.filter(i => !data.checked[i.key]).length
  const syncLabel = sync === 'offline' ? 'Offline · saved on phone' : sync === 'saving' ? 'Saving…' : 'Synced'
  const today = todayName()

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <div><p className="eyebrow">Max & Lauren's</p><h1 className="brand">Kitchen & Co.</h1></div>
          <div className="header-meta">
            <p className={`sync ${sync}`}><i />{syncLabel}</p>
            <p className="meal-count">{mealCount} meal{mealCount === 1 ? '' : 's'} planned</p>
          </div>
        </div>
      </header>

      {tab === 'library' && <Library recipes={recipes} plannedDays={plannedDays} onOpen={r => { setViewId(r.id); setViewTab('ingredients'); setConfirmDelete(false) }}
        onPlan={r => setPlanId(r.id)} onAdd={() => setEditing('new')} onReorder={list => update('recipes', list)} />}

      {tab === 'week' && <Week plans={cleanPlans} recipes={recipes} groceryCount={todo} historyCount={data.history.length}
        onAdd={(section, day) => { setPicker({ section, day }); setPickerText('') }} onRemove={removeMeal}
        onGoGrocery={() => setTab('grocery')} onNewWeek={() => setNewWeekOpen(true)} onHistory={() => setHistoryOpen(true)} />}

      {tab === 'grocery' && <Grocery items={grocery.items} hidden={grocery.hidden} checked={data.checked} catOf={catOf}
        onToggle={toggleCheck} onRemove={removeItem} onRestore={restore} onUncheckAll={uncheckAll} onAddCustom={addCustom}
        onCatTap={setCatItem} onShare={share} onGoWeek={() => setTab('week')} />}

      <nav className="nav">
        <div className="nav-inner">
          {TABS.map(t => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <span className="ico">{t.ico}</span>{t.label}
              {t.id === 'grocery' && todo > 0 && <span className="badge">{todo}</span>}
            </button>
          ))}
        </div>
      </nav>

      {/* Recipe detail */}
      {viewing && (
        <Sheet onClose={() => setViewId(null)} footer={<button className="btn btn-primary btn-block" onClick={() => { setViewId(null); setPlanId(viewing.id) }}>Add to this week</button>}>
          <div className="detail-hero">
            <div className="big">{viewing.emoji}</div>
            <h3>{viewing.name}</h3>
            {viewing.description && <p>{viewing.description}</p>}
            <small>Serves {viewing.servings}{plannedDays[viewing.id] ? ` · Planned ${plannedDays[viewing.id].join(', ')}` : ''}</small>
          </div>
          <div className="seg">
            {['ingredients', 'instructions'].map(t => (
              <button key={t} className={viewTab === t ? 'on' : ''} onClick={() => setViewTab(t)} style={{ textTransform:'capitalize' }}>{t}</button>
            ))}
          </div>
          {viewTab === 'ingredients' ? (
            viewing.ingredients.length
              ? <div className="ing-list">{viewing.ingredients.map((ing, i) => <div key={i}><span>{ing.name}</span><span>{[ing.amount, ing.unit].filter(Boolean).join(' ') || '—'}</span></div>)}</div>
              : <p className="muted" style={{ textAlign:'center', padding:20 }}>No ingredients yet.</p>
          ) : (
            viewing.instructions?.trim()
              ? <ol className="steps">{viewing.instructions.split('\n').map(s => s.trim()).filter(Boolean).map((s, i) => {
                  const m = s.match(/^(\d+)[.)]\s*(.*)$/)
                  return <li key={i}><b>{m ? m[1] : '•'}</b><span>{m ? m[2] : s}</span></li>
                })}</ol>
              : <p className="muted" style={{ textAlign:'center', padding:20 }}>No instructions added yet.</p>
          )}
          <div className="add-row" style={{ marginTop:14 }}>
            <button className="btn btn-outline" style={{ flex:1 }} onClick={() => { setEditing(viewing); setViewId(null) }}>Edit</button>
            <button className="btn btn-outline" style={{ flex:1, color:'var(--danger)' }} onClick={() => setConfirmDelete(true)}>Delete</button>
          </div>
          {confirmDelete && (
            <div className="confirm">
              <p>Delete <b>{viewing.name}</b>?{plannedDays[viewing.id] ? ' It will also come off this week’s plan.' : ''}</p>
              <div className="row">
                <button className="btn btn-outline" onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => deleteRecipe(viewing)}>Delete</button>
              </div>
            </div>
          )}
        </Sheet>
      )}

      {/* Plan a recipe onto days */}
      {planning && (
        <Sheet title={`${planning.emoji} ${planning.name}`} sub="Tap the days to add or remove it" onClose={() => setPlanId(null)}
          footer={<button className="btn btn-primary btn-block" onClick={() => setPlanId(null)}>Done</button>}>
          {SECTIONS.map(s => (
            <div key={s.id} style={{ marginBottom:14 }}>
              <p className="label" style={{ marginTop:4 }}>{s.emoji} {s.id === 'dinners' ? 'Dinner' : s.title}</p>
              <div className="days-grid">
                {DAYS.map(d => {
                  const on = data[s.id][d].includes(planning.id)
                  const others = data[s.id][d].filter(v => v !== planning.id).map(v => byId[v]?.name || (looksLikeId(v) ? null : v)).filter(Boolean)
                  return (
                    <button key={d} className={`day-chip${on ? ' on' : ''}${d === today ? ' today' : ''}`} onClick={() => toggleMeal(s.id, d, planning.id)} aria-pressed={on}>
                      <b>{d.slice(0, 3)}</b><small>{on ? '✓ planned' : others.length ? others[0] : 'open'}</small>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </Sheet>
      )}

      {/* Pick meals for a day */}
      {picker && (() => {
        const sec = SECTIONS.find(s => s.id === picker.section)
        const selected = data[picker.section][picker.day]
        const q = pickerText.trim().toLowerCase()
        const list = q ? recipes.filter(r => r.name.toLowerCase().includes(q)) : recipes
        const exact = recipes.some(r => r.name.toLowerCase() === q) || selected.some(v => v.toLowerCase() === q)
        const freeSelected = selected.filter(v => !byId[v] && !looksLikeId(v))
        const addFree = () => { if (pickerText.trim() && !exact) { addMeal(picker.section, picker.day, pickerText.trim()); setPickerText('') } }
        return (
          <Sheet tall title={`${sec.emoji} ${sec.title} · ${picker.day}`} sub="Pick recipes, or type anything — “Leftovers”, “Date night”…"
            onClose={() => setPicker(null)} footer={<button className="btn btn-primary btn-block" onClick={() => setPicker(null)}>Done</button>}>
            <div className="search">
              <svg className="s-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input className="field" value={pickerText} onChange={e => setPickerText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFree()} placeholder="Search or type a meal" enterKeyHint="done" />
              {pickerText && <button className="icon-btn" onClick={() => setPickerText('')} aria-label="Clear">×</button>}
            </div>
            {q && !exact && (
              <button className="pick" onClick={addFree}>
                <span className="e">✏️</span><div><b>Add “{pickerText.trim()}”</b><small>As a meal without a recipe (no groceries)</small></div>
              </button>
            )}
            {freeSelected.map(v => (
              <button key={v} className="pick on" onClick={() => removeMeal(picker.section, picker.day, v)}>
                <span className="e">✏️</span><div><b>{v}</b><small>Tap to remove</small></div><span className="chk">✓</span>
              </button>
            ))}
            {list.map(r => {
              const on = selected.includes(r.id)
              return (
                <button key={r.id} className={`pick${on ? ' on' : ''}`} onClick={() => toggleMeal(picker.section, picker.day, r.id)} aria-pressed={on}>
                  <span className="e">{r.emoji}</span><div><b>{r.name}</b>{r.description && <small>{r.description}</small>}</div>{on && <span className="chk">✓</span>}
                </button>
              )
            })}
          </Sheet>
        )
      })()}

      {/* Move a grocery item to another section */}
      {catItem && (
        <Sheet title={`Move “${catItem.name}”`} sub="Which section of the store is it in?" onClose={() => setCatItem(null)}>
          {CATEGORIES.map(c => {
            const on = catOf(catItem) === c.id
            return (
              <button key={c.id} className={`pick${on ? ' on' : ''}`} style={{ minHeight:52 }} onClick={() => { update('catOverrides', o => ({ ...o, [catItem.key]: c.id })); setCatItem(null) }}>
                <span className="e">{c.emoji}</span><div><b style={{ fontFamily:'var(--sans)', fontWeight:500 }}>{c.label}</b></div>{on && <span className="chk">✓</span>}
              </button>
            )
          })}
        </Sheet>
      )}

      {newWeekOpen && (
        <Sheet title="Start a new week?" onClose={() => setNewWeekOpen(false)}
          footer={<button className="btn btn-primary btn-block" onClick={startNewWeek}>Start new week</button>}>
          <div className="note">
            This will:
            <ul>
              {mealCount > 0 && <li>Save this week’s {mealCount} meals to Past weeks so you can reuse them</li>}
              <li>Clear all meals from the plan</li>
              <li>Uncheck the grocery list and bring back removed items</li>
              <li>Drop hand-added items you already got; keep ones you haven’t</li>
            </ul>
          </div>
          <p className="muted" style={{ marginTop:10 }}>You can undo right after.</p>
        </Sheet>
      )}

      {historyOpen && (
        <Sheet title="Past weeks" sub="Reuse a week you liked" onClose={() => setHistoryOpen(false)}>
          {data.history.map(h => {
            const names = []
            for (const s of PLAN_FIELDS) for (const d of DAYS) for (const v of h[s]?.[d] || []) { const n = byId[v]?.name || (looksLikeId(v) ? null : v); if (n && !names.includes(n)) names.push(n) }
            const date = new Date(h.savedAt).toLocaleDateString(undefined, { month:'short', day:'numeric' })
            return (
              <div key={h.id} className="pick" style={{ cursor:'default' }}>
                <div>
                  <b>Saved {date}</b>
                  <small style={{ whiteSpace:'normal' }}>{names.length ? names.slice(0, 6).join(' · ') + (names.length > 6 ? ` +${names.length - 6} more` : '') : 'No meals'}</small>
                </div>
                <button className="btn btn-soft btn-sm" onClick={() => loadPastWeek(h)} disabled={!names.length}>Use</button>
              </div>
            )
          })}
          {mealCount > 0 && <p className="muted" style={{ marginTop:8 }}>Using a past week replaces this week’s meals. You can undo right after.</p>}
        </Sheet>
      )}

      {editing && <RecipeForm recipe={editing === 'new' ? null : editing} onSave={saveRecipe} onClose={() => setEditing(null)} />}

      {toastNode}
    </div>
  )
}
