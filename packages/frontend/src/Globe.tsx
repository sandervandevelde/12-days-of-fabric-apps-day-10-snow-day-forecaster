import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryObject, Topology } from 'topojson-specification';
import atlas from 'world-atlas/land-110m.json';
import { Crosshair } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { coordinates, type Place } from './weather';

const topology = atlas as Topology<{ land: GeometryObject }>;
const land = feature(topology, topology.objects.land);
const graticule = geoGraticule10();
const stars = Array.from({ length: 50 }, (_, i) => ({
  x: (i * 97 + 17) % 550, y: (i * 67 + 13) % 347, r: i % 7 === 0 ? 1.8 : 0.8,
}));
const origin: [number, number] = [275, 175];
const radius = 145;
type Point = [number, number];

const centerFor = (place: Place): Point => [place.longitude - 16, Math.max(-65, Math.min(65, place.latitude * 0.66))];
const wrap = (longitude: number) => ((longitude + 540) % 360) - 180;
const limit = (latitude: number) => Math.max(-89.5, Math.min(89.5, latitude));

export function Globe({ place, onPick }: { place: Place; onPick: (point: Point) => void }) {
  const id = useId();
  const [camera, setCamera] = useState<{ place: Place; center: Point }>();
  const center = camera?.place === place ? camera.center : centerFor(place);
  const [centerLongitude, centerLatitude] = center;
  const drag = useRef<{ x: number; y: number; center: Point; moved: boolean } | null>(null);
  const projection = geoOrthographic().rotate([-centerLongitude, -centerLatitude]).scale(radius).translate(origin);
  const path = geoPath(projection);
  const point: Point = [place.longitude, place.latitude];
  const marker = geoDistance(center, point) < Math.PI / 2 ? projection(point) : null;

  return (
    <figure className="globe-panel m-0" data-snow-ledge>
      <div className="globe-heading"><span className="live-dot" /> THE WINTER ATLAS</div>
      <svg viewBox="0 0 550 350" className="atlas" tabIndex={0} role="group"
        aria-label="Interactive world globe: drag or use arrow keys to rotate, click or press Enter to pin a location."
        onKeyDown={event => {
          const movement: Record<string, Point> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] };
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPick(center); return; }
          const delta = movement[event.key];
          if (!delta) return;
          event.preventDefault();
          setCamera({ place, center: [wrap(center[0] + delta[0]), limit(center[1] + delta[1])] });
        }}
        onPointerDown={event => {
          if (event.button !== 0 || !event.isPrimary) return;
          drag.current = { x: event.clientX, y: event.clientY, center, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          if (!drag.current || !event.isPrimary) return;
          const { x, y, center: start } = drag.current;
          const dx = event.clientX - x;
          const dy = event.clientY - y;
          if (!drag.current.moved && Math.hypot(dx, dy) < 4) return;
          drag.current.moved = true;
          const sensitivity = 230 / event.currentTarget.getBoundingClientRect().width;
          setCamera({ place, center: [wrap(start[0] - dx * sensitivity), limit(start[1] + dy * sensitivity)] });
        }}
        onPointerCancel={() => { drag.current = null; }}
        onPointerUp={event => {
          if (!event.isPrimary) return;
          const gesture = drag.current;
          drag.current = null;
          if (!gesture || gesture.moved) return;
          const matrix = event.currentTarget.getScreenCTM();
          if (!matrix) return;
          const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
          if (Math.hypot(x - origin[0], y - origin[1]) > radius) return;
          const selected = projection.invert?.([x, y]);
          if (selected) onPick(selected);
        }}
      >
        <defs>
          <radialGradient id={`${id}-sea`} cx="40%" cy="35%" r="70%">
            <stop className="ocean-light" offset="0%" /><stop className="ocean-dark" offset="100%" />
          </radialGradient>
          <radialGradient id={`${id}-land`} cx="42%" cy="35%" r="68%">
            <stop className="land-light" offset="0%" /><stop className="land-dark" offset="100%" />
          </radialGradient>
        </defs>
        <g aria-hidden="true">
          {stars.map(({ x, y, r }, i) => <circle key={i} cx={x} cy={y} r={r} className="atlas-star" />)}
          <path d="M92 101v20m-10-10h20M446 98v14m-7-7h14M455 244v24m-12-12h24M124 275v10m-5-5h10" className="atlas-spark" />
          <circle cx={275} cy={175} r={165} className="atlas-orbit" />
          <circle cx={275} cy={175} r={153} className="atlas-orbit atlas-orbit-inner" />
          <circle cx={275} cy={175} r={radius} className="atlas-sphere" fill={`url(#${id}-sea)`} />
          <path d={path(land) ?? undefined} fill={`url(#${id}-land)`} className="atlas-land" />
          <path d={path(graticule) ?? undefined} className="atlas-grid" />
          <text x="275" y="13" className="atlas-north" textAnchor="middle">N</text>
          {marker && <g transform={`translate(${marker.join(' ')})`}>
            <circle r="18" className="atlas-halo" />
            <circle r="10" className="atlas-halo" />
            <circle r="5" className="atlas-pin" />
          </g>}
          <path d="M268 175h14m-7-7v14" className="atlas-cross" />
        </g>
      </svg>
      <figcaption className="globe-footer">
        <span><Crosshair className="icon-size-200" aria-hidden="true" /> {coordinates(place.latitude, place.longitude)}</span>
        <button type="button" className="globe-center" onClick={() => setCamera(undefined)}>Recenter</button>
      </figcaption>
    </figure>
  );
}
