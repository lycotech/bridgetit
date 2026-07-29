/**
 * The bridge itself — one piece of art shared by the Bridge Gauge, the journey
 * animation and the success screen, so the structure never shifts between steps.
 */
import {
  BASE_Y,
  DECK_PATH,
  DECK_Y,
  PIERS,
  STAYS,
  TOWER_LIGHT,
  TOWER_TOP,
  VIEW_H,
  VIEW_W,
  X0,
  X1,
  deckX,
  deckY,
} from "./geometry";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function BridgeDefs() {
  return (
    <defs>
      <linearGradient id="pb-deck-fill" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="hsl(var(--earned))" />
        <stop offset="65%" stopColor="hsl(var(--primary))" />
        <stop offset="100%" stopColor="hsl(var(--available))" />
      </linearGradient>
      <linearGradient id="pb-steel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.32" />
        <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0.08" />
      </linearGradient>
      <radialGradient id="pb-beacon-glow">
        <stop offset="0%" stopColor="hsl(var(--available))" stopOpacity="0.6" />
        <stop offset="100%" stopColor="hsl(var(--available))" stopOpacity="0" />
      </radialGradient>
      <filter id="pb-beacon-shadow" x="-120%" y="-120%" width="340%" height="340%">
        <feDropShadow
          dx="0"
          dy="3"
          stdDeviation="3"
          floodColor="hsl(var(--foreground))"
          floodOpacity="0.28"
        />
      </filter>
      <filter id="pb-beacon-shadow-lifted" x="-140%" y="-140%" width="380%" height="380%">
        <feDropShadow
          dx="0"
          dy="6"
          stdDeviation="6"
          floodColor="hsl(var(--foreground))"
          floodOpacity="0.38"
        />
      </filter>
    </defs>
  );
}

/**
 * Pylons, cable stays, under-deck bracing and the deck that fills left to right.
 * `instant` removes the easing while a finger is on the beacon so the fill tracks
 * the thumb exactly.
 */
export function BridgeStructure({
  fraction,
  instant = false,
  sweep = false,
}: {
  fraction: number;
  instant?: boolean;
  sweep?: boolean;
}) {
  const fillTransition = instant ? "none" : `stroke-dashoffset 380ms ${EASE}`;

  return (
    <>
      {/* water line */}
      <line
        x1={X0 - 16}
        y1={BASE_Y}
        x2={X1 + 16}
        y2={BASE_Y}
        stroke="hsl(var(--border))"
        strokeWidth="1"
      />

      {/* under-deck bracing */}
      {PIERS.map((t, i) => {
        const lit = t <= fraction;
        const next = PIERS[i + 1];
        return (
          <g key={t}>
            <line
              x1={deckX(t)}
              y1={deckY(t) + 2}
              x2={deckX(t)}
              y2={BASE_Y}
              stroke={lit ? "hsl(var(--primary))" : "url(#pb-steel)"}
              strokeOpacity={lit ? 0.42 : 1}
              strokeWidth="2"
              strokeLinecap="round"
              style={{ transition: instant ? "none" : `stroke 260ms ${EASE}` }}
            />
            {next === undefined ? null : (
              <line
                x1={deckX(t)}
                y1={BASE_Y}
                x2={deckX(next)}
                y2={deckY(next) + 3}
                stroke={next <= fraction ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                strokeOpacity={next <= fraction ? 0.22 : 0.08}
                strokeWidth="1"
              />
            )}
          </g>
        );
      })}

      {/* pylons + cable stays */}
      {[
        { x: X0, dir: 1, lightColor: "hsl(var(--protected))" },
        { x: X1, dir: -1, lightColor: "hsl(var(--available))" },
      ].map((tower) => {
        const towerLit = tower.dir === 1 ? fraction > 0 : fraction >= 0.995;
        return (
          <g key={tower.x}>
            {STAYS.map((offset) => {
              const t = tower.dir === 1 ? offset : 1 - offset;
              const lit = t <= fraction;
              return (
                <line
                  key={offset}
                  x1={tower.x}
                  y1={TOWER_TOP + 6}
                  x2={deckX(t)}
                  y2={deckY(t) - 3}
                  stroke={lit ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                  strokeOpacity={lit ? 0.5 : 0.14}
                  strokeWidth="0.9"
                  style={{ transition: instant ? "none" : `stroke-opacity 300ms ${EASE}` }}
                />
              );
            })}
            <line
              x1={tower.x}
              y1={BASE_Y}
              x2={tower.x}
              y2={TOWER_TOP}
              stroke="hsl(var(--foreground))"
              strokeOpacity="0.3"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle
              cx={tower.x}
              cy={TOWER_LIGHT}
              r="3.5"
              fill={tower.lightColor}
              fillOpacity={towerLit ? 1 : 0.35}
              style={{ transition: `fill-opacity 320ms ${EASE}` }}
            />
            {towerLit ? (
              <circle cx={tower.x} cy={TOWER_LIGHT} r="8" fill={tower.lightColor} fillOpacity="0.14" />
            ) : null}
          </g>
        );
      })}

      {/* deck — unfilled */}
      <path
        d={DECK_PATH}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.15"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* deck — filled */}
      <path
        d={DECK_PATH}
        fill="none"
        stroke="url(#pb-deck-fill)"
        strokeWidth="7"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - fraction}
        style={{ transition: fillTransition }}
      />
      {/* deck highlight */}
      <path
        d={DECK_PATH}
        fill="none"
        stroke="hsl(var(--available))"
        strokeOpacity="0.5"
        strokeWidth="1"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - fraction}
        style={{ transition: fillTransition }}
      />
      {/* travelling light */}
      {sweep ? (
        <path
          d={DECK_PATH}
          fill="none"
          stroke="hsl(var(--available))"
          strokeOpacity="0.9"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="0.12 0.88"
          strokeDashoffset={1 - fraction * 2}
        />
      ) : null}
    </>
  );
}

/** Percentage position of a point on the deck, for HTML overlays. */
export function deckPercent(t: number): { left: string; top: string } {
  return {
    left: `${(deckX(t) / VIEW_W) * 100}%`,
    top: `${(deckY(t) / VIEW_H) * 100}%`,
  };
}
