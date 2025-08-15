// Structured-ingredients refactor: render + weekly grocery use qty/unit/name

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

function formatQty(q) {
  if (q == null || !Number.isFinite(q)) return '';
  if (Math.abs(q - Math.round(q)) < 0.01) return String(Math.round(q));
  return q.toFixed(2).replace(/\.00$/, '');
}

function formatIngredient(ing) {
  if (typeof ing === 'string') return ing;
  const qty = formatQty(ing.qty);
  const unit = (ing.unit || '').trim();
  const name = ing.name || '';
  const note = (ing.note || '').trim();
  const unitPart = unit ? ` ${unit}` : '';
  const qtyPart = qty ? `${qty}${unitPart} ` : '';
  const notePart = note ? ` (${note})` : '';
  return `${qtyPart}${name}${notePart}`.trim();
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
    li.textContent = formatIngredient(it);
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

/* ---------- Weekly Grocery (structured ingredients, all meals, next 7 days) ---------- */

function weekKey() { return Math.floor(getDayNumber(0) / 7); }

function buildWeeklyGrocery(selectedCuisine) {
  const map = new Map(); // key: name|unit -> {name, unit, qty, count, anyQty}
  for (let offset = 0; offset < 7; offset++) {
    for (const m of MEALS) {
      const r = pickRecipe(selectedCuisine, m, offset);
      if (!r || !Array.isArray(r.ingredients)) continue;
      for (const ing of r.ingredients) {
        if (!ing) continue;
        let name, unit, qty;
        if (typeof ing === 'string') {
          // fallback
          name = ing.toLowerCase();
          unit = '';
          qty = null;
        } else {
          name = (ing.name || '').toLowerCase().trim();
          unit = (ing.unit || '').toLowerCase().trim();
          qty = typeof ing.qty === 'number' ? ing.qty : null;
        }
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
  const list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  return list;
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

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

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

/* ---------- Live updates / day change ---------- */
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
autoSelectMealByTime();
setInterval(autoSelectMealByTime, 30 * 60 * 1000);
