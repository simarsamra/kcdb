// Recipes-only app, tablet-optimized, robust modal close

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

  recipeTitleEl.textContent = r.title;

  ingredientsListEl.innerHTML = '';
  r.ingredients.forEach(it => {
    const li = document.createElement('li');
    li.textContent = it;
    ingredientsListEl.appendChild(li);
  });

  stepsListEl.innerHTML = '';
  r.steps.forEach(st => {
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

// Modal helpers (robust close)
function showModal() {
  prepModal.classList.remove('hidden');
  document.body.classList.add('no-scroll');
  // move focus to close button for accessibility
  setTimeout(() => closePrepModal?.focus(), 0);
}
function hideModal() {
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
      items.push({meal: u.meal, when, title: r.title, note: r.prepNotes.trim()});
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

  showModal();
}

function toTitle(s) {
  return s.replace(/[-_]/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Helpers for weekly list
function weekKey() { return Math.floor(getDayNumber(0) / 7); }

function normalizeIngredient(s) {
  if (!s) return '';
  let t = String(s).toLowerCase().trim();

  // drop parentheses content
  t = t.replace(/\([^)]*\)/g, ' ').trim();

  // remove leading quantities and common units
  t = t.replace(
    /^(?:\d+[\d\/\.\-\s]*\s*)?(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|g|kg|grams?|ml|l|liters?|oz|ounces?|pounds?|lbs?|cloves?|slices?|cans?|pieces?|tbsp|tsp)\b\s*/i,
    ''
  );

  // remove leading simple counts (e.g., "2 ", "a ", "an ")
  t = t.replace(/^(?:\d+|a|an)\s+/, '');

  // clean punctuation and extra spaces
  t = t.replace(/[.,;:]+$/g, '').replace(/\s{2,}/g, ' ').trim();

  // prefer ingredient name up to " - " or " — "
  t = t.split(' - ')[0].split(' — ')[0].trim();

  return t;
}

function buildWeeklyGrocery(selectedCuisine) {
  const map = new Map(); // key -> {label, key}
  for (let offset = 0; offset < 7; offset++) {
    for (const m of MEALS) {
      const r = pickRecipe(selectedCuisine, m, offset);
      if (!r || !Array.isArray(r.ingredients)) continue;
      for (const raw of r.ingredients) {
        if (!raw) continue;
        const key = normalizeIngredient(raw);
        if (!key) continue;
        if (!map.has(key)) {
          // label: capitalize first letter
          const label = key.charAt(0).toUpperCase() + key.slice(1);
          map.set(key, { key, label });
        }
      }
    }
  }
  // sort alphabetically
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
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
    const id = `g_${it.key.replace(/\s+/g,'_')}`;
    const isChecked = checked.has(it.key);
    return `
      <li>
        <input type="checkbox" id="${id}" data-key="${it.key}" ${isChecked ? 'checked' : ''}/>
        <label for="${id}">${it.label}</label>
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

// Events
prepNextBtn?.addEventListener('click', openPrepModal);
closePrepModal?.addEventListener('click', hideModal);
closePrepModalX?.addEventListener('click', hideModal);
// Close when tapping outside the modal body
prepModal?.addEventListener('click', (e) => {
  if (!e.target.closest('.modal-body')) hideModal();
});
// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !prepModal.classList.contains('hidden')) hideModal();
});

// Events: grocery modal
groceryBtn?.addEventListener('click', openGroceryModal);
closeGroceryModal?.addEventListener('click', () => hideModalEl(groceryModal));
closeGroceryModalX?.addEventListener('click', () => hideModalEl(groceryModal));
groceryModal?.addEventListener('click', (e) => {
  if (!e.target.closest('.modal-body')) hideModalEl(groceryModal);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !groceryModal.classList.contains('hidden')) hideModalEl(groceryModal);
});

// Checkbox change + persistence
groceryContent?.addEventListener('change', (e) => {
  const cb = e.target;
  if (cb && cb.matches('input[type="checkbox"][data-key]')) {
    const key = cb.getAttribute('data-key');
    const set = loadCheckedSet();
    if (cb.checked) set.add(key); else set.delete(key);
    saveCheckedSet(set);
  }
});

// Clear checked
clearCheckedBtn?.addEventListener('click', () => {
  const set = new Set(); // empty
  saveCheckedSet(set);
  // uncheck all
  groceryContent.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
});

// Copy list
copyGroceryBtn?.addEventListener('click', async () => {
  const lines = Array.from(groceryContent.querySelectorAll('li')).map(li => {
    const cb = li.querySelector('input[type="checkbox"]');
    const label = li.querySelector('label')?.textContent ?? '';
    return `${cb?.checked ? '[x]' : '[ ]'} ${label}`;
  });
  try { await navigator.clipboard.writeText(lines.join('\n')); }
  catch { /* ignore */ }
});

// Init
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
