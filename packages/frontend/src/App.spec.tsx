import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { shiftDate, type Forecast, type Place } from './weather';

const { forecast, search } = vi.hoisted(() => ({ forecast: vi.fn(), search: vi.fn() }));
vi.mock('./lib/rayfin-client', () => ({
  getRayfinClient: async () => ({ functions: {
    getForecast: { invoke: forecast }, searchPlaces: { invoke: search },
  } }),
}));

const snow: Forecast = {
  error: '', timezone: 'Europe/Helsinki', days: [
    { date: '2026-11-30', snow: 0.14, high: -0.2, low: -2.4, code: 71 },
    { date: '2026-12-01', snow: 0, high: 0, low: -2.7, code: 3 },
    { date: '2026-12-02', snow: null, high: null, low: null, code: null },
  ],
};

beforeEach(() => {
  forecast.mockReset().mockResolvedValue(snow);
  search.mockReset();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Snowpost', () => {
  it('marks snow and distinguishes unavailable forecasts across calendar views', async () => {
    forecast.mockResolvedValue({
      ...snow,
      days: [...snow.days, ...Array.from({ length: 13 }, (_, index) => ({
        ...snow.days[1], date: shiftDate('2026-12-03', index),
      }))],
    });
    render(<App />);
    const today = await screen.findByRole('article', { name: /Monday, November 30, today/ });
    expect(within(today).getByLabelText('Snowfall 0.1 cm')).toBeVisible();
    const missing = screen.getByRole('article', { name: /Wednesday, December 2/ });
    expect(within(missing).getByLabelText('No forecast')).toBeVisible();
    expect(within(screen.getByRole('group', { name: 'Weekly forecast' })).getAllByRole('article')).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: 'Two weeks' }));
    const calendar = within(screen.getByRole('group', { name: 'Two-week forecast' }));
    expect(calendar.getAllByRole('article')).toHaveLength(14);
    expect(calendar.getByRole('article', { name: 'Sunday, December 13' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Nov 30 – Dec 13, 2026' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next two weeks' }));
    expect(calendar.getByRole('article', { name: 'Monday, December 14' })).toBeVisible();
    expect(calendar.queryByRole('article', { name: 'Sunday, December 13' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next two weeks' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous two weeks' }));
    expect(screen.getByRole('heading', { name: 'Nov 30 – Dec 13, 2026' })).toBeVisible();
  });

  it('loads the chosen search result and supports keyboard pinning on the globe', async () => {
    const places: Place[] = [
      { name: 'Springfield', region: 'Illinois, United States', latitude: 39.8, longitude: -89.65 },
      { name: 'Springfield', region: 'Missouri, United States', latitude: 37.2, longitude: -93.29 },
    ];
    search.mockResolvedValue({ error: '', places });
    render(<App />);
    fireEvent.change(screen.getByLabelText('Find a location'), { target: { value: 'Springfield' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find place' }));
    fireEvent.click(await screen.findByRole('button', { name: /Springfield, Missouri/ }));
    expect(await screen.findByRole('heading', { name: 'Springfield' })).toBeVisible();
    await screen.findByText('Snow is in the forecast today!');
    expect(forecast).toHaveBeenLastCalledWith({ latitude: 37.2, longitude: -93.29 }, { timeoutMs: 12000 });
    const globe = screen.getByRole('group', { name: /Interactive world globe/ });
    fireEvent.keyDown(globe, { key: 'ArrowRight' });
    fireEvent.keyDown(globe, { key: 'Enter' });
    expect(await screen.findByRole('heading', { name: 'Dropped pin' })).toBeVisible();
    await screen.findByText('Snow is in the forecast today!');
    expect(forecast).toHaveBeenCalledTimes(3);
  });

  it('builds separate drifts across the page and removes them after the plough sweep', async () => {
    let scroll = 0;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.matches('.brand-mark')) return new DOMRect(30, 25 - scroll, 44, 44);
      if (this.matches('.globe-panel')) return new DOMRect(520, 200 - scroll, 450, 320);
      if (this.matches('.day-cell:first-of-type')) return new DOMRect(60, 780 - scroll, 120, 108);
      if (this.matches('.winter-footer')) return new DOMRect(60, 980 - scroll, 900, 45);
      return new DOMRect();
    });
    const { container } = render(<App />);
    await screen.findByText('Snow is in the forecast today!');
    expect(container.querySelector('.snowfall')).toBeInTheDocument();
    const drifts = () => [...container.querySelectorAll<HTMLElement>('.snow-drift')];
    await waitFor(() => expect(drifts()).toHaveLength(6));
    expect(new Set(drifts().map(drift => drift.style.getPropertyValue('--drift-delay'))).size).toBeGreaterThan(1);
    const initialTops = drifts().map(drift => parseFloat(drift.style.top));
    expect(initialTops[0]).toBeLessThan(25);
    expect(initialTops.at(-1)).toBeGreaterThan(960);
    scroll = 200;
    fireEvent.scroll(document);
    await waitFor(() => expect(drifts().map(drift => parseFloat(drift.style.top)))
      .toEqual(initialTops.map(top => expect.closeTo(top - 200))));

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Snow on' }));
    expect(screen.getByRole('button', { name: 'Ploughing…' })).toBeDisabled();
    expect(container.querySelector('.plow-truck')).toBeInTheDocument();
    expect(drifts()).toHaveLength(6);
    act(() => vi.advanceTimersByTime(4849));
    expect(screen.queryByRole('button', { name: 'Snow off' })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('.snowfall')).not.toBeInTheDocument();
    expect(drifts()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Snow off' }));
    expect(container.querySelector('.snowfall')).toBeInTheDocument();
  });

  it('surfaces a forecast error and can retry', async () => {
    forecast.mockRejectedValueOnce(new Error('offline'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the forecast');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Snow is in the forecast today!')).toBeVisible();
  });
});
