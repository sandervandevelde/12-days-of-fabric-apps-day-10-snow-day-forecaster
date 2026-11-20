import { useEffect, useRef, useState, type CSSProperties } from 'react';

type Drift = { id: number; width: number; center: number; height: number; delay: number; duration: number; tilt: number };
type PlacedDrift = { id: number; style: CSSProperties };

const flakes = Array.from({ length: 46 }, (_, index) => ({
  '--flake-x': `${(index * 47 + 13) % 101}%`,
  '--flake-size': `${3 + (index * 7) % 7}px`,
  '--flake-speed': `${8 + (index * 11) % 16}s`,
  '--flake-delay': `${-((index * 137) % 180) / 10}s`,
  '--flake-drift': `${(index * 31) % 150 - 75}px`,
}) as CSSProperties);

function SnowCover() {
  const layer = useRef<HTMLDivElement>(null);
  const [drifts, setDrifts] = useState<PlacedDrift[]>([]);

  useEffect(() => {
    const page = layer.current?.parentElement;
    if (!page) return;

    const profiles = new WeakMap<HTMLElement, Drift[]>();
    let id = 0;
    let frame = 0;
    let surfaces = new Set<HTMLElement>();

    function measure() {
      frame = 0;
      const positions: PlacedDrift[] = [];
      for (const surface of surfaces) {
        const { left, top, width, height } = surface.getBoundingClientRect();
        if (width <= 0 || height <= 0) continue;

        let patches = profiles.get(surface);
        if (!patches) {
          patches = Array.from({ length: width >= 180 ? 2 : 1 }, () => ({
            id: id++,
            width: .44 + Math.random() * .52,
            center: Math.random(),
            height: 5 + Math.random() * 11,
            delay: .5 + Math.random() * 7,
            duration: 7 + Math.random() * 19,
            tilt: -3 + Math.random() * 6,
          }));
          profiles.set(surface, patches);
        }

        const inset = Math.min(20, width * .15);
        const ledge = width - 2 * inset;
        const slot = ledge / patches.length;
        for (const [index, patch] of patches.entries()) {
          const span = Math.min(slot * patch.width, 145);
          const depth = Math.min(patch.height, height * .32);
          positions.push({
            id: patch.id,
            style: {
              left: left + inset + index * slot + (slot - span) * patch.center,
              top: top + 2 - depth,
              width: span,
              height: depth,
              '--drift-delay': `${patch.delay}s`,
              '--drift-duration': `${patch.duration}s`,
              '--drift-tilt': `${patch.tilt}deg`,
            } as CSSProperties,
          });
        }
      }
      setDrifts(positions);
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    const syncSurfaces = () => {
      const next = new Set(page.querySelectorAll<HTMLElement>('[data-snow-ledge]'));
      for (const surface of surfaces) if (!next.has(surface)) resize?.unobserve(surface);
      for (const surface of next) if (!surfaces.has(surface)) resize?.observe(surface);
      surfaces = next;
      schedule();
    };
    const changes = new MutationObserver(records => {
      if (records.some(({ target }) => !(target instanceof Element && target.closest('[data-snow-overlay]')))) syncSurfaces();
    });

    resize?.observe(page);
    changes.observe(page, { childList: true, subtree: true });
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    syncSurfaces();

    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      changes.disconnect();
      document.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return <div ref={layer} className="snow-cover" data-snow-overlay aria-hidden="true">
    <div className="snowfall">{flakes.map((style, index) => <i key={index} style={style} />)}</div>
    {drifts.map(({ id, style }) => <i key={id} className="snow-drift" style={style} />)}
  </div>;
}

export function SnowScene({ falling, plowing }: { falling: boolean; plowing: boolean }) {
  return <>
    {falling && <SnowCover />}
    {plowing && <div className="plow-stage" aria-hidden="true">
      <div className="plow-route"><svg viewBox="0 0 220 95" className="plow-truck">
        <ellipse cx="92" cy="85" rx="88" ry="7" className="plow-shadow" />
        <path d="M20 39h62v31H13V49zM83 69V20h40l27 30h18v25H20v-6z" className="plow-body" />
        <path d="M95 27h22l17 21H95z" className="plow-glass" />
        <path d="M101 20v-8h14v8M149 52h15v9h-15z" className="plow-light" />
        <circle cx="45" cy="74" r="13" className="plow-wheel" /><circle cx="135" cy="74" r="13" className="plow-wheel" />
        <circle cx="45" cy="74" r="5" className="plow-glass" /><circle cx="135" cy="74" r="5" className="plow-glass" />
        <path d="M163 73l20-8 9-12-2 28h-33z" className="plow-light" />
        <path d="M190 82c0-11 3-17 10-20v20z" className="plow-spray" />
        <g className="plow-spray">
          <circle cx="193" cy="55" r="3" /><circle cx="204" cy="51" r="3.5" />
          <circle cx="212" cy="66" r="2.5" /><circle cx="208" cy="73" r="2" />
        </g>
      </svg></div>
    </div>}
  </>;
}
