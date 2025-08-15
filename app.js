// Recipes-only app, tablet-optimized, robust modals + weekly grocery with quantities

const KEY_CUISINE = 'kd_cuisine';
const KEY_MEAL = 'kd_meal';
const MEALS = ['Breakfast','Lunch','Dinner'];

// DOM
const clockEl = document.getElementById('clock');
const cuisineTabsEl = document.getElementById('cuisineTabs');
const mealTabsEl = document.getElementById('mealTabs');
const recipeTitleEl = document.getElementById('recipeTitle');
const dayInfoEl = document.getElementById('dayInfo');
const ingredientsListEl = document.getElementById('ingredientsList');
const stepsListEl = document.getElementById('stepsList');
const currentPrepNoteEl = document.getElementById('currentPrepNote');

const prepNextBtn = document.getElementById('prepNextBtn');
const prepModal = document.getElementById('prepModal');
const prepContent = document.getElementById('prepContent');
const closePrepModal = document.getElementById('closePrepModal');
const closePrepModalX = document.getElementById('closePrepModalX');

// Grocery UI
const groceryBtn = document.getElementById('groceryBtn');
const groceryModal = document.getElementById('groceryModal');
const groceryContent = document.getElementById('groceryContent');
const groceryCuisineLabel = document.getElementById('groceryCuisineLabel');
const closeGroceryModal = document.getElementById('closeGroceryModal');
const closeGroceryModalX = document.getElementById('closeGroceryModalX');
const copyGroceryBtn = document.getElementById('copyGroceryBtn');
const clearCheckedBtn = document.getElementById('clearCheckedBtn');

// State
let data = null;
let cuisine = localStorage.getItem(KEY_CUISINE) || 'international';
let meal = localStorage.getItem(KEY_MEAL) || 'Breakfast';

// Clock
function tick() {
  const d = new Date();
  clockEl.textContent = d.toLocaleString([], {weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
}
setInterval(tick, 1000);
tick();

// Load recipes.json
async function loadData() {
  const res = await fetch('recipes.json', {cache:'no-cache'});
  if (!res.ok) throw new Error('Failed to load recipes.json');
  return res.json();
}

function getDayNumber(offsetDays = 0) {
  const msPerDay = 86400000;
  const now = new Date();
  const utc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(utc / msPerDay) + offsetDays;
}

function pickRecipe(cui, mealName, offsetDays = 0) {
  const arr = ((data && data.cuisines && data.cuisines[cui]) ? data.cuisines[cui][mealName] : null) || [];
  if (!arr.length) return null;
  const idx = getDayNumber(offsetDays) % arr.length;
  return arr[idx];
}

function renderCuisineTabs() {
  const cuisines = Object.keys(data.cuisines);
  if (!cuisines.includes(cuisine)) cuisine = cuisines[0];

  cuisineTabsEl.innerHTML = '';
  cuisines.forEach(c => {
    const b = document.createElement('button');
    b.className = 'tab-btn' + (c === cuisine ? ' active' : '');
    b.textContent = toTitle(c);
    b.type = 'button';
    b.addEventListener('click', () => {
      cuisine = c;
      localStorage.setItem(KEY_CUISINE, cuisine);
      renderCuisineTabs();
      renderMealTabs();
      renderRecipe();
    });
    cuisineTabsEl.appendChild(b);
  });
}

function renderMealTabs() {
  mealTabsEl.innerHTML = '';
  MEALS.forEach(m => {
    const b = document.createElement('button');
    b.className = 'tab-btn' + (m === meal ? ' active' : '');
    b.textContent = m;
    b.type = 'button';
    b.addEventListener('click', () => {
      meal = m;
      localStorage.setItem(KEY_MEAL, meal);
      renderMealTabs();
      renderRecipe();
    });
    mealTabsEl.appendChild(b);
  });
}

function renderRecipe() {
  const r = pickRecipe(cuisine, meal, 0);
  const d = new Date();
  dayInfoEl.textContent = `${d.toLocaleDateString([], {weekday:'long', month:'short', day:'numeric'})} • ${toTitle(cuisine)} • ${meal}`;

  if (!r) {
    recipeTitleEl.textContent = 'No recipe';
    ingredientsListEl.innerHTML = '';
    stepsListEl.innerHTML = '';
    currentPrepNoteEl.classList.add('hidden');
    currentPrepNoteEl.textContent = '';
    return;
  }

  recipeTitleEl.textContent = r.title || 'Recipe';

  ingredientsListEl.innerHTML = '';
  (r.ingredients || []).forEach(it => {
    const li = document.createElement('li');
    li.textContent = it;
    ingredientsListEl.appendChild(li);
  });

  stepsListEl.innerHTML = '';
  (r.steps || []).forEach(st => {
    const li = document.createElement('li');
    li.textContent = st;
    stepsListEl.appendChild(li);
  });

  if (r.prepNotes && r.prepNotes.trim()) {
    currentPrepNoteEl.textContent = `Prep note: ${r.prepNotes}`;
    currentPrepNoteEl.classList.remove('hidden');
  } else {
    currentPrepNoteEl.classList.add('hidden');
    currentPrepNoteEl.textContent = '';
  }
}

function upcomingMealsFrom(currentMeal) {
  const idx = MEALS.indexOf(currentMeal);
  const order = [];
  for (let i = idx + 1; i < MEALS.length; i++) order.push({meal: MEALS[i], offset: 0}); // later today
  order.push({meal: MEALS[0], offset: 1}); // tomorrow breakfast
  return order;
}

// Prep modal helpers
function showPrepModal() {
  prepModal.classList.remove('hidden');
  document.body.classList.add('no-scroll');
  setTimeout(() => closePrepModal?.focus(), 0);
}
function hidePrepModal() {
  prepModal.classList.add('hidden');
  document.body.classList.remove('no-scroll');
}

function openPrepModal() {
  const upcoming = upcomingMealsFrom(meal);
  const items = [];

  for (const u of upcoming) {
    const r = pickRecipe(cuisine, u.meal, u.offset);
    if (r && r.prepNotes && r.prepNotes.trim()) {
      const when = u.offset === 0 ? 'Today' : 'Tomorrow';
      items.push({meal: u.meal, when, title: r.title || '', note: r.prepNotes.trim()});
    }
  }

  if (!items.length) {
    prepContent.innerHTML = `<p>No prep needed for upcoming recipes.</p>`;
  } else {
    prepContent.innerHTML = items.map(it =>
      `<div class="card" style="margin:8px 0;padding:10px">
        <strong>${it.when} ${it.meal}:</strong> ${it.title}
        <div class="meta" style="margin-top:4px">${it.note}</div>
      </div>`
    ).join('');
  }

  showPrepModal();
}

function toTitle(s) {
  return String(s || '').replace(/[-_]/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* ---------- Weekly Grocery (all meals, next 7 days, with quantities) ---------- */

const UNIT_ALIASES = {
  cup:'cup', cups:'cup',
  tbsp:'tbsp', tablespoon:'tbsp', tablespoons:'tbsp', tbsps:'tbsp',
  tsp:'tsp', teaspoon:'tsp', teaspoons:'tsp', tsps:'tsp',
  g:'g', gram:'g', grams:'g',
  kg:'kg', kgs:'kg',
  ml:'ml', mls:'ml',
  l:'l', liter:'l', liters:'l', litres:'l',
  oz:'oz', ounce:'oz', ounces:'oz',
  lb:'lb', lbs:'lb', pound:'lb', pounds:'lb',
  clove:'clove', cloves:'clove',
  slice:'slice', slices:'slice',
  can:'can', cans:'can',
  piece:'piece', pieces:'piece'
};

const VULGAR = { '¼':'1/4','½':'1/2','¾':'3/4','⅓':'1/3','⅔':'2/3','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8' };

function replaceVulgar(s) {
  return s.replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, m => VULGAR[m] || m);
}

function fracToNum(fr) {
  const m = fr.match(/^(\d+)\s+(\d+)\/(\d+)$/); // mixed "1 1/2"
  if (m) return parseFloat(m[1]) + (parseFloat(m[2]) / parseFloat(m[3]));
  const m2 = fr.match(/^(\d+)\/(\d+)$/); // "1/2"
  if (m2) return parseFloat(m2[1]) / parseFloat(m2[2]);
  return Number.isFinite(+fr) ? +fr : null;
}

function parseIngredient(raw) {
  if (!raw) return { name: '', unit: '', qty: null };
  let s = replaceVulgar(String(raw)).toLowerCase().trim();
  s = s.replace(/\([^)]*\)/g, ' ').replace(/\s{2,}/g, ' ').trim();

  const tokens = s.split(/\s+/);
  let i = 0, qty = null, unit = '';

  const range = tokens[i]?.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) {
    qty = parseFloat(range[1]); // take the lower end
    i++;
  } else if (/^\d+(?:\.\d+)?$/.test(tokens[i])) {
    qty = parseFloat(tokens[i]); i++;
    if (/^\d+\/\d+$/.test(tokens[i])) { qty += fracToNum(tokens[i]); i++; }
  } else if (/^\d+\/\d+$/.test(tokens[i])) {
    qty = fracToNum(tokens[i]); i++;
  } else if (tokens[i] === 'a' || tokens[i] === 'an') {
    qty = 1; i++;
  }

  const maybeUnit = UNIT_ALIASES[tokens[i]] || '';
  if (maybeUnit) { unit = maybeUnit; i++; }

  if (tokens[i] === 'of') i++;
  const name = tokens.slice(i).join(' ').trim();

  // If still no name, fall back to raw
  return {
    name: name || s,
    unit: unit || (qty != null ? '' : ''), // keep empty if unknown
    qty: qty
  };
}

function weekKey() { return Math.floor(getDayNumber(0) / 7); }

function buildWeeklyGrocery(selectedCuisine) {
  const map = new Map(); // key: name|unit -> {name, unit, qty, count}
  for (let offset = 0; offset < 7; offset++) {
    for (const m of MEALS) {
      const r = pickRecipe(selectedCuisine, m, offset);
      if (!r || !Array.isArray(r.ingredients)) continue;
      for (const raw of r.ingredients) {
        const { name, unit, qty } = parseIngredient(raw);
        if (!name) continue;
        const key = `${name}|${unit}`;
        if (!map.has(key)) map.set(key, { name, unit, qty: 0, count: 0, anyQty: false });
        const item = map.get(key);
        if (qty != null && Number.isFinite(qty)) {
          item.qty += qty;
          item.anyQty = true;
        } else {
          item.count += 1;
        }
      }
    }
  }
  // If no numeric qty seen for an item, fall back to count
  const list = [];
  for (const v of map.values()) {
    list.push(v);
  }
  // sort by name
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function formatQty(q) {
  if (!Number.isFinite(q) || q === 0) return '';
  if (Math.abs(q - Math.round(q)) < 0.01) return String(Math.round(q));
  return q.toFixed(2).replace(/\.00$/, '');
}

function storageCheckedKey() {
  return `kd_grocery_checked_${weekKey()}_${cuisine}`;
}

function loadCheckedSet() {
  try {
    const raw = localStorage.getItem(storageCheckedKey());
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch { return new Set(); }
}

function saveCheckedSet(set) {
  localStorage.setItem(storageCheckedKey(), JSON.stringify(Array.from(set)));
}

function renderGroceryList() {
  const items = buildWeeklyGrocery(cuisine);
  const checked = loadCheckedSet();
  groceryCuisineLabel.textContent = toTitle(cuisine);

  if (!items.length) {
    groceryContent.innerHTML = '<li>No ingredients found for the upcoming week.</li>';
    return;
  }

  groceryContent.innerHTML = items.map(it => {
    const baseKey = `${it.name}|${it.unit}`;
    const id = `g_${baseKey.replace(/[^\w]+/g,'_')}`;
    const isChecked = checked.has(baseKey);
    const qtyPart = it.anyQty ? formatQty(it.qty) : (it.count ? String(it.count) : '');
    const unitPart = it.unit ? ` ${it.unit}` : '';
    const label = `${qtyPart}${qtyPart ? unitPart + ' ' : ''}${capitalize(it.name)}`;
    return `
      <li>
        <input type="checkbox" id="${id}" data-key="${baseKey}" ${isChecked ? 'checked' : ''}/>
        <label for="${id}">${label || capitalize(it.name)}</label>
      </li>
    `;
  }).join('');
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function showModalEl(el) {
  el.classList.remove('hidden');
  document.body.classList.add('no-scroll');
}
function hideModalEl(el) {
  el.classList.add('hidden');
  document.body.classList.remove('no-scroll');
}

function openGroceryModal() {
  renderGroceryList();
  showModalEl(groceryModal);
}

/* ---------- Events ---------- */
prepNextBtn?.addEventListener('click', openPrepModal);
closePrepModal?.addEventListener('click', hidePrepModal);
closePrepModalX?.addEventListener('click', hidePrepModal);
prepModal?.addEventListener('click', (e) => { if (!e.target.closest('.modal-body')) hidePrepModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !prepModal.classList.contains('hidden')) hidePrepModal(); });

groceryBtn?.addEventListener('click', openGroceryModal);
closeGroceryModal?.addEventListener('click', () => hideModalEl(groceryModal));
closeGroceryModalX?.addEventListener('click', () => hideModalEl(groceryModal));
groceryModal?.addEventListener('click', (e) => { if (!e.target.closest('.modal-body')) hideModalEl(groceryModal); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !groceryModal.classList.contains('hidden')) hideModalEl(groceryModal); });

groceryContent?.addEventListener('change', (e) => {
  const cb = e.target;
  if (cb && cb.matches('input[type="checkbox"][data-key]')) {
    const key = cb.getAttribute('data-key');
    const set = loadCheckedSet();
    if (cb.checked) set.add(key); else set.delete(key);
    saveCheckedSet(set);
  }
});

clearCheckedBtn?.addEventListener('click', () => {
  const set = new Set();
  saveCheckedSet(set);
  groceryContent.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
});

copyGroceryBtn?.addEventListener('click', async () => {
  const lines = Array.from(groceryContent.querySelectorAll('li')).map(li => {
    const cb = li.querySelector('input[type="checkbox"]');
    const label = li.querySelector('label')?.textContent ?? '';
    return `${cb?.checked ? '[x]' : '[ ]'} ${label}`;
  });
  try { await navigator.clipboard.writeText(lines.join('\n')); } catch {}
});

/* ---------- Init ---------- */
(async function init() {
  try {
    data = await loadData();
    renderCuisineTabs();
    renderMealTabs();
    renderRecipe();
  } catch (err) {
    console.error(err);
    recipeTitleEl.textContent = 'Failed to load recipes.json';
  }
})();

// Auto-refresh when a new deployment is available (GitHub Pages)
const VERSION_POLL_MS = 60000; // 60s
let currentVersion = null;

async function pollVersion() {
  try {
    const res = await fetch('version.json?ts=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const v = await res.json();
    if (!currentVersion) {
      currentVersion = v.version || '';
      return;
    }
    if (v.version && v.version !== currentVersion) {
      location.reload();
    }
  } catch {}
}
setInterval(pollVersion, VERSION_POLL_MS);
pollVersion();

// Rerender when the calendar day changes (if tab stays open overnight)
let currentDayKey = getDayNumber(0);
setInterval(() => {
  const k = getDayNumber(0);
  if (k !== currentDayKey) {
    currentDayKey = k;
    renderRecipe();
  }
}, 60_000);

// Auto-select meal based on time
function autoSelectMealByTime() {
  const h = new Date().getHours();
  const target = h < 11 ? 'Breakfast' : h < 16 ? 'Lunch' : 'Dinner';
  if (meal !== target) {
    meal = target;
    localStorage.setItem(KEY_MEAL, meal);
    renderMealTabs();
    renderRecipe();
  }
}

// Call at startup and when the day rolls over
autoSelectMealByTime();
setInterval(autoSelectMealByTime, 30 * 60 * 1000); // every 30 min
