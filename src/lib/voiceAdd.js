// Turning a spoken phrase into grocery items, for the Siri shortcut (/api/add).
import { buildGrocery } from './grocery.js'

// Phrases that contain "and" but are one thing.
const KEEP_TOGETHER = [
  'macaroni and cheese', 'mac and cheese', 'mac n cheese', 'salt and pepper', 'half and half', 'peanut butter and jelly', 'pb and j',
  'chips and salsa', 'chips and dip', 'salt and vinegar', 'sweet and sour', 'rice and beans', 'beans and rice', 'franks and beans',
  'fish and chips', 'ham and cheese', 'cookies and cream', 'bread and butter', 'oil and vinegar', 'spaghetti and meatballs',
  'chicken and rice', 'chicken and dumplings', 'biscuits and gravy', 'pork and beans', 'cheese and crackers', 'surf and turf',
  'sour cream and onion', 'oil and vinegar dressing', 'lox and bagels', 'pigs in a blanket', 'egg and cheese', 'bacon egg and cheese',
  'chicken and waffles', 'shrimp and grits', 'rock and rye', 'black and white cookies', 'ben and jerry\'s', 'ben & jerry\'s',
  'm and ms', 'm&ms', 'm&m\'s', 'h and m', 'lemon and herb', 'garlic and herb', 'honey and oats', 'oats and honey',
]

const FILLER_START = /^(please\s+)?(can you\s+)?(add|put|get|buy|we need|i need|need)\s+/i
const FILLER_END = /\s+(to|on)\s+(the|my|our)\s+(grocery\s+|shopping\s+)?list\.?$|\s+please\.?$/i
const ARTICLE = /^(a|an|some|more|the)\s+/i
const PLACEHOLDER = '\u0000'

function clean(s) {
  let t = String(s ?? '').replace(/[.!?]+$/g, '').replace(/\s+/g, ' ').trim()
  t = t.replace(ARTICLE, '').trim()
  if (!t) return ''
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 60)
}

export function splitItems(text) {
  let s = String(text ?? '').replace(/\s+/g, ' ').trim()
  s = s.replace(FILLER_START, '').replace(FILLER_END, '').trim()
  if (!s) return []
  // Protect known combos by swapping their " and " for a placeholder.
  for (const phrase of [...KEEP_TOGETHER].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(^|[^a-z])(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')})(?=$|[^a-z])`, 'gi')
    s = s.replace(re, (_, pre, m) => pre + m.replace(/\s+and\s+/gi, ` ${PLACEHOLDER} `).replace(/&/g, PLACEHOLDER + '&'))
  }
  const parts = s.split(/\s*,\s*|\s*;\s*|\s+and\s+|\s+plus\s+|\s+&\s+|\s+also\s+/i)
  const out = []
  for (const p of parts) {
    const item = clean(p.replace(new RegExp(` ${PLACEHOLDER} `, 'g'), ' and ').replace(new RegExp(PLACEHOLDER + '&', 'g'), '&'))
    if (item && !out.some(o => o.toLowerCase() === item.toLowerCase())) out.push(item)
  }
  return out.slice(0, 15)
}

const comparable = s => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().replace(/(es|s)$/, '')

// data: the household values (recipes, dinners, lauren, max, checked, customItems, hidden).
// Returns { customItems, added, already } — customItems is the new list to save.
export function planVoiceAdd(text, by, data, now = Date.now()) {
  const wanted = splitItems(text)
  const plans = { dinners:data.dinners || {}, lauren:data.lauren || {}, max:data.max || {} }
  const { items } = buildGrocery({ recipes:data.recipes || [], plans, customItems:data.customItems || [], hiddenKeys:data.hidden || {} })
  const onList = items.filter(i => !(data.checked || {})[i.key]).map(i => comparable(i.name))
  // Re-adding something already checked off (bought last trip) puts it back as a new item.
  const customItems = (data.customItems || []).filter(ci => !(data.checked || {})[`custom_${ci.id}`] || !wanted.some(w => comparable(w) === comparable(ci.name)))
  const added = [], already = []
  wanted.forEach((name, i) => {
    if (onList.includes(comparable(name))) { already.push(name); return }
    customItems.push({ id:String(now + i), name, ...(by ? { by } : {}) })
    onList.push(comparable(name))
    added.push(name)
  })
  return { customItems, added, already }
}

const list = a => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`)

export function spokenReply({ added, already }) {
  const parts = []
  if (added.length) parts.push(`Added ${list(added.map(s => s.toLowerCase()))}.`)
  if (already.length) parts.push(`${list(already.map(s => s.toLowerCase()))} ${already.length === 1 ? 'is' : 'are'} already on the list.`)
  if (!parts.length) return 'I didn’t catch anything to add.'
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}
