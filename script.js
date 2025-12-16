// ----------------------------
// Seletores
// ----------------------------
const searchInput = document.querySelector('input[name="search"]');
const searchButton = document.querySelector('.submit-button');
const searchSuggestions = document.querySelector('.search-suggestions');
const dailyForecastDivs = Array.from(document.querySelectorAll('#div2, #div3, #div4, #div5, #div6, #div7, #div8'));
const hourlyList = document.querySelector('.hourly-list');
const daySelect = document.querySelector('select[name="day"]');
const unitsBtn = document.querySelector('.units-btn');
const unitsDropdown = document.querySelector('.units-dropdown');
const tempBannerH1 = document.querySelector('.temp-banner h1');

// Variáveis globais para cidade e país
let currentCity = '';
let currentCountry = '';

// ----------------------------
// Unidades
// ----------------------------
let tempUnit = 'C';
let windUnit = 'km/h';
let precipUnit = 'mm';
let system = 'metric'; // metric ou imperial

// ----------------------------
// Atualiza classes "active" nos botões
// ----------------------------
function updateActiveButtons() {
  unitsDropdown.querySelectorAll('button[data-unit]').forEach(btn => {
    btn.classList.remove('active');
    const unit = btn.dataset.unit;
    if(unit === tempUnit || unit === windUnit || unit === precipUnit) {
      btn.classList.add('active');
    }
  });

  // Atualiza texto do switch
  const switchBtn = unitsDropdown.querySelector('.switch-system');
  switchBtn.textContent = system === 'metric' ? 'Switch to Imperial' : 'Switch to Metric';
}

// ----------------------------
// Mapeamento de códigos para ícones
// ----------------------------
function getIcon(code) {
  if(code === 0) return "icon-sunny";
  if([1,2].includes(code)) return "icon-partly-cloudy";
  if(code === 3) return "icon-overcast";
  if([45,48].includes(code)) return "icon-fog";
  if([51,53,55,56,57].includes(code)) return "icon-drizzle";
  if([61,63,65,66,67,80,81,82].includes(code)) return "icon-rain";
  if([71,73,75,77,85,86].includes(code)) return "icon-snow";
  if([95,96,99].includes(code)) return "icon-storm";
  return "icon-sunny";
}

const weatherCodes = {
  0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
  45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
  56: "Freezing Drizzle", 57: "Freezing Drizzle", 61: "Rain", 63: "Rain",
  65: "Rain", 66: "Freezing Rain", 67: "Freezing Rain", 71: "Snow",
  73: "Snow", 75: "Snow", 77: "Snow Grains", 80: "Rain Showers",
  81: "Rain Showers", 82: "Rain Showers", 85: "Snow Showers",
  86: "Snow Showers", 95: "Thunderstorm", 96: "Thunderstorm with hail",
  99: "Thunderstorm with hail"
};

// ----------------------------
// Formatar hora AM/PM
// ----------------------------
function formatHour(hour24) {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12} ${period}`;
}

// ----------------------------
// Formatação de unidades
// ----------------------------
function formatTemp(tempC) {
  const temp = Math.round(tempC); 
  return tempUnit === 'C' ? `${temp}º` : `${Math.round(temp * 9/5 + 32)}º`;
}

function formatWind(speedKmH) {
  return windUnit === 'km/h' ? `${speedKmH} km/h` : `${Math.round(speedKmH / 1.609)} mph`;
}

function formatPrecip(value) {
  return precipUnit === 'mm' ? `${value} mm` : `${(value/25.4).toFixed(1)} in`;
}

// ----------------------------
// Buscar clima
// ----------------------------
async function fetchWeather(city) {
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en`);
    const geoData = await geoRes.json();
    if(!geoData.results) throw new Error('City not found');

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

// ----------------------------
// Atualiza UI
// ----------------------------
function updateUI(data) {
  // --- Banner principal ---
  const cityDateDiv = document.querySelector('.city-date');
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

  cityDateDiv.querySelector('h2').textContent = `${currentCity}, ${currentCountry}`;
  cityDateDiv.querySelector('h4').textContent = now.toLocaleDateString('en-US', options);
  tempBannerH1.textContent = formatTemp(data.current_weather.temperature);

  // --- Daily forecast ---
  data.daily.weathercode.forEach((code, i) => {
    const div = dailyForecastDivs[i];
    div.querySelector("img").src = `assets/images/${getIcon(code)}.webp`;
    div.querySelector("img").alt = weatherCodes[code];
    div.querySelector(".temp span:first-child").textContent = formatTemp(data.daily.temperature_2m_max[i]);
    div.querySelector(".temp span:last-child").textContent = formatTemp(data.daily.temperature_2m_min[i]);
  });

  // --- Hourly forecast ---
  hourlyList.innerHTML = "";
  const selectedDay = daySelect.value.toLowerCase();
  const weekDays = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const dayIndex = weekDays.indexOf(selectedDay);
  const dailyDateStr = data.daily.time[dayIndex];
  const dailyDate = new Date(dailyDateStr);
  dailyDate.setHours(0,0,0,0);

  for(let i=0; i<data.hourly.time.length; i++) {
    const hourDate = new Date(data.hourly.time[i]);
    if(hourDate.getFullYear() === dailyDate.getFullYear() &&
       hourDate.getMonth() === dailyDate.getMonth() &&
       hourDate.getDate() === dailyDate.getDate()) {

      const hour = formatHour(hourDate.getHours());
      const temp = data.hourly.temperature_2m[i];
      const code = data.hourly.weathercode[i];

      const card = document.createElement("div");
      card.classList.add("hour-card");
      card.innerHTML = `
        <span>
          <img src="assets/images/${getIcon(code)}.webp" alt="${weatherCodes[code]}">
          <span class="hour">${hour}</span>
        </span>
        <span class="temp">${formatTemp(temp)}</span>
      `;
      hourlyList.appendChild(card);
    }
  }

  // --- Estatísticas atuais ---
  document.getElementById('div9').querySelector('span').textContent = formatTemp(data.current_weather.temperature);
  document.getElementById('div10').querySelector('span').textContent = data.hourly.relative_humidity_2m ? `${data.hourly.relative_humidity_2m[0]}%` : '-';
  document.getElementById('div11').querySelector('span').textContent = formatWind(data.current_weather.windspeed);
  document.getElementById('div12').querySelector('span').textContent = data.daily.precipitation_sum ? formatPrecip(data.daily.precipitation_sum[0]) : '-';
}

// ----------------------------
// Eventos
// ----------------------------
searchButton.addEventListener('click', (e) => {
  e.preventDefault();
  const city = searchInput.value.trim();
  if(city) fetchWeather(city);
});

unitsBtn.addEventListener('click', () => {
  unitsDropdown.parentElement.classList.toggle('open');
});

unitsDropdown.querySelectorAll('button[data-unit]').forEach(btn => {
  btn.addEventListener('click', e => {
    const unit = btn.dataset.unit;
    if(['C','F'].includes(unit)) tempUnit = unit;
    if(['km/h','mph'].includes(unit)) windUnit = unit;
    if(['mm','in'].includes(unit)) precipUnit = unit;

    updateActiveButtons();
    if(window.lastWeatherData) updateUI(window.lastWeatherData);
  });
});

const switchBtn = unitsDropdown.querySelector('.switch-system');
switchBtn.addEventListener('click', () => {
  if(system === 'metric') {
    system = 'imperial';
    tempUnit = 'F';
    windUnit = 'mph';
    precipUnit = 'in';
  } else {
    system = 'metric';
    tempUnit = 'C';
    windUnit = 'km/h';
    precipUnit = 'mm';
  }

  updateActiveButtons();
  if(window.lastWeatherData) updateUI(window.lastWeatherData);
});

daySelect.addEventListener('change', () => {
  if(window.lastWeatherData) updateUI(window.lastWeatherData);
});

// ----------------------------
// Autocomplete
// ----------------------------
searchInput.addEventListener('input', async () => {
  const query = searchInput.value.trim();
  searchSuggestions.innerHTML = '';

  if(!query) return;

  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=en`);
    const data = await res.json();

    if(data.results) {
      data.results.forEach(city => {
        const li = document.createElement('li');
        li.textContent = `${city.name}, ${city.country}`;
        li.addEventListener('click', () => {
          searchInput.value = city.name;
          searchSuggestions.innerHTML = '';
          fetchWeather(city.name);
        });
        searchSuggestions.appendChild(li);
      });
    }
  } catch (err) {
    console.error(err);
  }
});

// Fecha sugestões ao clicar fora
document.addEventListener('click', (e) => {
  if (!searchSuggestions.contains(e.target) && e.target !== searchInput) {
    searchSuggestions.innerHTML = '';
  }
});

// ----------------------------
// Inicialização
// ----------------------------
document.addEventListener('DOMContentLoaded', () => {
  const weekDays = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const todayIndex = new Date().getDay();
  daySelect.value = weekDays[todayIndex];
  updateActiveButtons();
});
