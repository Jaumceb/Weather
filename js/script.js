import { searchPlaces, getForecast, temperature, dateLabel, hoursForDate } from './weather-api.mjs';

const input = document.querySelector('input[name="search"]');
const suggestions = document.querySelector('.search-suggestions');
const form = document.querySelector('form');
const grid = document.getElementById('grid');
const status = document.getElementById('search-status');
const daySelect = document.getElementById('daySelect');
const units = document.querySelector('.units-wrapper');
const unitsButton = document.querySelector('.units-btn');
let forecast, location, weatherRequest, suggestionRequest, timer, lastSearch;
let searchVersion = 0;
let suggestionVersion = 0;
let tempUnit = 'C', windUnit = 'km/h', precipUnit = 'mm';

function icon(code) {
  if (code === 0) return 'sunny';
  if ([1, 2].includes(code)) return 'partly-cloudy';
  if (code === 3) return 'overcast';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return null;
}

function setIcon(image, code) {
  const name = icon(code);
  image.hidden = !name;
  image.alt = name ? name.replaceAll('-', ' ') : '';
  if (name) image.src = `assets/images/icon-${name}.webp`;
}

function closeSuggestions() {
  clearTimeout(timer);
  suggestionVersion++;
  suggestionRequest?.abort();
  suggestions.replaceChildren();
}

function view(state, message = '') {
  grid.classList.toggle('hidden', state !== 'ready');
  grid.setAttribute('aria-busy', state === 'loading');
  document.getElementById('api-error').classList.toggle('hidden', state !== 'error');
  document.getElementById('no-results').classList.toggle('hidden', state !== 'empty');
  status.textContent = message;
}

async function loadWeather(placeOrQuery) {
  lastSearch = placeOrQuery;
  closeSuggestions();
  const version = ++searchVersion;
  weatherRequest?.abort();
  weatherRequest = new AbortController();
  const { signal } = weatherRequest;
  view('loading', 'Loading weather…');
  try {
    const place = typeof placeOrQuery === 'string' ? (await searchPlaces(placeOrQuery, signal))[0] : placeOrQuery;
    if (version !== searchVersion) return;
    if (!place) { view('empty'); return; }
    const data = await getForecast(place, signal);
    if (version !== searchVersion) return;
    forecast = data;
    location = place;
    daySelect.replaceChildren(...data.daily.time.map(date => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = dateLabel(date, { weekday: 'long', month: 'short', day: 'numeric' });
      return option;
    }));
    render();
    view('ready', `Weather for ${place.name}. Times shown in ${data.timezone.replaceAll('_', ' ')}.`);
  } catch {
    if (version === searchVersion && !signal.aborted) view('error');
  }
}

function renderHours() {
  const cards = hoursForDate(forecast, daySelect.value).map(hour => {
    const card = document.createElement('div');
    card.className = 'hour-card';
    const label = document.createElement('span');
    const image = document.createElement('img');
    setIcon(image, hour.code);
    const time = document.createElement('span');
    const h = Number(hour.time.slice(11, 13));
    time.textContent = `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
    label.append(image, time);
    const value = document.createElement('span');
    value.textContent = temperature(hour.temperature, tempUnit);
    card.append(label, value);
    return card;
  });
  document.querySelector('.hourly-list').replaceChildren(...cards);
}

function render() {
  const { current, daily } = forecast;
  document.querySelector('.city-date h2').textContent = [...new Set([location.name, location.admin1, location.country].filter(Boolean))].join(', ');
  document.querySelector('.city-date h4').textContent = dateLabel(current.time, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.querySelector('.temp-banner h1').textContent = temperature(current.temperature_2m, tempUnit);
  setIcon(document.querySelector('.temp-banner img'), current.weather_code);
  document.querySelector('#div9 span').textContent = temperature(current.apparent_temperature, tempUnit);
  document.querySelector('#div10 span').textContent = Number.isFinite(current.relative_humidity_2m) ? `${current.relative_humidity_2m}%` : '—';
  document.querySelector('#div11 span').textContent = Number.isFinite(current.wind_speed_10m) ? `${Math.round(current.wind_speed_10m / (windUnit === 'mph' ? 1.609344 : 1))} ${windUnit}` : '—';
  document.querySelector('#div12 span').textContent = Number.isFinite(current.precipitation) ? `${Number((current.precipitation / (precipUnit === 'in' ? 25.4 : 1)).toFixed(2))} ${precipUnit}` : '—';
  document.querySelectorAll('.daily-forecast > div').forEach((card, index) => {
    card.hidden = !daily.time[index];
    if (card.hidden) return;
    card.querySelector('h4').textContent = dateLabel(daily.time[index], { weekday: 'short' });
    setIcon(card.querySelector('img'), daily.weather_code[index]);
    card.querySelector('.temp span:first-child').textContent = temperature(daily.temperature_2m_max[index], tempUnit);
    card.querySelector('.temp span:last-child').textContent = temperature(daily.temperature_2m_min[index], tempUnit);
  });
  renderHours();
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (input.value.trim().length >= 2) loadWeather(input.value.trim());
});

input.addEventListener('input', () => {
  closeSuggestions();
  weatherRequest?.abort();
  searchVersion++;
  view(forecast ? 'ready' : 'idle', 'Type a city and choose a result, or press Search.');
  const query = input.value.trim();
  if (query.length < 2) return;
  const version = suggestionVersion;
  timer = setTimeout(async () => {
    suggestionRequest = new AbortController();
    try {
      const places = await searchPlaces(query, suggestionRequest.signal);
      if (version !== suggestionVersion) return;
      suggestions.replaceChildren(...places.map(place => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
        button.addEventListener('click', () => { input.value = place.name; loadWeather(place); });
        li.append(button);
        return li;
      }));
    } catch {
      if (version === suggestionVersion) status.textContent = 'Suggestions unavailable. Press Search to try again.';
    }
  }, 350);
});

input.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') { event.preventDefault(); suggestions.querySelector('button')?.focus(); }
});
daySelect.addEventListener('change', () => { renderHours(); document.querySelector('.hourly-list').scrollTop = 0; });

function closeUnits() { units.classList.remove('open'); unitsButton.setAttribute('aria-expanded', 'false'); }
unitsButton.addEventListener('click', () => { unitsButton.setAttribute('aria-expanded', units.classList.toggle('open')); });
function updateUnits() {
  units.querySelectorAll('[data-unit]').forEach(button => {
    const active = [tempUnit, windUnit, precipUnit].includes(button.dataset.unit);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  units.querySelector('.switch-system').textContent = tempUnit === 'C' && windUnit === 'km/h' && precipUnit === 'mm' ? 'Switch to Imperial' : 'Switch to Metric';
  if (forecast) render();
}
units.querySelectorAll('[data-unit]').forEach(button => button.addEventListener('click', () => {
  const value = button.dataset.unit;
  if (['C', 'F'].includes(value)) tempUnit = value;
  if (['km/h', 'mph'].includes(value)) windUnit = value;
  if (['mm', 'in'].includes(value)) precipUnit = value;
  updateUnits();
}));
units.querySelector('.switch-system').addEventListener('click', () => {
  const imperial = tempUnit === 'C' && windUnit === 'km/h' && precipUnit === 'mm';
  [tempUnit, windUnit, precipUnit] = imperial ? ['F', 'mph', 'in'] : ['C', 'km/h', 'mm'];
  updateUnits();
});
document.addEventListener('click', event => {
  if (!units.contains(event.target)) closeUnits();
  if (!form.contains(event.target)) closeSuggestions();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (units.contains(document.activeElement)) unitsButton.focus();
    if (suggestions.contains(document.activeElement)) input.focus();
    closeUnits();
    closeSuggestions();
  }
});
document.getElementById('retry').addEventListener('click', () => loadWeather(lastSearch));
updateUnits();
view('idle', 'Search for a city to see its weather forecast.');
