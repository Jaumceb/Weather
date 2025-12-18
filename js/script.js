const searchInput = document.querySelector('input[name="search"]');
const searchButton = document.querySelector('.submit-button');
const searchSuggestions = document.querySelector('.search-suggestions');
const dailyForecastDivs = Array.from(
  document.querySelectorAll('#div2, #div3, #div4, #div5, #div6, #div7, #div8')
);
const hourlyList = document.querySelector('.hourly-list');

const daySelect = document.querySelector('#daySelect');
const selectedDaySpan = daySelect.querySelector('.selected-day');
const dayOptions = daySelect.querySelectorAll('.day-options li');

const unitsBtn = document.querySelector('.units-btn');
const unitsDropdown = document.querySelector('.units-dropdown');
const tempBannerH1 = document.querySelector('.temp-banner h1');

let currentCity = '';
let currentCountry = '';

let tempUnit = 'C';
let windUnit = 'km/h';
let precipUnit = 'mm';
let system = 'metric';

let selectedDay = 'monday';

function updateActiveButtons() {
  unitsDropdown.querySelectorAll('button[data-unit]').forEach(btn => {
    btn.classList.remove('active');
    const unit = btn.dataset.unit;
    if (unit === tempUnit || unit === windUnit || unit === precipUnit) {
      btn.classList.add('active');
    }
  });

  const switchBtn = unitsDropdown.querySelector('.switch-system');
  switchBtn.textContent =
    system === 'metric' ? 'Switch to Imperial' : 'Switch to Metric';
}

function getIcon(code) {
  if (code === 0) return "icon-sunny";
  if ([1, 2].includes(code)) return "icon-partly-cloudy";
  if (code === 3) return "icon-overcast";
  if ([45, 48].includes(code)) return "icon-fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "icon-drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "icon-rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "icon-snow";
  if ([95, 96, 99].includes(code)) return "icon-storm";
  return "icon-sunny";
}

function formatHour(hour24) {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12} ${period}`;
}

function formatTemp(tempC) {
  const temp = Math.round(tempC);
  return tempUnit === 'C'
    ? `${temp}º`
    : `${Math.round(temp * 9 / 5 + 32)}º`;
}

function formatWind(speedKmH) {
  return windUnit === 'km/h'
    ? `${Math.round(speedKmH)} km/h`
    : `${Math.round(speedKmH / 1.609)} mph`;
}

function formatPrecip(value) {
  return precipUnit === 'mm'
    ? `${value} mm`
    : `${(value / 25.4).toFixed(1)} in`;
}

async function fetchWeather(city) {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en`
    );
    const geoData = await geoRes.json();
    if (!geoData.results) throw new Error('City not found');

    const { latitude, longitude, name, country } = geoData.results[0];
    currentCity = name;
    currentCountry = country;

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,weathercode,relative_humidity_2m,precipitation&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum&current_weather=true&timezone=auto`
    );

    const data = await weatherRes.json();
    window.lastWeatherData = data;
    updateUI(data);

  } catch (err) {
    alert(err.message);
  }
}

function updateUI(data) {
  const cityDateDiv = document.querySelector('.city-date');
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

  cityDateDiv.querySelector('h2').textContent = `${currentCity}, ${currentCountry}`;
  cityDateDiv.querySelector('h4').textContent =
    now.toLocaleDateString('en-US', options);

  tempBannerH1.textContent =
    formatTemp(data.current_weather.temperature);

  data.daily.weathercode.forEach((code, i) => {
    const div = dailyForecastDivs[i];
    if (!div) return;

    div.querySelector('img').src =
      `assets/images/${getIcon(code)}.webp`;

    div.querySelector('.temp span:first-child').textContent =
      formatTemp(data.daily.temperature_2m_max[i]);

    div.querySelector('.temp span:last-child').textContent =
      formatTemp(data.daily.temperature_2m_min[i]);
  });

  hourlyList.innerHTML = '';
  const weekDays = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const selectedIndex = weekDays.indexOf(selectedDay);

  const selectedDate = new Date(data.daily.time[selectedIndex]);
  selectedDate.setHours(0, 0, 0, 0);

  data.hourly.time.forEach((time, i) => {
    const date = new Date(time);
    if (date.toDateString() === selectedDate.toDateString()) {
      const card = document.createElement('div');
      card.className = 'hour-card';
      card.innerHTML = `
        <span>
          <img src="assets/images/${getIcon(data.hourly.weathercode[i])}.webp">
          <span class="hour">${formatHour(date.getHours())}</span>
        </span>
        <span class="temp">${formatTemp(data.hourly.temperature_2m[i])}</span>
      `;
      hourlyList.appendChild(card);
    }
  });

  document.querySelector('#div9 span').textContent =
    formatTemp(data.current_weather.temperature);

  document.querySelector('#div10 span').textContent =
    `${data.hourly.relative_humidity_2m[0]}%`;

  document.querySelector('#div11 span').textContent =
    formatWind(data.current_weather.windspeed);

  document.querySelector('#div12 span').textContent =
    formatPrecip(data.daily.precipitation_sum[0]);
}

searchButton.addEventListener('click', e => {
  e.preventDefault();
  if (searchInput.value.trim()) {
    fetchWeather(searchInput.value.trim());
  }
});

unitsBtn.addEventListener('click', () => {
  unitsDropdown.parentElement.classList.toggle('open');
});

unitsDropdown.querySelectorAll('button[data-unit]').forEach(btn => {
  btn.addEventListener('click', () => {
    const u = btn.dataset.unit;
    if (['C', 'F'].includes(u)) tempUnit = u;
    if (['km/h', 'mph'].includes(u)) windUnit = u;
    if (['mm', 'in'].includes(u)) precipUnit = u;

    updateActiveButtons();
    if (window.lastWeatherData) updateUI(window.lastWeatherData);
  });
});

unitsDropdown.querySelector('.switch-system')
  .addEventListener('click', () => {
    system = system === 'metric' ? 'imperial' : 'metric';
    tempUnit = system === 'metric' ? 'C' : 'F';
    windUnit = system === 'metric' ? 'km/h' : 'mph';
    precipUnit = system === 'metric' ? 'mm' : 'in';

    updateActiveButtons();
    if (window.lastWeatherData) updateUI(window.lastWeatherData);
  });

daySelect.addEventListener('click', e => {
  daySelect.classList.toggle('open');
  e.stopPropagation();
});

dayOptions.forEach(li => {
  li.addEventListener('click', () => {
    selectedDay = li.dataset.day;
    selectedDaySpan.textContent = li.textContent;

    dayOptions.forEach(o => o.classList.remove('active'));
    li.classList.add('active');

    daySelect.classList.remove('open');
    if (window.lastWeatherData) updateUI(window.lastWeatherData);
  });
});

document.addEventListener('click', () => {
  daySelect.classList.remove('open');
});

searchInput.addEventListener('input', async () => {
  const query = searchInput.value.trim();
  searchSuggestions.innerHTML = '';
  if (!query) return;

  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=4&language=en`
    );
    const data = await res.json();

    if (data.results) {
      data.results.slice(0, 4).forEach(city => {
        const li = document.createElement('li');
        li.textContent = `${city.name}, ${city.country}`;
        li.onclick = () => {
          searchInput.value = city.name;
          searchSuggestions.innerHTML = '';
          fetchWeather(city.name);
        };
        searchSuggestions.appendChild(li);
      });
    }
  } catch {}
});

document.addEventListener('click', e => {
  if (!searchSuggestions.contains(e.target) && e.target !== searchInput) {
    searchSuggestions.innerHTML = '';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  selectedDay = days[new Date().getDay()];

  dayOptions.forEach(li => {
    if (li.dataset.day === selectedDay) {
      li.classList.add('active');
      selectedDaySpan.textContent = li.textContent;
    }
  });

  updateActiveButtons();
});
