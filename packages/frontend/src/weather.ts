import type { AppFunctionsSchema } from '@rayfin-app/functions/types';

export type Place = AppFunctionsSchema['searchPlaces']['output']['places'][number];
export type Forecast = AppFunctionsSchema['getForecast']['output'];
export type Day = Forecast['days'][number];
export type CalendarMode = 'week' | 'two-weeks';

export const calendarDayCount: Record<CalendarMode, number> = { week: 7, 'two-weeks': 14 };

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

export function periodStart(date: string) {
  return shiftDate(date, -((utc(date).getUTCDay() + 6) % 7));
}

export function shiftPeriod(start: string, mode: CalendarMode, step: number) {
  return shiftDate(start, calendarDayCount[mode] * step);
}

export function calendarDates(start: string, mode: CalendarMode) {
  return Array.from({ length: calendarDayCount[mode] }, (_, index) => shiftDate(start, index));
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
