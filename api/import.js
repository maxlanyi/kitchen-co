// Vercel serverless function: GET /api/import?url=<recipe page>
// Reads the schema.org "Recipe" data most recipe sites embed for Google.
// No AI and no paid services — runs on Vercel's free Hobby plan.
import { extractRecipe } from '../src/lib/recipeImport.js'

const MAX_BYTES = 3_000_000

function isAllowedUrl(u) {
  try {
    const url = new URL(u)
    if (!/^https?:$/.test(url.protocol)) return false
    const h = url.hostname.toLowerCase()
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':')) return false // raw IPs
    return true
  } catch { return false }
}

export default async function handler(req, res) {
  const target = req.query?.url
  if (!target || !isAllowedUrl(target)) return res.status(400).json({ error:'That doesn’t look like a recipe link.' })
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    const r = await fetch(target, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept':'text/html,application/xhtml+xml',
        'Accept-Language':'en-US,en;q=0.9',
      },
    })
    clearTimeout(timer)
    if (!r.ok) return res.status(502).json({ error:`That site wouldn’t share the page (error ${r.status}).` })
    const html = (await r.text()).slice(0, MAX_BYTES)
    const recipe = extractRecipe(html)
    if (!recipe) return res.status(422).json({ error:'Couldn’t find a recipe on that page. You can still add it by hand.' })
    res.setHeader('Cache-Control', 's-maxage=86400')
    return res.status(200).json({ recipe })
  } catch (e) {
    return res.status(502).json({ error: e?.name === 'AbortError' ? 'That site took too long to respond.' : 'Couldn’t reach that site.' })
  }
}
