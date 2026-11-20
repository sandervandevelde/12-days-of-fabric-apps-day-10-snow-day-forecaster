//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
  ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Cloud, CloudDrizzle,
  CloudFog, CloudLightning, CloudSun, Compass, MapPin, Moon, Search, Snowflake,
  Sun, Truck, X,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Globe } from './Globe';
import { SnowScene } from './SnowScene';
import { useTheme } from './hooks/theme.context';
import { useSnowScene } from './hooks/use-snow-scene';
import { getRayfinClient } from './lib/rayfin-client';
import {
  calendarDates, coordinates, formatDate, hasWeather, initialPlace, isSnowDay,
  periodStart, shiftDate, shiftPeriod, snowDepth, type CalendarMode, type Day,
  type Forecast, type Place,
} from './weather';

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; forecast: Forecast };
type SearchState = { status: 'idle' | 'loading' } | { status: 'error'; message: string } | { status: 'ready'; places: Place[] };
const idle: SearchState = { status: 'idle' };
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function condition(day: Day) {
  const code = day.code;
  if (isSnowDay(day)) return { Icon: Snowflake, label: 'Snow forecast' };
  if (code === 0) return { Icon: Sun, label: 'Clear' };
  if (code === 1 || code === 2) return { Icon: CloudSun, label: 'Partly cloudy' };
  if (code === 3) return { Icon: Cloud, label: 'Overcast' };
  if (code === 45 || code === 48) return { Icon: CloudFog, label: 'Fog' };
  if (code !== null && code >= 95) return { Icon: CloudLightning, label: 'Thunderstorms' };
  if (code !== null && code >= 51) return { Icon: CloudDrizzle, label: 'Rain or drizzle' };
  return { Icon: Cloud, label: 'Conditions unavailable' };
}

function ForecastCalendar({ forecast, mode, offset, setOffset }: {
  forecast: Forecast; mode: CalendarMode; offset: number; setOffset: (offset: number) => void;
}) {
  const today = forecast.days[0]?.date;
  const last = forecast.days.at(-1)?.date;
  if (!today || !last || !forecast.days.some(hasWeather)) {
    return <p className="calendar-message" role="status">No forecast data is available for this spot. Try another location.</p>;
  }
  const first = periodStart(today, mode);
  let visibleOffset = offset;
  while (shiftPeriod(first, mode, visibleOffset) > last && visibleOffset > 0) visibleOffset -= 1;
  const start = shiftPeriod(first, mode, visibleOffset);
  const canGoForward = shiftPeriod(start, mode, 1) <= last;
  const end = shiftDate(start, 6);
  const title = mode === 'month' ? formatDate(start, { month: 'long', year: 'numeric' })
    : `${formatDate(start, { month: 'short', day: 'numeric' })} – ${formatDate(end, { ...(start.slice(0, 7) === end.slice(0, 7) ? {} : { month: 'short' }), day: 'numeric' })}, ${end.slice(0, 4)}`;
  const days = new Map(forecast.days.map(day => [day.date, day]));

  return <>
    <div className="calendar-navigation">
      <h3 aria-live="polite">{title}</h3>
      <div className="flex items-center gap-200">
        <button className="icon-button" aria-label={`Previous ${mode}`} disabled={visibleOffset === 0} onClick={() => setOffset(visibleOffset - 1)}><ChevronLeft className="icon-size-200" /></button>
        <button className="icon-button" aria-label={`Next ${mode}`} disabled={!canGoForward} onClick={() => setOffset(visibleOffset + 1)}><ChevronRight className="icon-size-200" /></button>
      </div>
    </div>
    <div className={`calendar-grid ${mode}`} aria-label={`${mode === 'week' ? 'Weekly' : 'Monthly'} forecast`}>
      {weekdays.map(day => <div key={day} className="weekday">{day}</div>)}
      {calendarDates(start, mode).map((date, index) => {
        if (!date) return <div key={`empty-${index}`} className="day-cell day-empty" aria-hidden="true" />;
        const day = days.get(date);
        const snow = isSnowDay(day);
        const weather = hasWeather(day) ? condition(day) : null;
        const amount = snow && day?.snow != null && day.snow > 0 ? snowDepth(day.snow) : '';
        return <article key={date} className={`day-cell ${snow ? 'day-snow' : ''} ${date === today ? 'day-today' : ''} ${!weather ? 'day-unavailable' : ''}`}
          aria-label={`${formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}${date === today ? ', today' : ''}`}>
          <div className="day-number"><time dateTime={date}>{Number(date.slice(-2))}</time>{date === today && <span className="today-tag">Today</span>}</div>
          {weather && day ? <>
            <weather.Icon className="day-icon" role="img" aria-label={weather.label} />
            <div className="day-temperature"><strong aria-label={day.high === null ? 'High unavailable' : `High ${Math.round(day.high)} degrees Celsius`}>{day.high === null ? '–' : `${Math.round(day.high)}°`}</strong><span aria-label={day.low === null ? 'Low unavailable' : `Low ${Math.round(day.low)} degrees Celsius`}>{day.low === null ? '–' : `${Math.round(day.low)}°`}</span></div>
            {snow && <span className="day-amount" aria-label={amount ? `Snowfall ${amount}` : 'Snow forecast'}>{amount || 'Snow'}</span>}
          </> : <span className="day-dash" aria-label="No forecast">—</span>}
        </article>;
      })}
    </div>
    <div className="calendar-legend">
      <span><Snowflake className="icon-size-200 legend-snow" /> Snow forecast</span>
      <span><i className="legend-today" /> Today</span>
      <span><i className="legend-missing" /> No forecast</span>
      <span className="calendar-units">Temperatures in °C · Local dates</span>
    </div>
  </>;
}

function App() {
  const { isDark, toggleTheme } = useTheme();
  const [place, setPlace] = useState(initialPlace);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>(idle);
  const [mode, setMode] = useState<CalendarMode>('week');
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const searchVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const fetchForecast = async () => {
      try {
        const client = await getRayfinClient();
        const forecast = await client.functions.getForecast.invoke({
          latitude: place.latitude, longitude: place.longitude,
        }, { timeoutMs: 12000 });
        if (!active) return;
        setLoad(forecast.error ? { status: 'error', message: forecast.error } : { status: 'ready', forecast });
      } catch {
        if (active) setLoad({ status: 'error', message: 'Could not load the forecast. Check your connection and try again.' });
      }
    };
    void fetchForecast();
    const interval = window.setInterval(() => { void fetchForecast(); }, 15 * 60 * 1000);
    return () => { active = false; window.clearInterval(interval); };
  }, [place, refresh]);

  function choose(next: Place) {
    searchVersion.current += 1;
    setSearch(idle);
    setOffset(0);
    setPlace(next);
    setLoad({ status: 'loading' });
  }

  async function findPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    const version = ++searchVersion.current;
    const pair = term.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (pair) {
      const [latitude, longitude] = pair.slice(1).map(Number);
      if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
        choose({ name: 'Dropped pin', region: coordinates(latitude, longitude), latitude, longitude });
      } else setSearch({ status: 'error', message: 'Enter latitude from −90 to 90 and longitude from −180 to 180.' });
      return;
    }
    if (term.length < 2) {
      setSearch({ status: 'error', message: 'Enter at least two characters to find a place.' });
      return;
    }
    setSearch({ status: 'loading' });
    try {
      const client = await getRayfinClient();
      const result = await client.functions.searchPlaces.invoke({ query: term }, { timeoutMs: 12000 });
      if (version !== searchVersion.current) return;
      if (result.error) setSearch({ status: 'error', message: result.error });
      else if (result.places.length === 1) { choose(result.places[0]); setQuery(result.places[0].name); }
      else setSearch({ status: 'ready', places: result.places });
    } catch {
      if (version === searchVersion.current) setSearch({ status: 'error', message: 'Could not search for places. Try again or pick a spot on the globe.' });
    }
  }

  const forecast = load.status === 'ready' ? load.forecast : undefined;
  const today = forecast?.days[0];
  const snowToday = isSnowDay(today);
  const snow = useSnowScene(snowToday);
  const nextSnow = forecast?.days.find(isSnowDay);
  const snowCount = forecast?.days.filter(isSnowDay).length;
  const snowStatus = !hasWeather(today) || (!snowToday && today.snow === null) ? 'Today’s snow forecast is unavailable'
    : snowToday ? 'Snow is in the forecast today!' : 'No snow forecast today';

  return <div className="winter-page" data-snow={snow.mode === 'plowing' ? 'plowing' : snow.falling ? 'falling' : 'none'}>
    <header className="winter-header">
      <div className="winter-wrap header-inner">
        <div className="brand-lockup">
          <div className="brand-mark"><Snowflake className="icon-size-400" aria-hidden="true" /></div>
          <div><p>Snowpost</p><span>THE WINTER WEATHER EDITION</span></div>
        </div>
        <div className="header-controls">
          <button type="button" className="snow-toggle" aria-pressed={snow.mode !== 'off'} disabled={snow.mode === 'plowing'} onClick={snow.toggle}>
            {snow.mode === 'plowing' ? <Truck className="icon-size-200" /> : <Snowflake className="icon-size-200" />}
            {snow.mode === 'plowing' ? 'Ploughing…' : snow.mode === 'off' ? 'Snow off' : 'Snow on'}
          </button>
          <button type="button" className="icon-button theme-toggle" aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}>
            {isDark ? <Sun className="icon-size-300" /> : <Moon className="icon-size-300" />}
          </button>
        </div>
      </div>
    </header>

    <main className="winter-wrap winter-main">
      <section className="winter-hero" aria-labelledby="main-title">
        <div className="hero-copy">
          <p className="winter-eyebrow"><span /> THE FESTIVE FORECAST</p>
          <h1 id="main-title">Will it <em>snow?</em></h1>
          <p className="hero-description">Find a little winter magic anywhere in the world. Pick a place to see when the next flakes might fall.</p>
          <div className="location-search">
            <form onSubmit={findPlace} className="search-form">
              <label htmlFor="place-query">Find a location</label>
              <div className="search-control snow-surface">
                <Search className="icon-size-300 search-icon" aria-hidden="true" />
                <input id="place-query" value={query} placeholder="Try Rovaniemi or Montréal" maxLength={100} autoComplete="off"
                  aria-describedby="search-hint" onChange={event => {
                    searchVersion.current += 1; setQuery(event.target.value); setSearch(idle);
                  }} onKeyDown={event => {
                    if (event.key === 'Escape') { searchVersion.current += 1; setSearch(idle); }
                  }} />
                <button type="submit" className="find-button" disabled={search.status === 'loading'}>{search.status === 'loading' ? 'Finding…' : 'Find place'}</button>
              </div>
            </form>
            {search.status !== 'idle' && <div className="search-results">
              <div className="search-results-heading"><span>{search.status === 'loading' ? 'Searching' : 'Place search'}</span>
                <button type="button" className="icon-button" aria-label="Close search results" onClick={() => { searchVersion.current += 1; setSearch(idle); }}><X className="icon-size-200" /></button>
              </div>
              {search.status === 'loading' && <p role="status">Looking for matching places…</p>}
              {search.status === 'error' && <p role="alert">{search.message}</p>}
              {search.status === 'ready' && (search.places.length ?
                <ul>{search.places.map(result => <li key={`${result.name}-${result.latitude}-${result.longitude}`}>
                  <button type="button" aria-label={`${result.name}, ${result.region || coordinates(result.latitude, result.longitude)}`} onClick={() => { choose(result); setQuery(result.name); }}>
                    <MapPin className="icon-size-200" /><span><strong>{result.name}</strong><small>{result.region || coordinates(result.latitude, result.longitude)}</small></span><ArrowUpRight className="icon-size-200" />
                  </button>
                </li>)}</ul> : <p role="status">No matching places. Try a nearby town, coordinates, or the globe.</p>)}
            </div>}
          </div>
          <p id="search-hint" className="search-hint"><Compass className="icon-size-200" /> Drag to explore the globe, then tap to drop a pin.</p>
        </div>
        <Globe place={place} onPick={([longitude, latitude]) => {
          setQuery('');
          choose({ name: 'Dropped pin', region: coordinates(latitude, longitude), latitude, longitude });
        }} />
      </section>

      <section className="outlook snow-surface" aria-labelledby="outlook-title">
        <div className="outlook-intro">
          <div className="outlook-location">
            <div className="section-icon"><MapPin className="icon-size-400" /></div>
            <div><p className="winter-eyebrow">YOUR WINTER OUTLOOK</p><h2 id="outlook-title">{place.name}</h2><p className="place-region">{place.region || coordinates(place.latitude, place.longitude)}</p></div>
          </div>
          {forecast && <div className={`today-status ${snowToday ? 'today-status-snow' : ''}`} role="status">
            <Snowflake className="icon-size-200" aria-hidden="true" /> {snowStatus}
          </div>}
        </div>
        <div className="calendar-panel">
          <div className="calendar-toolbar">
            <div><h3><CalendarDays className="icon-size-300" /> Snow calendar</h3>
              <p>{forecast && forecast.days.some(hasWeather) ? `${snowCount} forecast snow ${snowCount === 1 ? 'day' : 'days'}${nextSnow ? ` · Next: ${nextSnow.date === today?.date ? 'Today' : formatDate(nextSnow.date, { month: 'short', day: 'numeric' })}` : ''}` : 'Worldwide outlook · Up to 16 days'}</p>
            </div>
            <div className="mode-toggle" role="group" aria-label="Calendar view">
              {(['week', 'month'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setOffset(0); }}>{value === 'week' ? 'Week' : 'Month'}</button>)}
            </div>
          </div>
          {load.status === 'loading' && <p className="calendar-message" role="status">Checking the latest forecast…</p>}
          {load.status === 'error' && <div className="calendar-message"><p role="alert">{load.message}</p><button className="retry-button" onClick={() => { setLoad({ status: 'loading' }); setRefresh(value => value + 1); }}>Try again</button></div>}
          {forecast && <ForecastCalendar forecast={forecast} mode={mode} offset={offset} setOffset={setOffset} />}
        </div>
      </section>

      <footer className="winter-footer">
        <span><Snowflake className="icon-size-200" /> Weather and place search by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open‑Meteo</a></span>
        <span>Up to 16 days of model guidance. Forecasts can change, especially farther out.</span>
      </footer>
    </main>
    <SnowScene falling={snow.falling} plowing={snow.mode === 'plowing'} />
  </div>;
}

export default App;
