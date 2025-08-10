// app.js - static frontend for Kitchen Dashboard

// --- Helpers & settings keys
const KEY_SHEET_URL = 'kr_sheet_url'; // Key for storing the Google Sheet URL
const KEY_BASE = 'kr_base_url';
const KEY_TOKEN = 'kr_api_token';
const KEY_CACHE = 'kr_cached_recipes_v1';
const KEY_CAL_CACHE = 'kr_cached_calendar_v1';

// --- DOM
const clockEl = document.getElementById('clock');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const sheetUrlInput = document.getElementById('sheetUrl'); // Input for Sheet URL
const baseUrlInput = document.getElementById('baseUrl');
const apiTokenInput = document.getElementById('apiToken');
const saveSettingsBtn = document.getElementById('saveSettings');
const closeSettingsBtn = document.getElementById('closeSettings');
const refreshBtn = document.getElementById('refreshBtn');

const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

const todayRecipeSmall = document.getElementById('todayRecipeSmall');
const prepNowSmall = document.getElementById('prepNowSmall');
const calendarSmall = document.getElementById('calendarSmall');

const recipeFull = document.getElementById('recipeFull');
const groceryListEl = document.getElementById('groceryList');
const generateFromRecipesBtn = document.getElementById('generateFromRecipes');
const clearCheckedBtn = document.getElementById('clearChecked');

const calendarEventsEl = document.getElementById('calendarEvents');
const prepListEl = document.getElementById('prepList');

// clock
function tick() {
  const now = new Date();
  clockEl.textContent = now.toLocaleString();
}
setInterval(tick, 1000);
tick();

// navigation
function showView(name) {
  views.forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');
}
navBtns.forEach(b => {
  b.addEventListener('click', () => {
    showView(b.dataset.view);
    if (b.dataset.view === 'recipe') renderTodayRecipe();
    if (b.dataset.view === 'grocery') renderGrocery();
    if (b.dataset.view === 'calendar') renderCalendar();
    if (b.dataset.view === 'prep') renderPrep();
  });
});
document.querySelectorAll('button.back').forEach(b => b.addEventListener('click', () => showView('dashboard')));

// settings modal
settingsBtn.addEventListener('click', () => {
  sheetUrlInput.value = localStorage.getItem(KEY_SHEET_URL) || '';
  baseUrlInput.value = localStorage.getItem(KEY_BASE) || '';
  apiTokenInput.value = localStorage.getItem(KEY_TOKEN) || '';
  settingsModal.classList.remove('hidden');
});
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
saveSettingsBtn.addEventListener('click', () => {
  localStorage.setItem(KEY_SHEET_URL, sheetUrlInput.value.trim());
  localStorage.setItem(KEY_BASE, baseUrlInput.value.trim());
  localStorage.setItem(KEY_TOKEN, apiTokenInput.value.trim());
  alert('Saved settings');
  settingsModal.classList.add('hidden');
});

/**
 * NEW: Parses raw CSV text into an array of objects.
 * @param {string} csvText The raw CSV text.
 * @returns {Array<Object>} An array of recipe objects.
 */
function parseCsv(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const header = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const entry = {};
        for (let j = 0; j < header.length; j++) {
            entry[header[j]] = values[j] ? values[j].trim() : '';
        }
        data.push(entry);
    }
    return data;
}

/**
 * NEW: Transforms the flat array from CSV into the nested JSON structure the app uses.
 * @param {Array<Object>} csvData The array of objects from parseCsv.
 * @returns {Object} The structured recipe data, matching recipes.json format.
 */
function transformCsvData(csvData) {
    const recipesByCat = {};
    const categories = new Set();

    csvData.forEach(row => {
        const category = row.Category || 'Spare';
        categories.add(category);

        if (!recipesByCat[category]) {
            recipesByCat[category] = [];
        }

        recipesByCat[category].push({
            title: row.Title || 'Untitled',
            ingredients: row.Ingredients ? row.Ingredients.split(';').map(i => i.trim()) : [],
            steps: row.Steps ? row.Steps.split(';').map(s => s.trim()) : [],
            prepNotes: row.PrepNotes || ''
        });
    });

    return {
        rotation_days: 4, // You can make this a setting later if needed
        categories: Array.from(categories),
        recipes: recipesByCat
    };
}


// MODIFIED: load recipes (remote CSV -> cache -> bundled JSON)
async function loadRecipes() {
  const sheetUrl = localStorage.getItem(KEY_SHEET_URL);

  // 1. Try to fetch from Google Sheet CSV
  if (sheetUrl) {
      try {
          console.log("Attempting to fetch recipes from Google Sheet...");
          const res = await fetch(sheetUrl, { cache: 'no-store' });
          if (!res.ok) throw new Error(`Fetch failed with status: ${res.status}`);
          const csvText = await res.text();
          const csvData = parseCsv(csvText);
          const jsonData = transformCsvData(csvData);
          
          // Save to cache and return
          localStorage.setItem(KEY_CACHE, JSON.stringify(jsonData));
          console.log("Successfully loaded recipes from Google Sheet.");
          return jsonData;
      } catch (err) {
          console.warn('Could not fetch from Google Sheet, checking cache.', err.message);
      }
  }

  // 2. Try to load from local cache
  const cached = localStorage.getItem(KEY_CACHE);
  if (cached) {
      console.log("Loading recipes from cache.");
      return JSON.parse(cached);
  }

  // 3. Fallback to bundled local file
  try {
      console.log("Loading recipes from local recipes.json.");
      const r = await fetch('recipes.json');
      const bundled = await r.json();
      // Store the bundled version in cache for future offline use
      localStorage.setItem(KEY_CACHE, JSON.stringify(bundled));
      return bundled;
  } catch (e) {
      console.error('FATAL: Could not load any recipe data.', e);
      throw new Error('No recipes available');
  }
}


// --- Calendar Fetching (Unchanged) ---
async function fetchRemote(path) {
  const base = localStorage.getItem(KEY_BASE) || '';
  const token = localStorage.getItem(KEY_TOKEN) || '';
  if (!base) throw new Error('Base URL not configured (Settings).');
  const url = new URL(base);
  url.searchParams.append('action', path);
  if (path === 'calendar') url.searchParams.append('days', '7');
  if (token) url.searchParams.append('token', token);
  url.searchParams.append('_ts', Date.now());
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Remote fetch failed: ' + res.status);
  return res.json();
}

async function loadCalendar() {
  try {
    const json = await fetchRemote('calendar');
    localStorage.setItem(KEY_CAL_CACHE, JSON.stringify(json));
    return json;
  } catch (err) {
    console.warn('Remote calendar failed', err);
    const cached = localStorage.getItem(KEY_CAL_CACHE);
    if (cached) return JSON.parse(cached);
    return { days: 0, events: [] };
  }
}

// --- Rotation & Rendering Logic (Unchanged) ---

function rotationIndexForDate(d, rotationDays = 4) {
  return d.getDate() % rotationDays;
}
function pickTwoFrom(arr, idx) {
  if (!arr || arr.length === 0) return [];
  const start = (idx * 2) % arr.length;
  return [arr[start % arr.length], arr[(start + 1) % arr.length]];
}

async function renderTodayRecipe() {
  try {
    const data = await loadRecipes();
    const rotation = data.rotation_days || 4;
    const idx = rotationIndexForDate(new Date(), rotation);
    const h = new Date().getHours();
    let meal = 'Spare';
    if (h < 10) meal = 'Breakfast';
    else if (h < 15) meal = 'Lunch';
    else if (h < 21) meal = 'Dinner';
    const arr = (data.recipes && data.recipes[meal]) || [];
    const chosen = pickTwoFrom(arr, idx);
    recipeFull.innerHTML = '';
    if (chosen.length === 0) recipeFull.innerHTML = '<p>No recipe found</p>';
    chosen.forEach(r => {
      if (!r) return; // Skip if a recipe is undefined
      const div = document.createElement('div');
      div.className = 'card';
      let html = `<h3>${r.title}</h3>`;
      if (r.prepNotes) html += `<div><strong>Prep:</strong> ${r.prepNotes}</div>`;
      if (r.ingredients && r.ingredients.length) {
        html += '<h4>Ingredients</h4><ul>';
        r.ingredients.forEach(i => html += `<li>${i}</li>`);
        html += '</ul>';
      }
      if (r.steps && r.steps.length) {
        html += '<h4>Steps</h4><ol>';
        r.steps.forEach(s => html += `<li>${s}</li>`);
        html += '</ol>';
      }
      div.innerHTML = html;
      recipeFull.appendChild(div);
    });
  } catch (err) {
    recipeFull.innerHTML = `<p>Error: ${err.message}</p>`;
  }
}

async function renderDashboardSmall() {
  try {
    const recipes = await loadRecipes();
    const cal = await loadCalendar();
    const idx = rotationIndexForDate(new Date(), (recipes.rotation_days || 4));
    const h = new Date().getHours();
    let meal = 'Spare';
    if (h < 10) meal = 'Breakfast';
    else if (h < 15) meal = 'Lunch';
    else if (h < 21) meal = 'Dinner';
    const chosen = pickTwoFrom((recipes.recipes && recipes.recipes[meal]) || [], idx);
    todayRecipeSmall.innerHTML = `<div class="card"><h4>Now: ${meal}</h4>${chosen.map(c => `<div>${c ? c.title : '(none)'}</div>`).join('')}</div>`;

    const prep = [];
    const plan = await generateWeeklyPlan(7, recipes);
    const todayStr = new Date().toISOString().slice(0,10);
    const tomorrow = new Date(); tomorrow.setDate(new Date().getDate()+1);
    const tomStr = tomorrow.toISOString().slice(0,10);
    plan.forEach(d => {
      for (const cat in d.meals) {
        d.meals[cat].forEach(m => {
          if (m && m.prepNotes && (d.date === todayStr || d.date === tomStr)) prep.push({date: d.date, meal: cat, title: m.title, note: m.prepNotes});
        });
      }
    });
    prepNowSmall.innerHTML = `<div class="card"><h4>Prep soon</h4>${prep.slice(0,3).map(p => `<div>${p.title} (${p.meal}) - ${p.note}</div>`).join('') || '<div>None</div>'}</div>`;

    calendarSmall.innerHTML = `<div class="card"><h4>Calendar</h4>${(cal.events || []).slice(0,3).map(ev => `<div>${new Date(ev.start).toLocaleString()} - ${ev.title}</div>`).join('') || '<div>No events</div>'}</div>`;
  } catch (e) {
    console.warn(e);
  }
}

async function generateWeeklyPlan(days=7, data) {
  data = data || (await loadRecipes());
  const out = [];
  const rotationDays = data.rotation_days || 4;
  const start = new Date();
  for (let i=0;i<days;i++){
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = d.toISOString().slice(0,10);
    const idx = rotationIndexForDate(d, rotationDays);
    const meals = {};
    for (const cat of Object.keys(data.recipes || {})) {
      meals[cat] = pickTwoFrom(data.recipes[cat], idx);
    }
    out.push({date: dateStr, meals});
  }
  return out;
}

async function renderGrocery() {
  groceryListEl.innerHTML = '<li>Loading…</li>';
  const data = await loadRecipes();
  const plan = await generateWeeklyPlan(7, data);
  const agg = {};
  plan.forEach(d => {
    for (const cat in d.meals) {
      d.meals[cat].forEach(r => {
        (r && r.ingredients || []).forEach(ing => {
          const key = ing.toLowerCase();
          if (!agg[key]) agg[key] = {name: ing, qty: ''};
        });
      });
    }
  });
  groceryListEl.innerHTML = '';
  Object.keys(agg).sort().forEach(k => {
    const li = document.createElement('li');
    li.innerHTML = `<label><input type="checkbox" data-key="${k}" /> ${agg[k].name}</label>`;
    groceryListEl.appendChild(li);
  });
}

generateFromRecipesBtn && generateFromRecipesBtn.addEventListener('click', async () => {
  await renderGrocery();
  alert('Generated grocery preview (check list).');
});

clearCheckedBtn && clearCheckedBtn.addEventListener('click', () => {
  document.querySelectorAll('#groceryList input[type=checkbox]').forEach(cb => cb.checked = false);
});

async function renderCalendar() {
  try {
    const cal = await loadCalendar();
    calendarEventsEl.innerHTML = '';
    if (!cal.events || cal.events.length === 0) {
      calendarEventsEl.innerHTML = '<p>No events found</p>';
      return;
    }
    cal.events.forEach(ev => {
      const d = document.createElement('div');
      d.className = 'card';
      d.innerHTML = `<strong>${ev.title}</strong><div>${new Date(ev.start).toLocaleString()}</div><div>${ev.location || ''}</div>`;
      calendarEventsEl.appendChild(d);
    });
  } catch (err) {
    calendarEventsEl.innerHTML = `<p>Error: ${err.message}</p>`;
  }
}

async function renderPrep() {
  const data = await loadRecipes();
  const plan = await generateWeeklyPlan(7, data);
  const prepItems = [];
  plan.forEach(d => {
    for (const cat in d.meals) {
      d.meals[cat].forEach(r => {
        if (r && r.prepNotes) prepItems.push({date: d.date, meal: cat, title: r.title, note: r.note});
      });
    }
  });
  const today = new Date().toISOString().slice(0,10);
  const tomorrow = new Date(); tomorrow.setDate(new Date().getDate()+1);
  const tom = tomorrow.toISOString().slice(0,10);
  const near = prepItems.filter(p => p.date === today || p.date === tom);
  prepListEl.innerHTML = near.length ? near.map(n => `<div class="card"><strong>${n.title}</strong><div>${n.meal} - ${n.date}</div><div>${n.note}</div></div>`).join('') : '<p>No prep needed in next 48 hours.</p>';
}

refreshBtn.addEventListener('click', async () => {
  // Clear the cache to force a fresh fetch
  localStorage.removeItem(KEY_CACHE);
  localStorage.removeItem(KEY_CAL_CACHE);
  alert('Cache cleared. Refreshing data from remote sources...');
  await init();
});

// initial boot
async function init(){
  showView('dashboard');
  await renderDashboardSmall();
  // periodic refresh every 10 minutes
  setInterval(renderDashboardSmall, 10 * 60 * 1000);
};

init();
