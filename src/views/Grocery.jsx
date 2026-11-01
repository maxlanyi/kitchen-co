import { useState } from 'react'
import { CATEGORIES } from '../lib/grocery.js'
import { Empty } from '../ui.jsx'

export default function Grocery({ items, hidden, checked, catOf, onToggle, onRemove, onRestore, onUncheckAll, onAddCustom, onCatTap, onShare, onGoWeek }) {
  const [input, setInput] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const todo = items.filter(i => !checked[i.key])
  const done = items.filter(i => checked[i.key])
  const pct = items.length ? Math.round((done.length / items.length) * 100) : 0

  const add = () => { if (input.trim()) { onAddCustom(input.trim()); setInput('') } }

  const Row = ({ item }) => {
    const cat = CATEGORIES.find(c => c.id === catOf(item)) || CATEGORIES[CATEGORIES.length - 1]
    const isDone = !!checked[item.key]
    return (
      <div className={`g-row${isDone ? ' done' : ''}`}>
        <button className="g-main" onClick={() => onToggle(item.key)} aria-pressed={isDone}>
          <span className="box">{isDone && '✓'}</span>
          <span className="g-text">
            <span className="g-name">{item.name}</span>{item.qty && <span className="g-qty">{item.qty}</span>}
            <span className="g-sub" style={{ display:'block' }}>{item.custom ? (item.by ? `Added by ${item.by}` : 'Added by hand') : item.recipes.join(', ')}</span>
          </span>
        </button>
        <button className="cat-chip" onClick={() => onCatTap(item)} aria-label={`Section: ${cat.label}. Change`}>{cat.emoji}</button>
        <button className="icon-btn" onClick={() => onRemove(item)} aria-label={`Remove ${item.name}`}>×</button>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-title">
        <h2>Grocery list</h2>
        {todo.length > 0 && <button className="btn btn-ghost" onClick={onShare}>Share</button>}
      </div>

      <div className="summary">
        {items.length > 0 && <>
          <div className="summary-top">
            <span><b>{todo.length}</b> <span className="muted">to get</span></span>
            <span className="muted">{done.length} in basket</span>
          </div>
          <div className="progress"><div style={{ width:`${pct}%` }} /></div>
        </>}
        <div className="add-row">
          <input className="field" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Add an item — paper towels, wine…" enterKeyHint="done" />
          <button className="btn btn-primary" onClick={add} disabled={!input.trim()}>Add</button>
        </div>
      </div>

      {items.length === 0 && hidden.length === 0 ? (
        <Empty emoji="🛒" text="Plan some meals and your list builds itself — ingredients combined and sorted by aisle." cta="Plan this week" onCta={onGoWeek} />
      ) : (
        <>
          {todo.length === 0 && items.length > 0 && <div className="empty" style={{ marginBottom:18, padding:'26px 20px' }}><div className="big">🎉</div><p style={{ margin:0 }}>Everything's in the basket.</p></div>}
          {CATEGORIES.map(cat => {
            const list = todo.filter(i => catOf(i) === cat.id)
            if (!list.length) return null
            return (
              <div className="cat" key={cat.id}>
                <div className="cat-head"><span style={{ fontSize:17 }}>{cat.emoji}</span><h4>{cat.label}</h4><span>{list.length}</span></div>
                <div className="list-card">{list.map(i => <Row key={i.key} item={i} />)}</div>
              </div>
            )
          })}

          {done.length > 0 && (
            <div className="cat">
              <div className="cat-head" style={{ paddingBottom:0 }}>
                <button className={`fold${showDone ? ' open' : ''}`} style={{ padding:'8px 0', color:'var(--brown)' }} onClick={() => setShowDone(v => !v)}>
                  <span style={{ fontSize:17 }}>✅</span><h4 style={{ textAlign:'left' }}>In basket</h4><span className="muted">{done.length}</span><span className="chev">›</span>
                </button>
                <button onClick={onUncheckAll}>Uncheck all</button>
              </div>
              {showDone && <div className="list-card" style={{ marginTop:8 }}>{done.map(i => <Row key={i.key} item={i} />)}</div>}
            </div>
          )}

          {hidden.length > 0 && (
            <div className="cat">
              <div className="cat-head" style={{ paddingBottom:0 }}>
                <button className={`fold${showHidden ? ' open' : ''}`} style={{ padding:'8px 0' }} onClick={() => setShowHidden(v => !v)}>
                  <span style={{ fontSize:17 }}>🙈</span><span style={{ textAlign:'left' }}>Removed this week</span><span className="muted">{hidden.length}</span><span className="chev">›</span>
                </button>
                <button onClick={() => onRestore(null)}>Restore all</button>
              </div>
              {showHidden && (
                <div className="list-card" style={{ marginTop:8 }}>
                  {hidden.map(i => (
                    <div className="list-row" key={i.key}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <span className="g-name" style={{ color:'var(--mid)' }}>{i.name}</span>
                        <span className="g-sub" style={{ display:'block' }}>{i.recipes.join(', ')}</span>
                      </div>
                      <button className="btn btn-soft btn-sm" onClick={() => onRestore(i.key)}>Restore</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="muted" style={{ textAlign:'center', fontSize:12.5, marginTop:4 }}>Tap an item to check it off · tap the section icon to move it</p>
        </>
      )}
    </div>
  )
}
