import { UserDataFunctions } from '@microsoft/fabric-user-data-functions';

const udf = new UserDataFunctions();

type Place = { name: string; region: string; latitude: number; longitude: number };
type Day = { date: string; snow: number | null; high: number | null; low: number | null; code: number | null };
type SearchResult = { error: string; places: Place[] };
type ForecastResult = { error: string; timezone: string; days: Day[] };

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function request(endpoint: string, params: Record<string, string>) {
  const response = await fetch(`${endpoint}?${new URLSearchParams(params)}`, {
    signal: AbortSignal.timeout(8000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Weather provider unavailable');
  return object(await response.json());
}

udf.func('searchPlaces', async (query: string): Promise<SearchResult> => {
  const name = typeof query === 'string' ? query.trim() : '';
  if (name.length < 2 || name.length > 100) {
    return { error: 'Enter a place name between 2 and 100 characters.', places: [] };
  }
  try {
    const data = await request('https://geocoding-api.open-meteo.com/v1/search', {
      name, count: '6', language: 'en', format: 'json',
    });
    const places = array(data.results).slice(0, 6).flatMap((value): Place[] => {
      const { name, admin1, country, latitude, longitude } = object(value);
      if (typeof name !== 'string' || typeof latitude !== 'number' || typeof longitude !== 'number') return [];
      const region = [...new Set([admin1, country].filter((part): part is string => typeof part === 'string' && part !== name))].join(', ');
      return [{ name: name.slice(0, 120), region: region.slice(0, 180), latitude, longitude }];
    });
    return { error: '', places };
  } catch {
    return { error: 'Place search is temporarily unavailable. Try again or pick a spot on the globe.', places: [] };
  }
}, []);

udf.func('getForecast', async (latitude: number, longitude: number): Promise<ForecastResult> => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return { error: 'Choose a latitude from −90 to 90 and a longitude from −180 to 180.', timezone: '', days: [] };
  }
  try {
    const data = await request('https://api.open-meteo.com/v1/forecast', {
      latitude: latitude.toFixed(5), longitude: longitude.toFixed(5),
      daily: 'snowfall_sum,temperature_2m_max,temperature_2m_min,weather_code',
      timezone: 'auto', forecast_days: '16', cell_selection: 'nearest',
    });
    const daily = object(data.daily);
    const snow = array(daily.snowfall_sum);
    const high = array(daily.temperature_2m_max);
    const low = array(daily.temperature_2m_min);
    const code = array(daily.weather_code);
    const days = array(daily.time).slice(0, 16).flatMap((date, index): Day[] =>
      typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? [{ date, snow: number(snow[index]), high: number(high[index]), low: number(low[index]), code: number(code[index]) }]
        : []);
    return { error: '', timezone: typeof data.timezone === 'string' ? data.timezone.slice(0, 64) : '', days };
  } catch {
    return { error: 'The forecast is temporarily unavailable. Please try again.', timezone: '', days: [] };
  }
}, []);
