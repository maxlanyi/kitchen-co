import { useState, useEffect } from 'react'
import { dbGet, dbSet } from './supabase.js'
import { RECIPES } from './recipes.js'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const C = { bg:'#faf8f4',card:'#fff',warm:'#f5f2ec',border:'#e8e2da',terra:'#c4603c',terrabg:'#fdf0eb',brown:'#3d2b1f',mid:'#7a6a5a',light:'#bfb3a8' }

const CATEGORIES = [
  { id:'produce',   label:'Produce',          emoji:'🥬', keywords:['lettuce','spinach','kale','arugula','cabbage','broccoli','cauliflower','celery','carrot','carrots','onion','onions','shallot','shallots','garlic','ginger','pepper','peppers','tomato','tomatoes','zucchini','squash','eggplant','mushroom','mushrooms','corn','potato','potatoes','sweet potato','asparagus','green bean','pea','peas','artichoke','leek','fennel','beet','beets','radish','cucumber','avocado','lemon','lime','orange','apple','pear','banana','strawberr','blueberr','raspberr','blackberr','grape','mango','peach','plum','cherry','melon','watermelon','pineapple','kiwi','fig','date','pomegranate','herbs','parsley','basil','cilantro','dill','mint','rosemary','thyme','oregano','sage','chive','tarragon','scallion','green onion','jalapeño','jalapeno','serrano','habanero','chili','chile','berries'] },
  { id:'meat',      label:'Meat & Seafood',   emoji:'🥩', keywords:['chicken','beef','pork','lamb','veal','turkey','duck','bison','venison','steak','ground beef','ground pork','ground turkey','ground chicken','sausage','bacon','pancetta','guanciale','prosciutto','salami','pepperoni','ham','chorizo','hot dog','brat','short rib','chuck','sirloin','tenderloin','rib','loin','breast','thigh','drumstick','wing','whole chicken','rotisserie','shrimp','salmon','tuna','cod','tilapia','halibut','sea bass','snapper','mahi','trout','scallop','lobster','crab','clam','mussel','oyster','anchovy','sardine','squid','octopus','fish','seafood','filet','fillet'] },
  { id:'dairy',     label:'Dairy & Eggs',     emoji:'🥛', keywords:['milk','cream','half and half','butter','ghee','egg','eggs','cheese','parmesan','parmigiano','pecorino','mozzarella','ricotta','cheddar','gouda','brie','feta','gorgonzola','gruyere','provolone','swiss','american','goat cheese','cream cheese','sour cream','yogurt','greek yogurt','cottage cheese','kefir','whey','buttermilk','heavy cream','whipping cream','crème fraîche','creme fraiche'] },
  { id:'bakery',    label:'Bakery & Bread',   emoji:'🍞', keywords:['bread','baguette','sourdough','ciabatta','focaccia','pita','naan','tortilla','wrap','roll','bun','bagel','muffin','croissant','pastry','cake','cookie','cracker','breadcrumb','breadcrumbs','panko','flour','cornmeal','oat','oats','granola'] },
  { id:'pantry',    label:'Pantry & Dry Goods',emoji:'🥫', keywords:['pasta','spaghetti','fettuccine','penne','rigatoni','tagliatelle','linguine','lasagna','orzo','couscous','rice','quinoa','lentil','lentils','bean','beans','chickpea','chickpeas','tomato sauce','marinara','crushed tomato','diced tomato','tomato paste','tomato puree','broth','stock','soup','coconut milk','olive oil','vegetable oil','sesame oil','canola oil','avocado oil','vinegar','balsamic','soy sauce','worcestershire','fish sauce','hot sauce','mustard','ketchup','mayo','mayonnaise','tahini','peanut butter','almond butter','honey','maple syrup','molasses','jam','jelly','canned','jar','can','box','package','dried','salt','pepper','sugar','brown sugar','powder','baking soda','baking powder','vanilla','extract','cornstarch','arrowroot','gelatin','yeast','capers','olive','olives','pickles','relish','salsa','pesto','hummus','tapenade','anchovy paste','tomato','sauce'] },
  { id:'spices',    label:'Spices & Seasonings',emoji:'🌶️', keywords:['cumin','coriander','turmeric','paprika','smoked paprika','cayenne','chili powder','red pepper flake','cinnamon','nutmeg','cardamom','clove','allspice','star anise','bay leaf','bay leaves','fennel seed','caraway','mustard seed','celery seed','curry','garam masala','za\'atar','sumac','oregano','thyme','rosemary','sage','marjoram','herbes','seasoning','spice','rub','blend','cajun','italian seasoning','everything bagel','old bay','chinese five spice','black pepper','white pepper','pink salt','sea salt','kosher salt','flaky salt'] },
  { id:'drinks',    label:'Drinks & Beverages',emoji:'🍷', keywords:['wine','red wine','white wine','prosecco','champagne','beer','lager','ale','stout','spirits','vodka','gin','rum','tequila','whiskey','bourbon','brandy','vermouth','juice','orange juice','apple juice','lemon juice','lime juice','sparkling water','soda','water','coffee','espresso','tea','milk alternative','oat milk','almond milk','soy milk','coconut water'] },
  { id:'frozen',    label:'Frozen',            emoji:'🧊', keywords:['frozen','ice cream','gelato','sorbet','popsicle','frozen vegetable','frozen fruit','frozen pizza','frozen meal'] },
  { id:'other',     label:'Other',             emoji:'🛒', keywords:[] },
]

function getCategory(name) {
  const lower = name.toLowerCase()
  for (const cat of CATEGORIES) {
    if (cat.id === 'other') continue
    if (cat.keywords.some(kw => lower.includes(kw))) return cat.id
  }
  return 'other'
}

function buildGrocery(recipes, dinners, laurenLunches, maxLunches, customItems) {
  const assignedIds = [
    ...Object.values(dinners),
    ...Object.values(laurenLunches),
    ...Object.values(maxLunches)
  ].filter(v => v && recipes.find(r => r.id === v))
  const map = {}
  for (const r of recipes.filter(r => assignedIds.includes(r.id))) {
    for (const ing of r.ingredients) {
      const key = ing.name.toLowerCase().trim()
      if (!map[key]) map[key] = { name:ing.name, entries:[], recipes:[] }
      map[key].entries.push({ amount:ing.amount, unit:ing.unit })
      if (!map[key].recipes.includes(r.name)) map[key].recipes.push(r.name)
    }
  }
  const recipeItems = Object.entries(map).map(([key,v]) => ({ key, ...v, custom:false })).sort((a,b) => a.name.localeCompare(b.name))
  const custom = customItems.map(ci => ({ key:`custom_${ci.id}`, name:ci.name, entries:[], recipes:[], custom:true, id:ci.id }))
  return [...recipeItems, ...custom]
}

const inp = { background:'#f5f2ec', border:'1px solid #e8e2da', borderRadius:8, padding:'0.45rem 0.75rem', fontFamily:"'DM Sans',sans-serif", fontSize:'0.85rem', color:'#3d2b1f' }

export default function App() {
  const [tab, setTab] = useState(0)
  const [recipes, setRecipes] = useState(RECIPES)
  const [dinners, setDinners] = useState(Object.fromEntries(DAYS.map(d => [d, null])))
  const [laurenLunches, setLaurenLunches] = useState(Object.fromEntries(DAYS.map(d => [d, null])))
  const [maxLunches, setMaxLunches] = useState(Object.fromEntries(DAYS.map(d => [d, null])))
  const [checked, setChecked] = useState({})
  const [customItems, setCustomItems] = useState([])
  const [customInput, setCustomInput] = useState('')
  const [viewRecipe, setViewRecipe] = useState(null)
  const [viewTab, setViewTab] = useState('ingredients')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editRecipe, setEditRecipe] = useState(null)
  const [reorderMode, setReorderMode] = useState(false) // recipe being edited
  const [picker, setPicker] = useState(null)
  const [pickerText, setPickerText] = useState('')
  const [assignRecipe, setAssignRecipe] = useState(null) // recipe being assigned from Library
  const [newR, setNewR] = useState({ name:'', description:'', emoji:'🍽️', servings:4, instructions:'', ingredients:[{name:'',amount:'',unit:''}] })
  const [loaded, setLoaded] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [categoryOverrides, setCategoryOverrides] = useState({}) // key -> categoryId
  const [catPicker, setCatPicker] = useState(null) // grocery item key being re-categorized

  // Load all data from Supabase on mount
  useEffect(() => {
    ;(async () => {
      setSyncing(true)
      const [r, d, ll, ml, c, ci, co] = await Promise.all([
        dbGet('recipes'), dbGet('dinners'), dbGet('lauren_lunches'),
        dbGet('max_lunches'), dbGet('checked'), dbGet('custom_items'), dbGet('cat_overrides')
      ])
      if (r) setRecipes(JSON.parse(r))
      if (d) setDinners(JSON.parse(d))
      if (ll) setLaurenLunches(JSON.parse(ll))
      if (ml) setMaxLunches(JSON.parse(ml))
      if (c) setChecked(JSON.parse(c))
      if (ci) setCustomItems(JSON.parse(ci))
      if (co) setCategoryOverrides(JSON.parse(co))
      setLoaded(true)
      setSyncing(false)
    })()
  }, [])

  // Save to Supabase whenever data changes (after initial load)
  useEffect(() => { if (loaded) dbSet('recipes', JSON.stringify(recipes)) }, [recipes, loaded])
  useEffect(() => { if (loaded) dbSet('dinners', JSON.stringify(dinners)) }, [dinners, loaded])
  useEffect(() => { if (loaded) dbSet('lauren_lunches', JSON.stringify(laurenLunches)) }, [laurenLunches, loaded])
  useEffect(() => { if (loaded) dbSet('max_lunches', JSON.stringify(maxLunches)) }, [maxLunches, loaded])
  useEffect(() => { if (loaded) dbSet('checked', JSON.stringify(checked)) }, [checked, loaded])
  useEffect(() => { if (loaded) dbSet('custom_items', JSON.stringify(customItems)) }, [customItems, loaded])
  useEffect(() => { if (loaded) dbSet('cat_overrides', JSON.stringify(categoryOverrides)) }, [categoryOverrides, loaded])

  const grocery = buildGrocery(recipes, dinners, laurenLunches, maxLunches, customItems)
  const uncheckedG = grocery.filter(i => !checked[i.key])
  const checkedG = grocery.filter(i => checked[i.key])
  const mealCount = [...Object.values(dinners), ...Object.values(laurenLunches), ...Object.values(maxLunches)].filter(Boolean).length

  const assignDay = (section, day, value) => {
    if (section === 'dinner') setDinners(p => ({ ...p, [day]: value }))
    else if (section === 'lauren') setLaurenLunches(p => ({ ...p, [day]: value }))
    else setMaxLunches(p => ({ ...p, [day]: value }))
    setPicker(null); setPickerText('')
  }
  const clearSlot = (section, day) => {
    if (section === 'dinner') setDinners(p => ({ ...p, [day]: null }))
    else if (section === 'lauren') setLaurenLunches(p => ({ ...p, [day]: null }))
    else setMaxLunches(p => ({ ...p, [day]: null }))
  }
  const openPicker = (section, day) => { setPicker({ section, day }); setPickerText('') }
  const toggleChk = key => setChecked(p => ({ ...p, [key]: !p[key] }))
  const addCustom = () => { if (!customInput.trim()) return; setCustomItems(p => [...p, { id:Date.now().toString(), name:customInput.trim() }]); setCustomInput('') }
  const removeCustom = id => { setCustomItems(p => p.filter(x => x.id !== id)); setChecked(p => { const n={...p}; delete n[`custom_${id}`]; return n }) }
  const moveRecipe = (index, dir) => {
    const newList = [...recipes]
    const target = index + dir
    if (target < 0 || target >= newList.length) return
    ;[newList[index], newList[target]] = [newList[target], newList[index]]
    setRecipes(newList)
  }
  const saveRecipe = () => {
    if (!newR.name.trim()) return
    setRecipes(p => [...p, { ...newR, id:Date.now().toString(), ingredients:newR.ingredients.filter(i=>i.name.trim()) }])
    setShowAdd(false)
    setNewR({ name:'', description:'', emoji:'🍽️', servings:4, instructions:'', ingredients:[{name:'',amount:'',unit:''}] })
  }

  const saveEdit = () => {
    if (!editRecipe.name.trim()) return
    setRecipes(p => p.map(r => r.id === editRecipe.id ? { ...editRecipe, ingredients: editRecipe.ingredients.filter(i => i.name.trim()) } : r))
    setEditRecipe(null)
  }

  const updateEditIng = (i, f, v) => {
    const ings = [...editRecipe.ingredients]; ings[i] = {...ings[i],[f]:v}; setEditRecipe(p => ({...p, ingredients:ings}))
  }

  if (!loaded) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:C.bg, fontFamily:"'DM Sans',sans-serif" }}>
      <p style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>🍽️</p>
      <p style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'1.5rem', marginBottom:'0.5rem' }}>Kitchen & Co.</p>
      <p style={{ color:C.light, fontSize:'0.85rem' }}>Loading your kitchen...</p>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;} body{background:#faf8f4;}
        .rc:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(74,55,40,0.1)!important;}
        .gr:hover{background:#fdf9f6;} .day-row:hover{background:#fdf9f6;} button{cursor:pointer;}
        input:focus,textarea:focus{border-color:#c4603c!important;outline:none;}
      `}</style>

      <div style={{ maxWidth:520, margin:'0 auto', minHeight:'100vh', background:C.bg, fontFamily:"'DM Sans',sans-serif" }}>

        {/* Header */}
        <div style={{ background:'#3d2b1f', padding:'1.75rem 1.5rem 1.25rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-40, right:-20, width:180, height:180, borderRadius:'50%', background:'rgba(196,96,60,0.12)' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', position:'relative' }}>
            <div>
              <p style={{ color:'#c4603c', fontSize:'0.68rem', fontWeight:500, letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:'0.3rem' }}>Max & Lauren's</p>
              <h1 style={{ fontFamily:"'Playfair Display',serif", color:'#faf8f4', fontSize:'2rem', fontWeight:600, letterSpacing:'-0.02em' }}>Kitchen & Co.</h1>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ color:'#8a7a6a', fontSize:'0.72rem', marginBottom:'0.2rem' }}>{syncing ? '⟳ syncing...' : 'this week'}</p>
              <p style={{ fontFamily:"'Playfair Display',serif", color:'#c4603c', fontSize:'1.05rem', fontWeight:600 }}>{mealCount} meal{mealCount !== 1 ? 's' : ''} planned</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', background:C.warm, borderBottom:`1px solid ${C.border}` }}>
          {['📖 Library','🗓️ This Week','🛒 Grocery'].map((t, i) => (
            <button key={i} onClick={() => setTab(i)} style={{ flex:1, padding:'0.875rem 0.5rem', border:'none', background:'transparent', color:tab===i?C.terra:'#8a7a6a', fontFamily:"'DM Sans',sans-serif", fontSize:'0.8rem', fontWeight:tab===i?600:400, borderBottom:tab===i?`2px solid ${C.terra}`:'2px solid transparent' }}>
              {t}
              {i===2 && grocery.length > 0 && <Pill>{uncheckedG.length}</Pill>}
            </button>
          ))}
        </div>

        <div style={{ padding:'1.25rem' }}>

          {/* ── LIBRARY ── */}
          {tab === 0 && <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <p style={{ color:C.light, fontSize:'0.82rem' }}>{recipes.length} recipes saved</p>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <Btn variant={reorderMode ? 'selected' : 'outline'} onClick={() => setReorderMode(p => !p)} style={{ fontSize:'0.78rem', padding:'0.45rem 0.75rem' }}>
                  {reorderMode ? '✓ Done' : '↕ Reorder'}
                </Btn>
                {!reorderMode && <Btn onClick={() => setShowAdd(true)}>+ Add Recipe</Btn>}
              </div>
            </div>

            {reorderMode ? (
              // REORDER MODE — single column list with up/down arrows
              <div>
                {recipes.map((r, index) => (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', background:C.card, borderRadius:12, padding:'0.75rem', border:`1px solid ${C.border}`, marginBottom:'0.5rem' }}>
                    <span style={{ fontSize:'1.4rem', flexShrink:0 }}>{r.emoji}</span>
                    <p style={{ flex:1, fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'0.88rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.2rem', flexShrink:0 }}>
                      <button onClick={() => moveRecipe(index, -1)} disabled={index === 0}
                        style={{ background:index===0?C.warm:C.terrabg, border:`1px solid ${index===0?C.border:'#e8846a'}`, borderRadius:6, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', cursor:index===0?'default':'pointer', color:index===0?C.light:C.terra, fontSize:'0.8rem', fontWeight:700 }}>↑</button>
                      <button onClick={() => moveRecipe(index, 1)} disabled={index === recipes.length - 1}
                        style={{ background:index===recipes.length-1?C.warm:C.terrabg, border:`1px solid ${index===recipes.length-1?C.border:'#e8846a'}`, borderRadius:6, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', cursor:index===recipes.length-1?'default':'pointer', color:index===recipes.length-1?C.light:C.terra, fontSize:'0.8rem', fontWeight:700 }}>↓</button>
                    </div>
                  </div>
                ))}
                <p style={{ color:C.light, fontSize:'0.78rem', textAlign:'center', marginTop:'0.75rem' }}>Tap ↑ ↓ to reorder · tap Done when finished</p>
              </div>
            ) : (
              // NORMAL GRID MODE
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                {recipes.map(r => (
                  <div key={r.id} className={confirmDelete===r.id?'':'rc'} style={{ background:C.card, borderRadius:16, padding:'1rem', border:`1px solid ${confirmDelete===r.id?'#e8846a':C.border}`, boxShadow:'0 1px 4px rgba(74,55,40,0.05)', transition:'all 0.2s', minHeight:155 }}>
                    {confirmDelete === r.id ? (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', minHeight:135, gap:'0.5rem', textAlign:'center' }}>
                        <span style={{ fontSize:'1.3rem' }}>🗑️</span>
                        <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'0.75rem', color:C.mid, lineHeight:1.4 }}>Delete <strong style={{ color:C.brown }}>{r.name}</strong>?</p>
                        <div style={{ display:'flex', gap:'0.4rem', width:'100%', marginTop:'0.2rem' }}>
                          <button onClick={() => setConfirmDelete(null)} style={{ flex:1, padding:'0.42rem', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent', fontFamily:"'DM Sans',sans-serif", fontSize:'0.73rem', color:C.mid }}>Cancel</button>
                          <button onClick={() => { setRecipes(p => p.filter(x => x.id !== r.id)); setConfirmDelete(null) }} style={{ flex:1, padding:'0.42rem', borderRadius:8, border:'none', background:'#c0392b', color:'white', fontFamily:"'DM Sans',sans-serif", fontSize:'0.73rem', fontWeight:500 }}>Delete</button>
                        </div>
                      </div>
                    ) : <>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.4rem' }}>
                        <span style={{ fontSize:'1.6rem' }}>{r.emoji}</span>
                        <button onClick={() => setConfirmDelete(r.id)} style={{ background:'none', border:'none', color:'#ddd', fontSize:'1rem', lineHeight:1, padding:'0 0.2rem' }}>×</button>
                      </div>
                      <h3 style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'0.9rem', lineHeight:1.25, marginBottom:'0.25rem' }}>{r.name}</h3>
                      <p style={{ color:'#9a8a7a', fontSize:'0.72rem', lineHeight:1.4, marginBottom:'0.5rem' }}>{r.description}</p>
                      <p style={{ color:C.light, fontSize:'0.68rem', marginBottom:'0.75rem' }}>{r.ingredients.length} ingredients</p>
                      <div style={{ display:'flex', gap:'0.35rem' }}>
                        <Btn variant="outline" onClick={() => { setViewRecipe(r); setViewTab('ingredients') }} style={{ flex:1, padding:'0.38rem', fontSize:'0.72rem' }}>View</Btn>
                        <Btn variant="outline" onClick={() => setEditRecipe({ ...r, ingredients: [...r.ingredients] })} style={{ flex:1, padding:'0.38rem', fontSize:'0.72rem' }}>Edit</Btn>
                        <Btn onClick={() => setAssignRecipe(r)} style={{ flex:1, padding:'0.38rem', fontSize:'0.72rem' }}>+ Week</Btn>
                      </div>
                    </>}
                  </div>
                ))}
              </div>
            )}
          </>}

          {/* ── THIS WEEK ── */}
          {tab === 1 && <>
            <Section label="🍽️ Dinners">
              {DAYS.map(day => <MealSlot key={day} day={day} value={dinners[day]} recipes={recipes} onAdd={() => openPicker('dinner', day)} onClear={() => clearSlot('dinner', day)} />)}
            </Section>
            <Section label="🥗 Lauren's Lunches">
              {DAYS.map(day => <MealSlot key={day} day={day} value={laurenLunches[day]} recipes={recipes} onAdd={() => openPicker('lauren', day)} onClear={() => clearSlot('lauren', day)} />)}
            </Section>
            <Section label="🥙 Max's Lunches">
              {DAYS.map(day => <MealSlot key={day} day={day} value={maxLunches[day]} recipes={recipes} onAdd={() => openPicker('max', day)} onClear={() => clearSlot('max', day)} />)}
            </Section>
            {Object.values(dinners).some(Boolean) && <Btn onClick={() => setTab(2)} style={{ width:'100%', marginTop:'0.5rem', padding:'0.875rem', fontSize:'0.88rem', borderRadius:12 }}>View Grocery List →</Btn>}
          </>}

          {/* ── GROCERY ── */}
          {tab === 2 && <>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'0.875rem', marginBottom:'1.25rem' }}>
              <p style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'0.88rem', marginBottom:'0.625rem' }}>Add one-off item</p>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <input value={customInput} onChange={e => setCustomInput(e.target.value)} onKeyDown={e => e.key==='Enter'&&addCustom()} placeholder="e.g. paper towels, olive oil, wine..." style={{ ...inp, flex:1 }} />
                <Btn onClick={addCustom} style={{ padding:'0.5rem 0.875rem', borderRadius:9, flexShrink:0 }}>Add</Btn>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.875rem' }}>
              <p style={{ color:C.light, fontSize:'0.82rem' }}>{grocery.length === 0 ? 'Plan dinners or add items above' : `${uncheckedG.length} remaining · ${checkedG.length} in basket`}</p>
              {checkedG.length > 0 && <button onClick={() => setChecked({})} style={{ background:'none', border:'none', color:C.terra, fontSize:'0.78rem', fontFamily:"'DM Sans',sans-serif", cursor:'pointer' }}>Reset all</button>}
            </div>
            {grocery.length === 0
              ? <Empty emoji="🛒" text="Plan your dinners and your grocery list builds automatically." cta="Plan This Week" onCta={() => setTab(1)} />
              : (() => {
                  // Group unchecked items by category
                  const grouped = {}
                  for (const item of uncheckedG) {
                    const catId = categoryOverrides[item.key] || getCategory(item.name)
                    if (!grouped[catId]) grouped[catId] = []
                    grouped[catId].push(item)
                  }
                  return <>
                    {CATEGORIES.filter(cat => grouped[cat.id]?.length > 0).map(cat => (
                      <div key={cat.id} style={{ marginBottom:'1.25rem' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.4rem', paddingBottom:'0.4rem', borderBottom:`1px solid ${C.border}` }}>
                          <span style={{ fontSize:'1rem' }}>{cat.emoji}</span>
                          <p style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'0.88rem', fontWeight:600 }}>{cat.label}</p>
                          <span style={{ color:C.light, fontSize:'0.72rem', marginLeft:'auto' }}>{grouped[cat.id].length} item{grouped[cat.id].length!==1?'s':''}</span>
                        </div>
                        {grouped[cat.id].map(item => (
                          <GrocRow key={item.key} item={item} chk={false}
                            catId={categoryOverrides[item.key] || getCategory(item.name)}
                            onToggle={() => toggleChk(item.key)}
                            onRemove={item.custom ? () => removeCustom(item.id) : null}
                            onCatTap={() => setCatPicker(item)}
                          />
                        ))}
                      </div>
                    ))}
                    {checkedG.length > 0 && <>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.4rem', paddingBottom:'0.4rem', borderBottom:`1px solid ${C.border}` }}>
                        <span style={{ fontSize:'1rem' }}>✅</span>
                        <p style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'0.88rem', fontWeight:600 }}>In Basket</p>
                        <span style={{ color:C.light, fontSize:'0.72rem', marginLeft:'auto' }}>{checkedG.length} item{checkedG.length!==1?'s':''}</span>
                      </div>
                      {checkedG.map(item => (
                        <GrocRow key={item.key} item={item} chk={true}
                          catId={categoryOverrides[item.key] || getCategory(item.name)}
                          onToggle={() => toggleChk(item.key)}
                          onRemove={item.custom ? () => removeCustom(item.id) : null}
                          onCatTap={() => setCatPicker(item)}
                        />
                      ))}
                    </>}
                  </>
                })()
            }
          </>}
        </div>

        {/* ── CATEGORY PICKER MODAL ── */}
        {catPicker && <Modal onClose={() => setCatPicker(null)}>
          <h2 style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'1.1rem', marginBottom:'0.25rem' }}>Move "{catPicker.name}"</h2>
          <p style={{ color:C.light, fontSize:'0.78rem', marginBottom:'1rem' }}>Which section does this belong in?</p>
          {CATEGORIES.map(cat => {
            const current = categoryOverrides[catPicker.key] || getCategory(catPicker.name)
            const isSelected = current === cat.id
            return (
              <button key={cat.id} onClick={() => { setCategoryOverrides(p => ({ ...p, [catPicker.key]: cat.id })); setCatPicker(null) }}
                style={{ display:'flex', alignItems:'center', gap:'0.75rem', width:'100%', background:isSelected?C.terrabg:C.warm, border:`1px solid ${isSelected?'#e8846a':C.border}`, borderRadius:10, padding:'0.7rem 0.875rem', marginBottom:'0.4rem', cursor:'pointer', textAlign:'left' }}>
                <span style={{ fontSize:'1.2rem' }}>{cat.emoji}</span>
                <span style={{ fontFamily:"'DM Sans',sans-serif", color:C.brown, fontSize:'0.88rem', flex:1 }}>{cat.label}</span>
                {isSelected && <span style={{ color:C.terra, fontSize:'0.8rem', fontWeight:600 }}>✓</span>}
              </button>
            )
          })}
        </Modal>}


        {assignRecipe && <Modal onClose={() => setAssignRecipe(null)}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.25rem' }}>
            <span style={{ fontSize:'2rem' }}>{assignRecipe.emoji}</span>
            <div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'1.1rem' }}>Where does {assignRecipe.name} go?</h2>
              <p style={{ color:C.light, fontSize:'0.78rem', marginTop:'0.2rem' }}>Tap a slot to assign it</p>
            </div>
          </div>
          {[
            { label:'🍽️ Dinners', section:'dinner', map:dinners },
            { label:"🥗 Lauren's Lunches", section:'lauren', map:laurenLunches },
            { label:"🥙 Max's Lunches", section:'max', map:maxLunches },
          ].map(({ label, section, map }) => (
            <div key={section} style={{ marginBottom:'1.25rem' }}>
              <p style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'0.88rem', fontWeight:600, marginBottom:'0.5rem' }}>{label}</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.4rem' }}>
                {DAYS.map(day => {
                  const cur = map[day]
                  const isThis = cur === assignRecipe.id
                  const takenBy = cur && cur !== assignRecipe.id ? (recipes.find(r => r.id === cur)?.name || cur) : null
                  return (
                    <button key={day} onClick={() => { assignDay(section, day, assignRecipe.id); setAssignRecipe(null) }}
                      style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', background:isThis?C.terrabg:C.warm, border:`1px solid ${isThis?'#e8846a':C.border}`, borderRadius:10, padding:'0.55rem 0.7rem', cursor:'pointer', textAlign:'left' }}>
                      <span style={{ color:isThis?C.terra:C.light, fontSize:'0.65rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>{day.slice(0,3)}</span>
                      <span style={{ color:isThis?C.terra:takenBy?C.mid:C.light, fontSize:'0.75rem', marginTop:'0.15rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%' }}>
                        {isThis ? '✓ assigned' : takenBy ? `${takenBy.slice(0,14)}${takenBy.length>14?'…':''}` : 'open'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </Modal>}

        {/* ── PICKER MODAL (from This Week tab) ── */}
        {picker && <Modal onClose={() => { setPicker(null); setPickerText('') }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'1.1rem', marginBottom:'0.25rem' }}>
            {picker.section === 'dinner' ? '🍽️ Dinner' : picker.section === 'lauren' ? "🥗 Lauren's Lunch" : "🥙 Max's Lunch"} — {picker.day}
          </h2>
          <p style={{ color:C.light, fontSize:'0.78rem', marginBottom:'1rem' }}>Type anything or pick from your library</p>
          <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem' }}>
            <input value={pickerText} onChange={e => setPickerText(e.target.value)} onKeyDown={e => e.key==='Enter'&&pickerText.trim()&&assignDay(picker.section,picker.day,pickerText.trim())} placeholder="Type a meal name..." style={{ ...inp, flex:1 }} />
            <Btn onClick={() => pickerText.trim()&&assignDay(picker.section,picker.day,pickerText.trim())} disabled={!pickerText.trim()} style={{ padding:'0.5rem 0.75rem', borderRadius:9, flexShrink:0 }}>Set</Btn>
          </div>
          <p style={{ color:C.light, fontSize:'0.73rem', marginBottom:'0.625rem', textTransform:'uppercase', letterSpacing:'0.08em', textAlign:'center' }}>— or pick from library —</p>
          {recipes.map(r => {
            const cur = picker.section==='dinner'?dinners[picker.day]:picker.section==='lauren'?laurenLunches[picker.day]:maxLunches[picker.day]
            const isSel = cur === r.id
            return (
              <button key={r.id} onClick={() => assignDay(picker.section,picker.day,r.id)} style={{ display:'flex', alignItems:'center', gap:'0.75rem', width:'100%', background:isSel?C.terrabg:C.warm, border:`1px solid ${isSel?'#e8846a':C.border}`, borderRadius:12, padding:'0.75rem', marginBottom:'0.4rem', cursor:'pointer', textAlign:'left' }}>
                <span style={{ fontSize:'1.3rem', flexShrink:0 }}>{r.emoji}</span>
                <div style={{ flex:1 }}>
                  <p style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'0.88rem' }}>{r.name}</p>
                  <p style={{ color:C.light, fontSize:'0.72rem', marginTop:'0.1rem' }}>{r.description}</p>
                </div>
                {isSel && <span style={{ color:C.terra, fontSize:'0.8rem', fontWeight:600, flexShrink:0 }}>✓</span>}
              </button>
            )
          })}
        </Modal>}

        {/* ── RECIPE DETAIL MODAL ── */}
        {viewRecipe && <Modal onClose={() => setViewRecipe(null)}>
          <div style={{ textAlign:'center', marginBottom:'1rem' }}>
            <span style={{ fontSize:'2.75rem' }}>{viewRecipe.emoji}</span>
            <h2 style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'1.3rem', marginTop:'0.4rem' }}>{viewRecipe.name}</h2>
            <p style={{ color:'#9a8a7a', fontSize:'0.8rem', marginTop:'0.2rem', fontStyle:'italic' }}>{viewRecipe.description}</p>
            <p style={{ color:C.light, fontSize:'0.72rem', marginTop:'0.2rem' }}>Serves {viewRecipe.servings}</p>
          </div>
          <div style={{ display:'flex', background:C.warm, borderRadius:10, padding:'0.25rem', marginBottom:'1rem', gap:'0.25rem' }}>
            {['ingredients','instructions'].map(t => (
              <button key={t} onClick={() => setViewTab(t)} style={{ flex:1, padding:'0.5rem', border:'none', borderRadius:8, background:viewTab===t?'white':'transparent', color:viewTab===t?C.brown:C.light, fontFamily:"'DM Sans',sans-serif", fontSize:'0.8rem', fontWeight:viewTab===t?500:400, boxShadow:viewTab===t?'0 1px 3px rgba(74,55,40,0.1)':'none', textTransform:'capitalize' }}>{t}</button>
            ))}
          </div>
          {viewTab === 'ingredients' && <div style={{ background:C.warm, borderRadius:12, padding:'0.875rem', marginBottom:'1rem' }}>
            {viewRecipe.ingredients.map((ing, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'0.35rem 0', borderBottom:i<viewRecipe.ingredients.length-1?`1px solid ${C.border}`:'none', fontFamily:"'DM Sans',sans-serif", fontSize:'0.84rem' }}>
                <span style={{ color:C.brown }}>{ing.name}</span>
                <span style={{ color:C.terra, fontWeight:500 }}>{[ing.amount,ing.unit].filter(Boolean).join(' ')||'—'}</span>
              </div>
            ))}
          </div>}
          {viewTab === 'instructions' && <div style={{ background:C.warm, borderRadius:12, padding:'1rem', marginBottom:'1rem', minHeight:100 }}>
            {viewRecipe.instructions ? <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'0.85rem', color:C.mid, lineHeight:1.8, whiteSpace:'pre-line' }}>{viewRecipe.instructions}</p> : <p style={{ color:C.light, fontSize:'0.83rem', fontStyle:'italic', textAlign:'center', paddingTop:'1rem' }}>No instructions added yet.</p>}
          </div>}
          <Btn onClick={() => { setViewRecipe(null); setAssignRecipe(viewRecipe) }} style={{ width:'100%', padding:'0.875rem', fontSize:'0.88rem', borderRadius:12 }}>+ Add to a Day This Week</Btn>
        </Modal>}

        {/* ── EDIT RECIPE MODAL ── */}
        {editRecipe && <Modal onClose={() => setEditRecipe(null)}>
          <h2 style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'1.25rem', marginBottom:'1rem' }}>Edit Recipe</h2>
          <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.5rem' }}>
            <input value={editRecipe.emoji} onChange={e => setEditRecipe(p=>({...p,emoji:e.target.value}))} style={{ ...inp, width:50, textAlign:'center', fontSize:'1.2rem' }} />
            <input value={editRecipe.name} onChange={e => setEditRecipe(p=>({...p,name:e.target.value}))} placeholder="Recipe name" style={{ ...inp, flex:1 }} />
          </div>
          <input value={editRecipe.description} onChange={e => setEditRecipe(p=>({...p,description:e.target.value}))} placeholder="Short description" style={{ ...inp, width:'100%', marginBottom:'0.5rem' }} />
          <input type="number" value={editRecipe.servings} onChange={e => setEditRecipe(p=>({...p,servings:parseInt(e.target.value)||1}))} placeholder="Servings" style={{ ...inp, width:'100%', marginBottom:'1rem' }} />
          <p style={{ color:C.mid, fontSize:'0.8rem', fontWeight:500, marginBottom:'0.4rem' }}>Ingredients</p>
          {editRecipe.ingredients.map((ing, i) => (
            <div key={i} style={{ display:'flex', gap:'0.4rem', marginBottom:'0.4rem' }}>
              <input value={ing.amount} onChange={e => updateEditIng(i,'amount',e.target.value)} placeholder="Qty" style={{ ...inp, width:48, textAlign:'center' }} />
              <input value={ing.unit} onChange={e => updateEditIng(i,'unit',e.target.value)} placeholder="Unit" style={{ ...inp, width:62 }} />
              <input value={ing.name} onChange={e => updateEditIng(i,'name',e.target.value)} placeholder="Ingredient" style={{ ...inp, flex:1 }} />
              <button onClick={() => setEditRecipe(p => ({...p, ingredients: p.ingredients.filter((_,j)=>j!==i)}))} style={{ background:'none', border:'none', color:'#ccc', fontSize:'1rem', cursor:'pointer', flexShrink:0, padding:'0 0.2rem' }}>×</button>
            </div>
          ))}
          <button onClick={() => setEditRecipe(p=>({...p,ingredients:[...p.ingredients,{name:'',amount:'',unit:''}]}))} style={{ background:'none', border:'none', color:C.terra, fontSize:'0.8rem', fontFamily:"'DM Sans',sans-serif", marginBottom:'1.25rem', padding:0, cursor:'pointer' }}>+ Add ingredient</button>
          <p style={{ color:C.mid, fontSize:'0.8rem', fontWeight:500, marginBottom:'0.4rem' }}>Instructions <span style={{ color:C.light, fontWeight:400 }}>(optional)</span></p>
          <textarea value={editRecipe.instructions} onChange={e => setEditRecipe(p=>({...p,instructions:e.target.value}))} rows={5} style={{ ...inp, width:'100%', lineHeight:1.6, marginBottom:'1.25rem', resize:'vertical' }} />
          <Btn onClick={saveEdit} disabled={!editRecipe.name.trim()} style={{ width:'100%', padding:'0.875rem', fontSize:'0.88rem', borderRadius:12, opacity:!editRecipe.name.trim()?0.5:1 }}>Save Changes</Btn>
        </Modal>}

        {/* ── ADD RECIPE MODAL ── */}
        {showAdd && <Modal onClose={() => setShowAdd(false)}>
          <h2 style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'1.25rem', marginBottom:'1rem' }}>Add a Recipe</h2>
          <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.5rem' }}>
            <input value={newR.emoji} onChange={e => setNewR(p=>({...p,emoji:e.target.value}))} style={{ ...inp, width:50, textAlign:'center', fontSize:'1.2rem' }} />
            <input value={newR.name} onChange={e => setNewR(p=>({...p,name:e.target.value}))} placeholder="Recipe name" style={{ ...inp, flex:1 }} />
          </div>
          <input value={newR.description} onChange={e => setNewR(p=>({...p,description:e.target.value}))} placeholder="Short description (optional)" style={{ ...inp, width:'100%', marginBottom:'1rem' }} />
          <p style={{ color:C.mid, fontSize:'0.8rem', fontWeight:500, marginBottom:'0.4rem' }}>Ingredients</p>
          {newR.ingredients.map((ing, i) => (
            <div key={i} style={{ display:'flex', gap:'0.4rem', marginBottom:'0.4rem' }}>
              <input value={ing.amount} onChange={e => updateIng(i,'amount',e.target.value)} placeholder="Qty" style={{ ...inp, width:48, textAlign:'center' }} />
              <input value={ing.unit} onChange={e => updateIng(i,'unit',e.target.value)} placeholder="Unit" style={{ ...inp, width:62 }} />
              <input value={ing.name} onChange={e => updateIng(i,'name',e.target.value)} placeholder="Ingredient" style={{ ...inp, flex:1 }} />
            </div>
          ))}
          <button onClick={() => setNewR(p=>({...p,ingredients:[...p.ingredients,{name:'',amount:'',unit:''}]}))} style={{ background:'none', border:'none', color:C.terra, fontSize:'0.8rem', fontFamily:"'DM Sans',sans-serif", marginBottom:'1.25rem', padding:0 }}>+ Add ingredient</button>
          <p style={{ color:C.mid, fontSize:'0.8rem', fontWeight:500, marginBottom:'0.4rem' }}>Instructions <span style={{ color:C.light, fontWeight:400 }}>(optional)</span></p>
          <textarea value={newR.instructions} onChange={e => setNewR(p=>({...p,instructions:e.target.value}))} rows={5} placeholder={'1. Preheat oven...\n2. Season the chicken...'} style={{ ...inp, width:'100%', lineHeight:1.6, marginBottom:'1.25rem', resize:'vertical' }} />
          <Btn onClick={saveRecipe} disabled={!newR.name.trim()} style={{ width:'100%', padding:'0.875rem', fontSize:'0.88rem', borderRadius:12, opacity:!newR.name.trim()?0.5:1 }}>Save Recipe</Btn>
        </Modal>}

      </div>
    </>
  )
}

function MealSlot({ day, value, recipes, onAdd, onClear }) {
  const recipe = value && recipes.find(r => r.id === value)
  const label = recipe ? recipe.name : (typeof value === 'string' && value) ? value : null
  const emoji = recipe ? recipe.emoji : null
  return (
    <div className="day-row" style={{ display:'flex', alignItems:'center', gap:'0.75rem', background:C.card, borderRadius:12, padding:'0.75rem 0.875rem', border:`1px solid ${C.border}`, marginBottom:'0.5rem', transition:'background 0.15s' }}>
      <span style={{ background:label?C.terrabg:C.warm, color:label?C.terra:C.light, fontSize:'0.65rem', fontWeight:600, padding:'0.28rem 0.5rem', borderRadius:7, whiteSpace:'nowrap', letterSpacing:'0.05em', textTransform:'uppercase', flexShrink:0, minWidth:52, textAlign:'center' }}>{day.slice(0,3)}</span>
      {label ? <>
        {emoji && <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{emoji}</span>}
        <p style={{ flex:1, fontFamily:emoji?"'Playfair Display',serif":"'DM Sans',sans-serif", color:C.brown, fontSize:'0.85rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</p>
        <button onClick={onAdd} style={{ background:'none', border:'none', color:C.terra, fontSize:'0.72rem', fontFamily:"'DM Sans',sans-serif", flexShrink:0, padding:'0 0.2rem' }}>Change</button>
        <button onClick={onClear} style={{ background:'none', border:'none', color:'#ccc', fontSize:'0.9rem', flexShrink:0, padding:'0 0.1rem' }}>×</button>
      </> : <>
        <p style={{ flex:1, color:C.light, fontFamily:"'DM Sans',sans-serif", fontSize:'0.82rem', fontStyle:'italic' }}>Nothing planned</p>
        <button onClick={onAdd} style={{ background:C.warm, border:`1px solid ${C.border}`, borderRadius:7, padding:'0.3rem 0.6rem', color:C.mid, fontFamily:"'DM Sans',sans-serif", fontSize:'0.72rem', flexShrink:0, cursor:'pointer' }}>+ Add</button>
      </>}
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom:'1.5rem' }}>
      <p style={{ fontFamily:"'Playfair Display',serif", color:C.brown, fontSize:'1rem', fontWeight:600, marginBottom:'0.75rem' }}>{label}</p>
      {children}
    </div>
  )
}

function GrocRow({ item, chk, catId, onToggle, onRemove, onCatTap }) {
  const label = item.entries.map(e => [e.amount,e.unit].filter(Boolean).join(' ')).filter(Boolean).join(' + ')
  const cat = CATEGORIES.find(c => c.id === catId) || CATEGORIES[CATEGORIES.length-1]
  return (
    <div className="gr" style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', padding:'0.7rem 0.4rem', borderBottom:'1px solid #f0ece6', borderRadius:8, opacity:chk?0.4:1, transition:'opacity 0.15s' }}>
      <div onClick={onToggle} style={{ width:21, height:21, borderRadius:6, border:`1.5px solid ${chk?'#c4603c':'#bfb3a8'}`, background:chk?'#c4603c':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1, cursor:'pointer', transition:'all 0.15s' }}>
        {chk && <span style={{ color:'white', fontSize:'0.62rem', fontWeight:700 }}>✓</span>}
      </div>
      <div style={{ flex:1, cursor:'pointer' }} onClick={onToggle}>
        <span style={{ fontFamily:"'DM Sans',sans-serif", color:'#3d2b1f', fontSize:'0.9rem', textDecoration:chk?'line-through':'none' }}>{item.name}</span>
        {label && <span style={{ color:'#c4603c', fontFamily:"'DM Sans',sans-serif", fontSize:'0.8rem', marginLeft:'0.4rem', fontWeight:500 }}>{label}</span>}
        {item.custom ? <p style={{ color:'#bfb3a8', fontSize:'0.7rem', marginTop:'0.1rem' }}>one-off item</p> : item.recipes.length > 0 && <p style={{ color:'#bfb3a8', fontSize:'0.7rem', marginTop:'0.1rem' }}>{item.recipes.join(', ')}</p>}
      </div>
      <button onClick={onCatTap} title="Change category" style={{ background:'#f5f2ec', border:'1px solid #e8e2da', borderRadius:6, padding:'0.2rem 0.4rem', fontSize:'0.7rem', color:'#7a6a5a', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:'0.2rem', fontFamily:"'DM Sans',sans-serif" }}>
        {cat.emoji}
      </button>
      {onRemove && <button onClick={onRemove} style={{ background:'none', border:'none', color:'#ddd', fontSize:'0.9rem', flexShrink:0, padding:'0 0.2rem', lineHeight:1, cursor:'pointer' }}>×</button>}
    </div>
  )
}

function Pill({ children }) {
  return <span style={{ display:'inline-block', background:'#c4603c', color:'white', borderRadius:10, fontSize:'0.58rem', padding:'1px 5px', marginLeft:3, verticalAlign:'middle' }}>{children}</span>
}

function Btn({ onClick, disabled, children, variant='primary', style={} }) {
  const base = { border:'none', borderRadius:10, padding:'0.55rem 1rem', fontFamily:"'DM Sans',sans-serif", fontSize:'0.82rem', fontWeight:500, cursor:disabled?'default':'pointer' }
  const v = { primary:{ background:'#c4603c', color:'white' }, outline:{ background:'transparent', border:'1px solid #e8e2da', color:'#7a6a5a' }, selected:{ background:'#fdf0eb', border:'1px solid #e8846a', color:'#c4603c' } }
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...v[variant], ...style }}>{children}</button>
}

function Empty({ emoji, text, cta, onCta }) {
  return (
    <div style={{ textAlign:'center', background:'#f5f2ec', borderRadius:16, padding:'2.5rem 1.5rem' }}>
      <p style={{ fontSize:'2.25rem', marginBottom:'0.625rem' }}>{emoji}</p>
      <p style={{ color:'#9a8a7a', fontFamily:"'DM Sans',sans-serif", fontSize:'0.85rem', marginBottom:'1rem', lineHeight:1.5 }}>{text}</p>
      <Btn onClick={onCta}>{cta}</Btn>
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div onClick={e => e.target===e.currentTarget&&onClose()} style={{ position:'fixed', inset:0, background:'rgba(40,25,15,0.5)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:200, backdropFilter:'blur(3px)' }}>
      <div style={{ background:'#faf8f4', borderRadius:'24px 24px 0 0', padding:'1.75rem 1.5rem 2.5rem', width:'100%', maxWidth:520, maxHeight:'88vh', overflowY:'auto', position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute', top:'1rem', right:'1.25rem', background:'#f5f2ec', border:'none', borderRadius:'50%', width:30, height:30, fontSize:'1rem', color:'#9a8a7a', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>×</button>
        {children}
      </div>
    </div>
  )
}
