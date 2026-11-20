import { useEffect, useState } from 'react';

export function useSnowScene(snowToday: boolean) {
  const [mode, setMode] = useState<'on' | 'plowing' | 'off'>('on');
  useEffect(() => {
    if (mode !== 'plowing') return;
    const timer = window.setTimeout(
      () => setMode('off'),
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 450 : 2300,
    );
    return () => window.clearTimeout(timer);
  }, [mode]);

  const toggle = () => setMode(mode === 'off' ? 'on' : 'plowing');
  return { mode, falling: snowToday && mode !== 'off', toggle };
}
