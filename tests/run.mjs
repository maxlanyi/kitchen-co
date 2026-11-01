// Run with: npm test
import assert from 'node:assert/strict'
import { parseAmount, formatAmount, combineEntries, parseIngredientLine, ingredientKey } from '../src/lib/ingredients.js'
import { getCategory, buildGrocery } from '../src/lib/grocery.js'
import { extractRecipe } from '../src/lib/recipeImport.js'

let passed = 0
const t = (name, fn) => { try { fn(); passed++ } catch (e) { console.error('✗', name, '\n ', e.message); process.exitCode = 1 } }

t('parseAmount', () => {
  assert.equal(parseAmount('1'), 1); assert.equal(parseAmount('1/2'), 0.5); assert.equal(parseAmount('1 1/2'), 1.5)
  assert.equal(parseAmount('½'), 0.5); assert.equal(parseAmount('2½'), 2.5); assert.equal(parseAmount('2-3'), null); assert.equal(parseAmount(''), null)
})
t('formatAmount', () => {
  assert.equal(formatAmount(2), '2'); assert.equal(formatAmount(1.5), '1½'); assert.equal(formatAmount(0.75), '¾'); assert.equal(formatAmount(1/3 + 1/3), '⅔')
})
t('combineEntries merges same units', () => {
  assert.equal(combineEntries([{ amount:'1', unit:'pack' }, { amount:'1', unit:'packs' }]), '2 pack')
  assert.equal(combineEntries([{ amount:'1/2', unit:'cup' }, { amount:'2', unit:'tbsp' }, { amount:'1', unit:'Cups' }]), '1½ cup + 2 tbsp')
  assert.equal(combineEntries([{ amount:'2-3', unit:'' }, { amount:'1', unit:'' }]), '1 + 2-3')
  assert.equal(combineEntries([{ amount:'', unit:'' }]), '')
})
t('parseIngredientLine', () => {
  assert.deepEqual(parseIngredientLine('2 1/2 cups all-purpose flour, sifted'), { amount:'2 1/2', unit:'cup', name:'All-purpose flour, sifted' })
  assert.deepEqual(parseIngredientLine('1 (14 oz) can diced tomatoes'), { amount:'1', unit:'can', name:'Diced tomatoes (14 oz)' })
  assert.deepEqual(parseIngredientLine('½ tsp kosher salt'), { amount:'1/2', unit:'tsp', name:'Kosher salt' })
  assert.deepEqual(parseIngredientLine('3 large eggs'), { amount:'3', unit:'', name:'Large eggs' })
  assert.deepEqual(parseIngredientLine('Salt and pepper to taste'), { amount:'', unit:'', name:'Salt and pepper to taste' })
})
t('ingredientKey groups prep variants', () => {
  assert.equal(ingredientKey('Butter (for roux)'), 'butter'); assert.equal(ingredientKey('Butter, melted'), 'butter')
})
t('categories', () => {
  assert.equal(getCategory('Fresh ground black pepper'), 'spices'); assert.equal(getCategory('Green bell pepper, chopped'), 'produce')
  assert.equal(getCategory('Chicken broth'), 'pantry'); assert.equal(getCategory('Canned whole peeled tomatoes'), 'pantry')
  assert.equal(getCategory('Frozen peas and diced carrots blend'), 'frozen'); assert.equal(getCategory('Evaporated milk'), 'pantry')
  assert.equal(getCategory('Fresh thyme'), 'produce'); assert.equal(getCategory('Dried thyme'), 'spices'); assert.equal(getCategory('Peanut butter'), 'pantry')
  assert.equal(getCategory('Pecans'), 'pantry'); assert.equal(getCategory('paper towels'), 'other')
})
t('buildGrocery: planned recipes, merging, hidden, custom', () => {
  const recipes = [
    { id:'a', name:'A', ingredients:[{ name:'Butter, melted', amount:'2', unit:'tbsp' }, { name:'Garlic', amount:'1', unit:'' }] },
    { id:'b', name:'B', ingredients:[{ name:'Butter (for roux)', amount:'1', unit:'tbsp' }, { name:'Rice', amount:'1', unit:'cup' }] },
    { id:'c', name:'C', ingredients:[{ name:'Steak', amount:'1', unit:'lb' }] },
  ]
  const plans = { dinners:{ Monday:['a'], Tuesday:['b', 'Leftovers'] }, lauren:{ Monday:['a'] }, max:{} }
  const { items, hidden } = buildGrocery({ recipes, plans, customItems:[{ id:'1', name:'Paper towels' }], hiddenKeys:{ rice:true } })
  const butter = items.find(i => i.key === 'butter')
  assert.equal(butter.qty, '3 tbsp'); assert.deepEqual(butter.recipes, ['A', 'B'])
  assert.equal(items.find(i => i.key === 'garlic').qty, '1') // recipe on two days still counts once
  assert.ok(!items.find(i => i.key === 'steak'))
  assert.deepEqual(hidden.map(h => h.key), ['rice'])
  assert.ok(items.find(i => i.custom && i.name === 'Paper towels'))
})
t('extractRecipe from JSON-LD', () => {
  const html = `<html><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":["Recipe"],"name":"Lemon Chicken &amp; Rice","description":"Bright and easy.","recipeYield":["4","4 servings"],"recipeIngredient":["1 lb chicken thighs","1 cup rice","½ lemon, juiced"],"recipeInstructions":[{"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"Season the chicken."},{"@type":"HowToStep","text":"Cook the rice."}]}]}]}</script></html>`
  const r = extractRecipe(html)
  assert.equal(r.name, 'Lemon Chicken & Rice'); assert.equal(r.servings, 4); assert.equal(r.emoji, '🍗')
  assert.deepEqual(r.ingredients[0], { amount:'1', unit:'lb', name:'Chicken thighs' })
  assert.equal(r.instructions, '1. Season the chicken.\n2. Cook the rice.')
  assert.equal(extractRecipe('<html>no recipe</html>'), null)
})

console.log(`${passed} test groups passed${process.exitCode ? ' (with failures above)' : ''}`)
