import { useState } from 'react'
import { DAYS } from '../lib/useHousehold.js'
import { todayName } from '../ui.jsx'

export const SECTIONS = [
  { id:'dinners', label:'Dinners', emoji:'🍽️', title:'Dinner' },
  { id:'lauren',  label:'Lauren',  emoji:'🥗', title:"Lauren's lunch" },
  { id:'max',     label:'Max',     emoji:'🥙', title:"Max's lunch" },
]

export default function Week({ plans, recipes, groceryCount, historyCount, onAdd, onRemove, onGoGrocery, onNewWeek, onHistory }) {
  const [section, setSection] = useState('dinners')
  const byId = Object.fromEntries(recipes.map(r => [r.id, r]))
  const today = todayName()
  const count = s => DAYS.reduce((n, d) => n + plans[s][d].length, 0)

  return (
    <div className="page">
      <div className="page-title">
        <h2>This week</h2>
      </div>

      <div className="seg" role="tablist">
        {SECTIONS.map(s => (
          <button key={s.id} role="tab" aria-selected={section === s.id} className={section === s.id ? 'on' : ''} onClick={() => setSection(s.id)}>
            {s.emoji} {s.label}{count(s.id) > 0 && <small>{count(s.id)}</small>}
          </button>
        ))}
      </div>

      {DAYS.map(day => {
        const items = plans[section][day]
        const isToday = day === today
        return (
          <div key={day} className={`day${items.length ? ' filled' : ''}${isToday ? ' today' : ''}`}>
            <div className="day-tag"><b>{day.slice(0, 3)}</b>{isToday && <em>Today</em>}</div>
            <div className="day-meals">
              {items.length === 0 && <span className="empty-day" onClick={() => onAdd(section, day)}>Nothing planned</span>}
              {items.map(v => {
                const r = byId[v]
                return (
                  <div className="meal" key={v}>
                    {r && <span className="e">{r.emoji}</span>}
                    <p className={r ? '' : 'free'}>{r ? r.name : v}</p>
                    <button className="icon-btn" onClick={() => onRemove(section, day, v)} aria-label={`Remove ${r ? r.name : v}`}>×</button>
                  </div>
                )
              })}
            </div>
            <button className="add-day" onClick={() => onAdd(section, day)} aria-label={`Add to ${day}`}>+</button>
          </div>
        )
      })}

      <div className="week-actions">
        {groceryCount > 0 && <button className="btn btn-primary btn-block" onClick={onGoGrocery}>View grocery list · {groceryCount} item{groceryCount === 1 ? '' : 's'} →</button>}
        <div className="row">
          <button className="btn btn-outline" onClick={onNewWeek}>Start a new week</button>
          <button className="btn btn-outline" onClick={onHistory} disabled={!historyCount}>Past weeks{historyCount ? ` (${historyCount})` : ''}</button>
        </div>
      </div>
    </div>
  )
}
