import type { CSSProperties } from 'react';

const flakes = Array.from({ length: 46 }, (_, index) => ({
  '--flake-x': `${(index * 47 + 13) % 101}%`,
  '--flake-size': `${3 + (index * 7) % 7}px`,
  '--flake-speed': `${8 + (index * 11) % 16}s`,
  '--flake-delay': `${-((index * 137) % 180) / 10}s`,
  '--flake-drift': `${(index * 31) % 150 - 75}px`,
}) as CSSProperties);

export function SnowScene({ falling, plowing }: { falling: boolean; plowing: boolean }) {
  return <>
    {falling && <div className="snowfall" aria-hidden="true">
      {flakes.map((style, index) => <i key={index} style={style} />)}
    </div>}
    {plowing && <div className="plow-stage" aria-hidden="true">
      <svg viewBox="0 0 200 95" className="plow-truck">
        <ellipse cx="92" cy="85" rx="88" ry="7" className="plow-shadow" />
        <path d="M20 39h62v31H13V49zM83 69V20h40l27 30h18v25H20v-6z" className="plow-body" />
        <path d="M95 27h22l17 21H95z" className="plow-glass" />
        <path d="M101 20v-8h14v8M149 52h15v9h-15z" className="plow-light" />
        <circle cx="45" cy="74" r="13" className="plow-wheel" /><circle cx="135" cy="74" r="13" className="plow-wheel" />
        <circle cx="45" cy="74" r="5" className="plow-glass" /><circle cx="135" cy="74" r="5" className="plow-glass" />
        <path d="M163 73l20-8 9-12-2 28h-33z" className="plow-light" />
        <path d="M190 82c0-11 3-17 10-20v20z" className="plow-spray" />
      </svg>
    </div>}
  </>;
}
