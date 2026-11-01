import { combineEntries, ingredientKey, ingredientBaseName } from './ingredients.js'

// Listed in rough store-walk order; the grocery list shows sections in this order.
export const CATEGORIES = [
  { id:'produce', label:'Produce',             emoji:'🥬' },
  { id:'bakery',  label:'Bakery & Bread',      emoji:'🍞' },
  { id:'meat',    label:'Meat & Seafood',      emoji:'🥩' },
  { id:'dairy',   label:'Dairy & Eggs',        emoji:'🥛' },
  { id:'pantry',  label:'Pantry & Baking',     emoji:'🥫' },
  { id:'spices',  label:'Spices & Seasonings', emoji:'🌶️' },
  { id:'drinks',  label:'Drinks',              emoji:'🍷' },
  { id:'frozen',  label:'Frozen',              emoji:'🧊' },
  { id:'other',   label:'Other',               emoji:'🛒' },
]

const KW = {
  produce: ['lettuce','romaine','spinach','baby spinach','kale','arugula','cabbage','broccoli','cauliflower','celery','carrot','onion','red onion','yellow onion','shallot','garlic','garlic clove','ginger','fresh ginger','bell pepper','green pepper','red pepper','tomato','cherry tomato','zucchini','squash','eggplant','mushroom','corn on the cob','potato','sweet potato','asparagus','green bean','snap pea','artichoke','leek','fennel','beet','radish','cucumber','avocado','lemon','lime','orange','apple','green apple','pear','banana','strawberry','strawberries','blueberry','blueberries','raspberry','raspberries','blackberry','blackberries','berries','grape','grapes','mango','peach','plum','cherry','cherries','melon','watermelon','cantaloupe','pineapple','kiwi','pomegranate','basil','fresh basil','parsley','cilantro','dill','mint','chive','chives','scallion','green onion','jalapeño','jalapeno','serrano','habanero','salad greens','mixed greens','herbs','fruit','vegetables','nectarine','sprouts','bean sprouts'],
  bakery:  ['bread','italian bread','baguette','sourdough','ciabatta','focaccia','pita','naan','tortilla','tortillas','wrap','wraps','roll','rolls','bun','buns','hamburger buns','bagel','bagels','english muffin','croissant','pie crust'],
  meat:    ['chicken','chicken breast','chicken thigh','chicken wings','chicken tenderloins','beef','ground beef','pork','pork chop','pork tenderloin','lamb','veal','turkey','ground turkey','ground chicken','ground pork','steak','flank steak','sausage','italian sausage','bacon','pancetta','guanciale','prosciutto','salami','pepperoni','ham','chorizo','hot dog','hot dogs','brat','brats','short rib','short ribs','chuck roast','sirloin','tenderloin','meatballs','rotisserie chicken','shrimp','salmon','tuna steak','cod','tilapia','halibut','sea bass','snapper','mahi','trout','scallops','lobster','crab','clams','mussels','fish','seafood'],
  dairy:   ['milk','whole milk','cream','heavy cream','whipping cream','half and half','half-and-half','butter','unsalted butter','margarine','ghee','egg','eggs','cheese','parmesan','parmigiano','pecorino','romano','mozzarella','ricotta','cheddar','gouda','brie','feta','gorgonzola','gruyere','provolone','swiss','american cheese','goat cheese','cream cheese','sour cream','yogurt','greek yogurt','cottage cheese','buttermilk','creme fraiche','crème fraîche'],
  pantry:  ['pasta','spaghetti','fettuccine','penne','rigatoni','tagliatelle','linguine','bucatini','angel hair','rotini','bow tie','lasagna','orzo','couscous','noodles','egg noodles','macaroni','rice','brown rice','wild rice','jasmine rice','quinoa','lentils','beans','black beans','kidney beans','pinto beans','chickpeas','tomato sauce','marinara','pasta sauce','crushed tomatoes','diced tomatoes','tomato paste','tomato puree','broth','stock','chicken broth','chicken stock','beef broth','vegetable broth','soup','cream of mushroom','cream of chicken','coconut milk','evaporated milk','condensed milk','olive oil','extra-virgin olive oil','vegetable oil','canola oil','sesame oil','avocado oil','cooking spray','vinegar','balsamic','red wine vinegar','rice vinegar','soy sauce','worcestershire','fish sauce','hot sauce','sriracha','mustard','dijon','ketchup','mayo','mayonnaise','ranch','dressing','salad dressing','bbq sauce','teriyaki','tahini','peanut butter','almond butter','honey','maple syrup','jam','jelly','salsa','pesto','hummus','capers','olives','black olives','pickles','relish','flour','all-purpose flour','bread flour','cornstarch','sugar','brown sugar','granulated sugar','powdered sugar','baking soda','baking powder','vanilla','vanilla extract','yeast','chocolate chips','cocoa powder','cake mix','brownie mix','caramels','sprinkles','oats','rolled oats','granola','cereal','breadcrumbs','panko','crackers','chips','tortilla chips','nuts','almonds','walnuts','pecans','peanuts','raisins','craisins','dried cherries','chia seeds','sesame seeds','lemon juice','lime juice','croutons','canned pumpkin','pumpkin puree','taco shells','taco seasoning packet','tomato juice','sun-dried tomatoes','preserves','sauce','wing sauce','pizza sauce','ramen','water chestnuts','extract','maple extract','saltines'],
  spices:  ['salt','kosher salt','sea salt','flaky salt','pepper','black pepper','peppercorns','ground red pepper','ground pepper','white pepper','garlic salt','garlic powder','onion powder','cumin','ground cumin','coriander','turmeric','paprika','smoked paprika','cayenne','chili powder','chili flakes','red pepper flakes','crushed red pepper','cinnamon','ground cinnamon','nutmeg','ground nutmeg','cardamom','cloves','ground cloves','allspice','ground ginger','bay leaf','bay leaves','oregano','dried oregano','thyme','dried thyme','rosemary','sage','dried basil','dried parsley','italian seasoning','seasoning','taco seasoning','cajun','old bay','curry powder','garam masala','everything bagel seasoning','spice'],
  drinks:  ['wine','red wine','white wine','prosecco','champagne','beer','vodka','gin','rum','tequila','whiskey','bourbon','juice','orange juice','apple juice','sparkling water','seltzer','soda','coffee','espresso','tea','oat milk','almond milk','soy milk','coconut water'],
  frozen:  ['ice cream','gelato','sorbet','popsicles','frozen pizza'],
}

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const PATTERNS = Object.entries(KW).flatMap(([cat, words]) =>
  words.map(w => ({ cat, len:w.length, re:new RegExp(`(^|[^a-zà-ÿ])${escape(w)}(s|es)?($|[^a-zà-ÿ])`, 'i') })))
const FRESH_HERBS = /\b(thyme|rosemary|sage|oregano|basil|parsley|dill|mint|cilantro)\b/i

export function getCategory(name) {
  const s = String(name ?? '').toLowerCase()
  if (!s.trim()) return 'other'
  if (/\bfrozen\b/.test(s)) return 'frozen'
  if (/\bfresh\b/.test(s) && FRESH_HERBS.test(s)) return 'produce'
  let best = null
  for (const p of PATTERNS) if (p.re.test(s) && (!best || p.len > best.len)) best = p
  if (/^(canned|dried)\b/.test(s) && (!best || best.cat !== 'spices')) return 'pantry'
  return best ? best.cat : 'other'
}

export const toArr = v => (Array.isArray(v) ? v : v ? [v] : [])

// plans: { dinners, lauren, max } each { Monday:[ids or free text], ... }
export function plannedRecipeIds(plans, recipes) {
  const ids = new Set(recipes.map(r => r.id))
  const out = []
  for (const section of Object.values(plans)) for (const v of Object.values(section || {})) for (const x of toArr(v)) if (ids.has(x)) out.push(x)
  return out
}

// Returns { items, hidden } — hidden are planned ingredients removed with × this week.
export function buildGrocery({ recipes, plans, customItems = [], hiddenKeys = {} }) {
  // Each planned recipe counts once, even if it's on several days (often leftovers).
  const planned = new Set(plannedRecipeIds(plans, recipes))
  const map = new Map()
  for (const r of recipes) {
    if (!planned.has(r.id)) continue
    for (const ing of r.ingredients || []) {
      if (!ing?.name?.trim()) continue
      const key = ingredientKey(ing.name)
      if (!key) continue
      if (!map.has(key)) map.set(key, { key, name:ingredientBaseName(ing.name), entries:[], recipes:[], custom:false })
      const item = map.get(key)
      item.entries.push({ amount:ing.amount, unit:ing.unit })
      if (!item.recipes.includes(r.name)) item.recipes.push(r.name)
    }
  }
  const all = [...map.values()].map(i => ({ ...i, qty:combineEntries(i.entries) })).sort((a, b) => a.name.localeCompare(b.name))
  const items = all.filter(i => !hiddenKeys[i.key])
  const hidden = all.filter(i => hiddenKeys[i.key])
  for (const ci of customItems) items.push({ key:`custom_${ci.id}`, name:ci.name, qty:'', entries:[], recipes:[], custom:true, id:ci.id, by:ci.by })
  return { items, hidden }
}

export function groceryText(items, checked, categoryOf) {
  const lines = []
  for (const cat of CATEGORIES) {
    const list = items.filter(i => !checked[i.key] && categoryOf(i) === cat.id)
    if (!list.length) continue
    lines.push(`${cat.emoji} ${cat.label}`)
    for (const i of list) lines.push(`• ${i.name}${i.qty ? ` — ${i.qty}` : ''}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}
