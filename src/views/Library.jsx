import { useState } from 'react'
import { Empty } from '../ui.jsx'

export default function Library({ recipes, plannedDays, onOpen, onPlan, onAdd, onReorder }) {
  const [q, setQ] = useState('')
  const [reorder, setReorder] = useState(false)
  const query = q.trim().toLowerCase()
  const shown = query
    ? recipes.filter(r => r.name.toLowerCase().includes(query) || r.description?.toLowerCase().includes(query) || r.ingredients.some(i => i.name.toLowerCase().includes(query)))
    : recipes

  const move = (id, dir) => {
    const i = recipes.findIndex(r => r.id === id), j = i + dir
    if (i < 0 || j < 0 || j >= recipes.length) return
    const next = [...recipes]; [next[i], next[j]] = [next[j], next[i]]
    onReorder(next)
  }

  return (
    <div className="page">
      <div className="page-title">
        <h2>Recipes</h2>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <button className="btn btn-ghost" onClick={() => { setReorder(v => !v); setQ('') }}>{reorder ? 'Done' : 'Reorder'}</button>
          {!reorder && <button className="btn btn-primary btn-sm" onClick={onAdd}>+ Add</button>}
        </div>
      </div>

      {reorder ? (
        <>
          <p className="muted" style={{ marginBottom:12 }}>Use the arrows to change the order recipes appear in.</p>
          {recipes.map((r, i) => (
            <div className="reorder-row" key={r.id}>
              <span style={{ fontSize:22 }}>{r.emoji}</span>
              <p>{r.name}</p>
              <div className="arrows">
                <button onClick={() => move(r.id, -1)} disabled={i === 0} aria-label={`Move ${r.name} up`}>↑</button>
                <button onClick={() => move(r.id, 1)} disabled={i === recipes.length - 1} aria-label={`Move ${r.name} down`}>↓</button>
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="search">
            <svg className="s-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input className="field" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${recipes.length} recipes or ingredients`} />
            {q && <button className="icon-btn" onClick={() => setQ('')} aria-label="Clear search">×</button>}
          </div>
          {recipes.length === 0 ? (
            <Empty emoji="📖" text="No recipes yet. Add your first one — or import it from a link." cta="Add a recipe" onCta={onAdd} />
          ) : shown.length === 0 ? (
            <Empty emoji="🔍" text={`Nothing matches “${q}”.`} cta="Clear search" onCta={() => setQ('')} />
          ) : (
            <div className="grid">
              {shown.map(r => (
                <div key={r.id} className="rcard" role="button" tabIndex={0} onClick={() => onOpen(r)} onKeyDown={e => e.key === 'Enter' && onOpen(r)}>
                  <div className="emoji">{r.emoji}</div>
                  <h3>{r.name}</h3>
                  {r.description && <p>{r.description}</p>}
                  <div className="rcard-foot">
                    {plannedDays[r.id]?.length
                      ? <span className="planned">{plannedDays[r.id].join(' · ')}</span>
                      : <span className="muted" style={{ fontSize:12 }}>{r.ingredients.length} ingredients</span>}
                    <button className="plus" onClick={e => { e.stopPropagation(); onPlan(r) }} aria-label={`Plan ${r.name}`}>+</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
