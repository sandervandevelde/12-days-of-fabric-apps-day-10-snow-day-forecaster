import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Forecast, Place } from './weather';

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
  vi.unstubAllGlobals();
});

describe('Snowpost', () => {
  it('marks snow and distinguishes unavailable forecasts across calendar views', async () => {
    render(<App />);
    const today = await screen.findByRole('article', { name: /Monday, November 30, today/ });
    expect(within(today).getByLabelText('Snowfall 0.1 cm')).toBeVisible();
    const missing = screen.getByRole('article', { name: /Wednesday, December 2/ });
    expect(within(missing).getByLabelText('No forecast')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
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

  it('ploughs before switching off snow and can resume snowfall', async () => {
    const { container } = render(<App />);
    await screen.findByText('Snow is in the forecast today!');
    expect(container.querySelector('.snowfall')).toBeInTheDocument();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Snow on' }));
    expect(screen.getByRole('button', { name: 'Ploughing…' })).toBeDisabled();
    expect(container.querySelector('.plow-truck')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2299));
    expect(screen.queryByRole('button', { name: 'Snow off' })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('.snowfall')).not.toBeInTheDocument();
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
