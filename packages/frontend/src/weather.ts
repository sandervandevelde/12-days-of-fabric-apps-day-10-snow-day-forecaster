import type { AppFunctionsSchema } from '@rayfin-app/functions/types';

export type Place = AppFunctionsSchema['searchPlaces']['output']['places'][number];
export type Forecast = AppFunctionsSchema['getForecast']['output'];
export type Day = Forecast['days'][number];
export type CalendarMode = 'week' | 'month';

export const initialPlace: Place = {
  name: 'Rovaniemi', region: 'Lapland, Finland', latitude: 66.49897, longitude: 25.68867,
};

const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
export function shiftDate(date: string, days: number) {
  const result = utc(date);
  result.setUTCDate(result.getUTCDate() + days);
  return iso(result);
}

export function periodStart(date: string, mode: CalendarMode) {
  return mode === 'month' ? `${date.slice(0, 7)}-01` : shiftDate(date, -(utc(date).getUTCDay() + 6) % 7);
}

export function shiftPeriod(start: string, mode: CalendarMode, step: number) {
  if (mode === 'week') return shiftDate(start, 7 * step);
  const date = utc(start);
  date.setUTCMonth(date.getUTCMonth() + step);
  return iso(date);
}

export function calendarDates(start: string, mode: CalendarMode): (string | null)[] {
  if (mode === 'week') return Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
  const lead = (utc(start).getUTCDay() + 6) % 7;
  const count = utc(shiftDate(shiftPeriod(start, mode, 1), -1)).getUTCDate();
  return Array.from({ length: Math.ceil((lead + count) / 7) * 7 }, (_, index) =>
    index < lead || index >= lead + count ? null : shiftDate(start, index - lead));
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(utc(date));
}

export function isSnowDay(day?: Day) {
  return (day?.snow ?? 0) > 0 || [71, 73, 75, 77, 85, 86].includes(day?.code ?? -1);
}

export function hasWeather(day?: Day): day is Day {
  return !!day && [day.snow, day.code, day.high, day.low].some(value => value !== null);
}

export function snowDepth(snow: number) {
  return snow > 0 && snow < 0.1 ? '<0.1 cm' : `${Number(snow.toFixed(1))} cm`;
}

export function coordinates(latitude: number, longitude: number) {
  return `${Math.abs(latitude).toFixed(2)}° ${latitude < 0 ? 'S' : 'N'} · ${Math.abs(longitude).toFixed(2)}° ${longitude < 0 ? 'W' : 'E'}`;
}
