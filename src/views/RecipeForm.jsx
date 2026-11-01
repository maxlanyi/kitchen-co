import { useState } from 'react'
import { Sheet } from '../ui.jsx'
import { parseIngredientLine } from '../lib/ingredients.js'

const blankIng = () => ({ name:'', amount:'', unit:'' })
const blank = () => ({ name:'', description:'', emoji:'🍽️', servings:4, instructions:'', ingredients:[blankIng()] })

export default function RecipeForm({ recipe, onSave, onClose }) {
  const isNew = !recipe
  const [r, setR] = useState(() => recipe ? { ...recipe, ingredients:[...recipe.ingredients.map(i => ({ ...i })), blankIng()] } : blank())
  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importErr, setImportErr] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [paste, setPaste] = useState('')

  const set = (k, v) => setR(p => ({ ...p, [k]: v }))
  const setIng = (i, k, v) => setR(p => {
    const ings = p.ingredients.map((x, j) => (j === i ? { ...x, [k]: v } : x))
    // Keep one empty row at the end so there's always somewhere to type.
    if (ings[ings.length - 1].name.trim()) ings.push(blankIng())
    return { ...p, ingredients: ings }
  })
  const removeIng = i => setR(p => {
    const ings = p.ingredients.filter((_, j) => j !== i)
    return { ...p, ingredients: ings.length ? ings : [blankIng()] }
  })

  const addPasted = () => {
    const lines = paste.split('\n').map(s => s.replace(/^[-•*▢☐\s]+/, '').trim()).filter(Boolean)
    if (!lines.length) return
    setR(p => ({ ...p, ingredients: [...p.ingredients.filter(i => i.name.trim()), ...lines.map(parseIngredientLine), blankIng()] }))
    setPaste(''); setPasteOpen(false)
  }

  const doImport = async () => {
    if (!url.trim()) return
    setImporting(true); setImportErr('')
    try {
      const res = await fetch(`/api/import?url=${encodeURIComponent(url.trim())}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.recipe) throw new Error(body.error || 'Couldn’t import that link.')
      const x = body.recipe
      setR({ ...blank(), ...x, ingredients:[...x.ingredients, blankIng()] })
      setUrl('')
    } catch (e) {
      setImportErr(e.message === 'Failed to fetch' ? 'No connection — try again in a moment.' : e.message)
    } finally { setImporting(false) }
  }

  const canSave = r.name.trim().length > 0
  const save = () => {
    if (!canSave) return
    onSave({
      ...r,
      name: r.name.trim(),
      description: r.description.trim(),
      emoji: r.emoji.trim() || '🍽️',
      servings: Math.max(1, parseInt(r.servings) || 1),
      ingredients: r.ingredients.filter(i => i.name.trim()).map(i => ({ name:i.name.trim(), amount:String(i.amount).trim(), unit:String(i.unit).trim() })),
    })
  }

  return (
    <Sheet title={isNew ? 'Add a recipe' : 'Edit recipe'} onClose={onClose}
      footer={<button className="btn btn-primary btn-block" onClick={save} disabled={!canSave}>{isNew ? 'Save recipe' : 'Save changes'}</button>}>
      {isNew && (
        <div className="import-box">
          <p>Paste a link from a recipe site and the details fill in for you to review.</p>
          <div className="add-row">
            <input className="field" type="url" inputMode="url" autoCapitalize="off" autoCorrect="off" value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doImport()} placeholder="https://…" />
            <button className="btn btn-primary" onClick={doImport} disabled={!url.trim() || importing}>{importing ? 'Importing…' : 'Import'}</button>
          </div>
          {importErr && <p className="error">{importErr}</p>}
        </div>
      )}

      <label className="label">Name</label>
      <div className="add-row">
        <input className="field" style={{ width:60, textAlign:'center', fontSize:22, padding:'8px 4px' }} value={r.emoji} onChange={e => set('emoji', e.target.value)} aria-label="Emoji" />
        <input className="field" value={r.name} onChange={e => set('name', e.target.value)} placeholder="Recipe name" />
      </div>
      <label className="label">Description <span>(optional)</span></label>
      <input className="field" value={r.description} onChange={e => set('description', e.target.value)} placeholder="Short description" />
      <label className="label">Servings</label>
      <input className="field" style={{ width:100 }} type="number" inputMode="numeric" min="1" value={r.servings} onChange={e => set('servings', e.target.value)} />

      <label className="label">Ingredients</label>
      {r.ingredients.map((ing, i) => (
        <div className="ing-edit" key={i}>
          <input className="field qty" value={ing.amount} onChange={e => setIng(i, 'amount', e.target.value)} placeholder="Qty" inputMode="decimal" />
          <input className="field unit" value={ing.unit} onChange={e => setIng(i, 'unit', e.target.value)} placeholder="Unit" autoCapitalize="off" />
          <input className="field name" value={ing.name} onChange={e => setIng(i, 'name', e.target.value)} placeholder="Ingredient" />
          <button className="icon-btn" onClick={() => removeIng(i)} aria-label="Remove ingredient" style={{ visibility: ing.name || ing.amount || ing.unit ? 'visible' : 'hidden' }}>×</button>
        </div>
      ))}
      {pasteOpen ? (
        <div style={{ marginTop:6 }}>
          <textarea className="field" rows={5} value={paste} onChange={e => setPaste(e.target.value)} placeholder={'One per line, e.g.\n2 cups rice\n1 lb chicken thighs\n3 cloves garlic'} />
          <div className="add-row" style={{ marginTop:8 }}>
            <button className="btn btn-outline" style={{ flex:1 }} onClick={() => { setPasteOpen(false); setPaste('') }}>Cancel</button>
            <button className="btn btn-soft" style={{ flex:1 }} onClick={addPasted} disabled={!paste.trim()}>Add these</button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost btn" onClick={() => setPasteOpen(true)}>Paste a whole ingredient list</button>
      )}

      <label className="label">Instructions <span>(optional)</span></label>
      <textarea className="field" rows={6} value={r.instructions} onChange={e => set('instructions', e.target.value)} placeholder={'1. Preheat oven…\n2. Season the chicken…'} />
    </Sheet>
  )
}
