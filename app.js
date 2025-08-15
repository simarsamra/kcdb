// Minimal recipes-only app with cuisines and "prep for upcoming" modal

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
    b.setAttribute('data-cuisine', c);
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
    b.setAttribute('data-meal', m);
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
  for (let i = idx + 1; i < MEALS.length; i++) order.push({meal: MEALS[i], offset: 0});
  // Next day breakfast as well
  order.push({meal: MEALS[0], offset: 1});
  return order;
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

  prepModal.classList.remove('hidden');
}

function toTitle(s) {
  return s.replace(/[-_]/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Events
prepNextBtn.addEventListener('click', openPrepModal);
closePrepModal.addEventListener('click', () => prepModal.classList.add('hidden'));
prepModal.addEventListener('click', (e) => {
  if (e.target === prepModal) prepModal.classList.add('hidden');
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
