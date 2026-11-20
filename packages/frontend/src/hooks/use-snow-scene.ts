import { useEffect, useState } from 'react';

export function useSnowScene(snowToday: boolean) {
  const [mode, setMode] = useState<'on' | 'plowing' | 'plowing-snow' | 'off'>('on');
  const plowing = mode === 'plowing' || mode === 'plowing-snow';
  useEffect(() => {
    if (!plowing) return;
    const timer = window.setTimeout(
      () => setMode('off'),
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 450 : 4850,
    );
    return () => window.clearTimeout(timer);
  }, [plowing]);

  const toggle = () => setMode(mode === 'off' ? 'on' : snowToday ? 'plowing-snow' : 'plowing');
  return { mode: plowing ? 'plowing' as const : mode, falling: mode === 'plowing-snow' || (mode === 'on' && snowToday), toggle };
}
