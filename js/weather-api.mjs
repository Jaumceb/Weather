const cache = new Map();

async function request(url, signal) {
  const timeout = AbortSignal.timeout(12000);
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.reason || 'Weather service error');
  return data;
}

function remember(url, data, minutes) {
  if (cache.size >= 50) cache.delete(cache.keys().next().value);
  cache.set(url, { data, expires: Date.now() + minutes * 60000 });
  return data;
}

export async function searchPlaces(query, signal) {
  if (query.trim().length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: query.trim(), count: '5', language: 'en', format: 'json' })}`;
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data.results || [];
  const data = await request(url, signal);
  if (data.results !== undefined && !Array.isArray(data.results)) throw new Error('Invalid locations');
  data.results = (data.results || []).filter(place => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
  remember(url, data, 30);
  return data.results;
}

export async function getForecast(place, signal) {
  const url = `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
    latitude: place.latitude, longitude: place.longitude, timezone: 'auto', forecast_days: '7',
    temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,weather_code', daily: 'temperature_2m_max,temperature_2m_min,weather_code',
  })}`;
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data;
  const data = await request(url, signal);
  if (!data.current || typeof data.current.time !== 'string') throw new Error('Missing current weather');
  for (const [group, fields] of Object.entries({ daily: ['temperature_2m_max', 'temperature_2m_min', 'weather_code'], hourly: ['temperature_2m', 'weather_code'] })) {
    const values = data[group];
    if (!Array.isArray(values?.time) || !values.time.length || values.time.some(time => typeof time !== 'string') || fields.some(field => !Array.isArray(values[field]) || values[field].length !== values.time.length)) throw new Error('Incomplete forecast');
  }
  return remember(url, data, 5);
}

export function temperature(value, unit = 'C') {
  return Number.isFinite(value) ? `${Math.round(unit === 'F' ? value * 9 / 5 + 32 : value)}°` : '—';
}

export function dateLabel(date, options) {
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

export function hoursForDate(data, date) {
  return data.hourly.time.flatMap((time, index) => time.slice(0, 10) === date ? [{ time, temperature: data.hourly.temperature_2m[index], code: data.hourly.weather_code[index] }] : []);
}
