import test from 'node:test';
import assert from 'node:assert/strict';
import { temperature, dateLabel, hoursForDate, searchPlaces, getForecast } from './weather-api.mjs';

test('converts before rounding and preserves missing values', () => {
  assert.equal(temperature(20.4, 'F'), '69°');
  assert.equal(temperature(null), '—');
  assert.equal(temperature(-5, 'F'), '23°');
});

test('dates and hourly selection use the city calendar, not weekday indices', () => {
  assert.equal(dateLabel('2026-09-10', { weekday: 'long' }), 'Thursday');
  const data = { hourly: { time: ['2026-09-10T23:00', '2026-09-11T00:00'], temperature_2m: [15, 14], weather_code: [0, 3] } };
  assert.deepEqual(hoursForDate(data, '2026-09-11'), [{ time: '2026-09-11T00:00', temperature: 14, code: 3 }]);
});

test('search encodes names, caches results and respects city coordinates', async () => {
  const original = globalThis.fetch;
  const calls = [];
  const place = { name: 'A & B', latitude: -23.5, longitude: -46.6 };
  globalThis.fetch = async url => {
    calls.push(new URL(url));
    return { ok: true, json: async () => ({ results: [place] }) };
  };
  try {
    assert.deepEqual(await searchPlaces('A & B'), [place]);
    await searchPlaces('A & B');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].searchParams.get('name'), 'A & B');
    await assert.rejects(getForecast(place), /Missing current weather/);
    assert.equal(calls[1].searchParams.get('latitude'), '-23.5');
    assert.match(calls[1].searchParams.get('current'), /apparent_temperature/);
  } finally { globalThis.fetch = original; }
});

test('HTTP errors are not treated as empty search results', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 429 });
  try { await assert.rejects(searchPlaces('rate-limit-test'), /429/); }
  finally { globalThis.fetch = original; }
});
