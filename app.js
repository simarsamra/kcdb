// app.js - static frontend for Kitchen Dashboard using Apps Script endpoints

// --- Helpers & settings keys
const KEY_BASE = 'kr_base_url';
const KEY_TOKEN = 'kr_api_token';
const KEY_CACHE = 'kr_cached_recipes_v1';
const KEY_CAL_CACHE = 'kr_cached_calendar_v1';

// --- DOM
const clockEl = document.getElementById('clock');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
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
  baseUrlInput.value = localStorage.getItem(KEY_BASE) || '';
  apiTokenInput.value = localStorage.getItem(KEY_TOKEN) || '';
  settingsModal.classList.remove('hidden');
});
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
saveSettingsBtn.addEventListener('click', () => {
  localStorage.setItem(KEY_BASE, baseUrlInput.value.trim());
  localStorage.setItem(KEY_TOKEN, apiTokenInput.value.trim());
  alert('Saved settings');
  settingsModal.classList.add('hidden');
});

// fetch helpers
async function fetchRemote(path) {
  const base = localStorage.getItem(KEY_BASE) || '';
  const token = localStorage.getItem(KEY_TOKEN) || '';
  if (!base) throw new Error('Base URL not configured (Settings).');
  const url = new URL(base);
  url.searchParams.append('action', path);
  if (path === 'calendar') url.searchParams.append('days', '7');
  if (token) url.searchParams.append('token', token);
  // append cache-bust
  url.searchParams.append('_ts', Date.now());
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Remote fetch failed: ' + res.status);
  return res.json();
}

// load recipes (remote -> cache -> bundled)
async function loadRecipes() {
  // try remote
  try {
    const json = await fetchRemote('recipes');
    localStorage.setItem(KEY_CACHE, JSON.stringify(json));
    return json;
  } catch (err) {
    console.warn('Remote recipes failed', err);
    // try cached
    const cached = localStorage.getItem(KEY_CACHE);
    if (cached) return JSON.parse(cached);
    // fallback to bundled file
    try {
      const r = await fetch('recipes.json');
      const bundled = await r.json();
      localStorage.setItem(KEY_CACHE, JSON.stringify(bundled));
      return bundled;
    } catch (e) {
      throw new Error('No recipes available');
    }
  }
}

// load calendar
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

// rotation helpers
function rotationIndexForDate(d, rotationDays = 4) {
  return d.getDate() % rotationDays;
}
function pickTwoFrom(arr, idx) {
  if (!arr || arr.length === 0) return [];
  const start = (idx * 2) % arr.length;
  return [arr[start % arr.length], arr[(start + 1) % arr.length]];
}

// Render: Today's recipe (full)
async function renderTodayRecipe() {
  try {
    const data = await loadRecipes();
    const rotation = data.rotation_days || 4;
    const idx = rotationIndexForDate(new Date(), rotation);
    // determine meal by hour
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

// Dashboard small cards
async function renderDashboardSmall() {
  try {
    const recipes = await loadRecipes();
    const cal = await loadCalendar();
    // Today's small recipe summary
    const idx = rotationIndexForDate(new Date(), (recipes.rotation_days || 4));
    const h = new Date().getHours();
    let meal = 'Spare';
    if (h < 10) meal = 'Breakfast';
    else if (h < 15) meal = 'Lunch';
    else if (h < 21) meal = 'Dinner';
    const chosen = pickTwoFrom((recipes.recipes && recipes.recipes[meal]) || [], idx);
    todayRecipeSmall.innerHTML = `<div class="card"><h4>Now: ${meal}</h4>${chosen.map(c => `<div>${c ? c.title : '(none)'}</div>`).join('')}</div>`;

    // Prep now (today/tomorrow)
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

    // Calendar small (top 3 events)
    calendarSmall.innerHTML = `<div class="card"><h4>Calendar</h4>${(cal.events || []).slice(0,3).map(ev => `<div>${new Date(ev.start).toLocaleString()} - ${ev.title}</div>`).join('') || '<div>No events</div>'}</div>`;
  } catch (e) {
    console.warn(e);
  }
}

// generate weekly plan: returns array [{date:'YYYY-MM-DD', meals:{Category: [recipes...]}}]
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

// Grocery generation & UI
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
          // naive merge only
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

// generateFromRecipes button
generateFromRecipesBtn && generateFromRecipesBtn.addEventListener('click', async () => {
  await renderGrocery();
  alert('Generated grocery preview (check list).');
});

// clear checked
clearCheckedBtn && clearCheckedBtn.addEventListener('click', () => {
  document.querySelectorAll('#groceryList input[type=checkbox]').forEach(cb => cb.checked = false);
});

// calendar view render
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

// prep ahead view
async function renderPrep() {
  const data = await loadRecipes();
  const plan = await generateWeeklyPlan(7, data);
  const prepItems = [];
  plan.forEach(d => {
    for (const cat in d.meals) {
      d.meals[cat].forEach(r => {
        if (r && r.prepNotes) prepItems.push({date: d.date, meal: cat, title: r.title, note: r.prepNotes});
      });
    }
  });
  // show near-term items (today/tomorrow)
  const today = new Date().toISOString().slice(0,10);
  const tomorrow = new Date(); tomorrow.setDate(new Date().getDate()+1);
  const tom = tomorrow.toISOString().slice(0,10);
  const near = prepItems.filter(p => p.date === today || p.date === tom);
  prepListEl.innerHTML = near.length ? near.map(n => `<div class="card"><strong>${n.title}</strong><div>${n.meal} - ${n.date}</div><div>${n.note}</div></div>`).join('') : '<p>No prep needed in next 48 hours.</p>';
}

// refresh button
refreshBtn.addEventListener('click', async () => {
  await loadRecipes();
  await loadCalendar();
  await renderDashboardSmall();
  alert('Refreshed (remote fetch attempted).');
});

// initial boot
(async function init(){
  // show dashboard
  showView('dashboard');
  // try one-time loads
  await loadRecipes();
  await loadCalendar();
  await renderDashboardSmall();
  // periodic refresh every 10 minutes
  setInterval(renderDashboardSmall, 10*60*1000);
})();
