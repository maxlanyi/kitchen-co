import { parseIngredientLine } from './ingredients.js'

const ENTITIES = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', rsquo:'’', lsquo:'‘', rdquo:'”', ldquo:'“', ndash:'–', mdash:'—', hellip:'…', deg:'°', frac12:'½', frac14:'¼', frac34:'¾' }

export function decode(s) {
  return String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+\d*);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

const isRecipe = n => n && typeof n === 'object' && [].concat(n['@type'] || []).some(t => String(t).toLowerCase() === 'recipe')

function findRecipe(node, depth = 0) {
  if (!node || depth > 6) return null
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n, depth + 1); if (r) return r } return null }
  if (typeof node !== 'object') return null
  if (isRecipe(node)) return node
  for (const k of ['@graph', 'mainEntity', 'itemListElement']) { const r = findRecipe(node[k], depth + 1); if (r) return r }
  return null
}

function instructionLines(ins) {
  const out = []
  const walk = n => {
    if (!n) return
    if (typeof n === 'string') { decode(n).split(/\n+|(?<=\.)\s+(?=\d+\.\s)/).map(s => s.trim()).filter(Boolean).forEach(s => out.push(s)); return }
    if (Array.isArray(n)) return n.forEach(walk)
    if (n.itemListElement) return walk(n.itemListElement)
    if (n.text) return out.push(decode(n.text))
    if (n.name) out.push(decode(n.name))
  }
  walk(ins)
  return out.map(s => s.replace(/^\d+[.)]\s*/, '')).filter(Boolean)
}

function servingsFrom(y) {
  const v = Array.isArray(y) ? y.join(' ') : String(y ?? '')
  const m = v.match(/\d+/)
  return m ? Math.min(+m[0], 50) : 4
}

const EMOJI = [
  [/taco|burrito|enchilada|quesadilla|fajita/i,'🌮'],[/pizza/i,'🍕'],[/pasta|spaghetti|penne|rigatoni|lasagna|noodle|orzo|mac/i,'🍝'],
  [/soup|stew|chili|chowder/i,'🍲'],[/salad/i,'🥗'],[/burger/i,'🍔'],[/sandwich|panini|sub\b/i,'🥪'],[/chicken|wing/i,'🍗'],
  [/steak|beef|roast/i,'🥩'],[/salmon|fish|shrimp|seafood/i,'🐟'],[/rice|stir.?fry|curry/i,'🍛'],[/egg|frittata|omelet/i,'🍳'],
  [/pancake|waffle/i,'🥞'],[/cookie|brownie|cake|bar|muffin|bread/i,'🍪'],[/pie|crisp|cobbler/i,'🥧'],[/smoothie|oat/i,'🥣'],
]
export const guessEmoji = name => (EMOJI.find(([re]) => re.test(name)) || [null, '🍽️'])[1]

export function extractRecipe(html) {
  const blocks = [...String(html).matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)]
  for (const [, body] of blocks) {
    let json
    try { json = JSON.parse(body.trim()) } catch {
      try { json = JSON.parse(body.trim().replace(/[\u0000-\u001f]+/g, ' ')) } catch { continue }
    }
    const r = findRecipe(json)
    if (!r) continue
    const name = decode(r.name) || 'Imported recipe'
    const steps = instructionLines(r.recipeInstructions)
    const ingredients = [].concat(r.recipeIngredient || r.ingredients || [])
      .map(decode).filter(Boolean).map(parseIngredientLine)
    if (!ingredients.length && !steps.length) continue
    let description = decode(r.description)
    if (description.length > 110) description = description.slice(0, 107).replace(/\s+\S*$/, '') + '…'
    return {
      name,
      description,
      emoji: guessEmoji(name),
      servings: servingsFrom(r.recipeYield),
      ingredients,
      instructions: steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    }
  }
  return null
}
