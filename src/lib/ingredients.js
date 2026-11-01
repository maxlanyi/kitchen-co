// Quantity + ingredient-line helpers. Dependency-free so the /api/import
// serverless function can use them too.

const UNICODE_FRACTIONS = { '¼':'1/4', '½':'1/2', '¾':'3/4', '⅓':'1/3', '⅔':'2/3', '⅛':'1/8', '⅜':'3/8', '⅝':'5/8', '⅞':'7/8', '⅕':'1/5' }

export function normalizeFractions(s) {
  return String(s ?? '').replace(/(\d)?\s*([¼½¾⅓⅔⅛⅜⅝⅞⅕])/g, (_, whole, frac) => (whole ? whole + ' ' : '') + UNICODE_FRACTIONS[frac])
}

// "1", "1/2", "1 1/2", "1.5", "½" -> number. Ranges ("2-3") and words -> null.
export function parseAmount(raw) {
  const s = normalizeFractions(raw).trim()
  if (!s) return null
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (m) return +m[3] ? +m[1] + +m[2] / +m[3] : null
  m = s.match(/^(\d+)\/(\d+)$/)
  if (m) return +m[2] ? +m[1] / +m[2] : null
  m = s.match(/^\d*\.?\d+$/)
  if (m) return parseFloat(s)
  return null
}

const NICE = [[1/8,'⅛'],[1/4,'¼'],[1/3,'⅓'],[3/8,'⅜'],[1/2,'½'],[5/8,'⅝'],[2/3,'⅔'],[3/4,'¾'],[7/8,'⅞']]

export function formatAmount(n) {
  if (n == null || !isFinite(n)) return ''
  const whole = Math.floor(n + 1e-9)
  const frac = n - whole
  if (frac < 0.02) return String(whole)
  if (frac > 0.98) return String(whole + 1)
  const hit = NICE.find(([v]) => Math.abs(v - frac) < 0.02)
  if (hit) return (whole ? whole : '') + hit[1]
  return String(Math.round(n * 100) / 100)
}

const UNIT_ALIASES = {
  cup:['cup','cups','c'], tbsp:['tbsp','tbsps','tablespoon','tablespoons','tbs','tbl','T'], tsp:['tsp','tsps','teaspoon','teaspoons','t'],
  oz:['oz','ounce','ounces'], lb:['lb','lbs','pound','pounds'], g:['g','gram','grams'], kg:['kg','kilogram','kilograms'],
  ml:['ml','milliliter','milliliters'], l:['l','liter','liters','litre','litres'], 'fl oz':['fl oz','fluid ounce','fluid ounces'],
  clove:['clove','cloves'], can:['can','cans'], jar:['jar','jars'], pack:['pack','packs','package','packages','pkg'], bag:['bag','bags'],
  box:['box','boxes'], bunch:['bunch','bunches'], head:['head','heads'], loaf:['loaf','loaves'], slice:['slice','slices'],
  stick:['stick','sticks'], pinch:['pinch','pinches'], dash:['dash','dashes'], quart:['quart','quarts','qt'], pint:['pint','pints','pt'],
  container:['container','containers'], bottle:['bottle','bottles'], sprig:['sprig','sprigs'], stalk:['stalk','stalks'], piece:['piece','pieces'],
}
const UNIT_LOOKUP = {}
for (const [canon, list] of Object.entries(UNIT_ALIASES)) for (const a of list) UNIT_LOOKUP[a.toLowerCase()] = canon
// Single-letter "t"/"T"/"c" are ambiguous in free text; only trust them in the unit field.
const FREE_TEXT_SKIP = new Set(['t','c','l','g'])

export function normalizeUnit(u) {
  const s = String(u ?? '').trim().replace(/\.$/, '')
  if (!s) return ''
  if (s === 'T') return 'tbsp'
  return UNIT_LOOKUP[s.toLowerCase()] || s.toLowerCase()
}

// "2 1/2 cups flour, sifted" -> { amount:'2 1/2', unit:'cup', name:'flour, sifted' }
export function parseIngredientLine(line) {
  let s = normalizeFractions(String(line ?? '').replace(/\s+/g, ' ').trim())
  const out = { amount:'', unit:'', name:s }
  const am = s.match(/^((\d+\s+\d+\/\d+)|(\d+\/\d+)|(\d*\.?\d+)(\s*[-–]\s*\d*\.?\d+)?)\s*/)
  if (am) {
    out.amount = am[1].replace(/\s*[-–]\s*/, '-')
    s = s.slice(am[0].length)
    // "(14 oz) can tomatoes"
    const paren = s.match(/^\(([^)]*)\)\s*/)
    let note = ''
    if (paren) { note = paren[0].trim(); s = s.slice(paren[0].length) }
    const um = s.match(/^(fl\.? oz|fluid ounces?|[a-zA-Z]+\.?)\s+/)
    if (um) {
      const raw = um[1].replace(/\.$/, '')
      if (UNIT_LOOKUP[raw.toLowerCase()] && !FREE_TEXT_SKIP.has(raw.toLowerCase())) {
        out.unit = UNIT_LOOKUP[raw.toLowerCase()]
        s = s.slice(um[0].length)
      }
    }
    if (s.toLowerCase().startsWith('of ')) s = s.slice(3)
    out.name = (s + (note ? ' ' + note : '')).trim()
  }
  out.name = out.name.charAt(0).toUpperCase() + out.name.slice(1)
  return out
}

// Combine quantities of one grocery item across recipes.
// [{amount:'1',unit:'pack'},{amount:'1',unit:'packs'}] -> '2 pack'
export function combineEntries(entries) {
  const groups = new Map()
  const loose = []
  for (const e of entries) {
    const unit = normalizeUnit(e.unit)
    const n = parseAmount(e.amount)
    if (n == null) {
      const txt = [e.amount, e.unit].filter(Boolean).join(' ').trim()
      if (txt) loose.push(txt)
      continue
    }
    groups.set(unit, (groups.get(unit) || 0) + n)
  }
  const parts = [...groups].map(([unit, n]) => [formatAmount(n), unit].filter(Boolean).join(' '))
  return [...parts, ...loose].join(' + ')
}

// Grouping key for an ingredient: drop prep notes after a comma or in parens.
// "Butter (for roux)", "Butter, melted", "butter" -> "butter"
export function ingredientKey(name) {
  return String(name ?? '').toLowerCase().replace(/\([^)]*\)/g, ' ').split(',')[0].replace(/\s+/g, ' ').trim()
}

export function ingredientBaseName(name) {
  const base = String(name ?? '').replace(/\([^)]*\)/g, ' ').split(',')[0].replace(/\s+/g, ' ').trim()
  return base || String(name ?? '').trim()
}
