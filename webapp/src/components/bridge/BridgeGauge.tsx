import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { MDiv } from "@/lib/motion";
import { naira, shortDate } from "@/lib/platform/format";
import { useAnimatedNumber } from "./use-animated-number";
import { BridgeDefs, BridgeStructure, deckPercent } from "./BridgeArt";
import { BASE_Y, SPAN, VIEW_H, VIEW_W, X0, deckX, deckY } from "./geometry";
import { cn } from "@/lib/utils";

/** ₦5,000 steps for smaller salaries, ₦25,000 once the available amount is larger. */
export function gaugeStep(available: number): number {
  return available >= 100_000 ? 25_000 : 5_000;
}

function snap(raw: number, available: number, step: number): number {
  if (available <= 0) return 0;
  if (raw >= available - step / 2) return available;
  const stepped = Math.round(raw / step) * step;
  return Math.min(available, Math.max(0, stepped));
}

/* --------------------------------------------------------------- microcopy */

/** Supportive guidance that rotates as the selection moves between bands. */
const BANDS: { upTo: number; lines: string[] }[] = [
  {
    upTo: 0.34,
    lines: [
      "Just enough for today's needs.",
      "A small, steady step.",
      "Enough to cover today, and plenty left.",
    ],
  },
  {
    upTo: 0.66,
    lines: [
      "A balanced choice.",
      "Comfortably in the middle.",
      "Balanced — with room still available.",
    ],
  },
  {
    upTo: 0.99,
    lines: [
      "You're accessing most of your available earned pay.",
      "Most of your earned pay, brought forward to today.",
      "This covers most of what you've earned so far.",
    ],
  },
  {
    upTo: Infinity,
    lines: [
      "You can always leave some available for later.",
      "This is everything you've earned so far. Some can always be left for later.",
      "You've selected all that's available today.",
    ],
  },
];

function bandFor(value: number, available: number): number {
  const ratio = available > 0 ? value / available : 0;
  return BANDS.findIndex((band) => ratio <= band.upTo);
}

/* ------------------------------------------------------------------ gauge */

export function BridgeGauge({
  available,
  value,
  onChange,
  payday,
  fee,
  onFirstInteraction,
  onCommit,
  disabled = false,
}: {
  available: number;
  value: number;
  onChange: (value: number) => void;
  payday: string;
  fee: number;
  onFirstInteraction?: () => void;
  /** Fired when the finger lifts or a key is released — the CTA pulses on this. */
  onCommit?: (value: number) => void;
  disabled?: boolean;
}) {
  const step = gaugeStep(available);
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const interacted = useRef(false);

  const fraction = available > 0 ? Math.min(1, Math.max(0, value / available)) : 0;
  const handleX = deckX(fraction);
  const handleY = deckY(fraction);
  const chip = deckPercent(fraction);

  const animatedValue = useAnimatedNumber(value);
  /** You receive exactly what you selected — the fee rides on top of the payroll deduction. */
  const animatedReceive = useAnimatedNumber(value);
  const animatedDeduction = useAnimatedNumber(value > 0 ? value + fee : 0);
  const animatedFee = useAnimatedNumber(value > 0 ? fee : 0);
  const animatedRemaining = useAnimatedNumber(Math.max(0, available - value));

  /* rotating microcopy — a fresh line each time the selection enters a new band */
  const band = bandFor(value, available);
  const [rotation, setRotation] = useState(0);
  const lastBand = useRef(band);
  useEffect(() => {
    if (lastBand.current === band) return;
    lastBand.current = band;
    setRotation((r) => r + 1);
  }, [band]);

  const message =
    value <= 0
      ? "Move your Bridge Gauge to choose an amount."
      : BANDS[band].lines[rotation % BANDS[band].lines.length];

  const markFirstTouch = useCallback(() => {
    if (interacted.current) return;
    interacted.current = true;
    onFirstInteraction?.();
  }, [onFirstInteraction]);

  /** A whisper of haptic feedback on each snap, so the steps feel intentional. */
  const tick = useCallback(() => {
    if (reduce) return;
    navigator.vibrate?.(6);
  }, [reduce]);

  const setFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      // Map the pointer onto the deck span, ignoring the abutment padding.
      const left = rect.left + (X0 / VIEW_W) * rect.width;
      const usable = (SPAN / VIEW_W) * rect.width;
      const t = Math.min(1, Math.max(0, (clientX - left) / usable));
      const next = snap(t * available, available, step);
      if (next === value) return;
      tick();
      onChange(next);
    },
    [available, onChange, step, tick, value],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || available <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    markFirstTouch();
    setFromClientX(event.clientX);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setFromClientX(event.clientX);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onCommit?.(value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || available <= 0) return;
    const keys: Record<string, number> = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: step * 2,
      PageDown: -step * 2,
    };
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      markFirstTouch();
      onChange(event.key === "End" ? available : 0);
      return;
    }
    const delta = keys[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    markFirstTouch();
    onChange(snap(Math.min(available, Math.max(0, value + delta)), available, step));
  };

  const ticks = useMemo(() => {
    const count = available > 0 ? Math.min(16, Math.round(available / step)) : 0;
    return Array.from({ length: count + 1 }, (_, i) => i / Math.max(1, count));
  }, [available, step]);

  return (
    <div className="select-none">
      {/* Available to Bridge */}
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Available to Bridge
        </p>
        <p className="mt-1 font-display text-2xl font-extrabold tracking-tight text-available tnum">
          {naira(available)}
        </p>
      </div>

      {/* The bridge — the whole block is a generous, one-handed touch target */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Bridge Gauge — choose how much of your earned pay to bridge"
        aria-valuemin={0}
        aria-valuemax={available}
        aria-valuenow={value}
        aria-valuetext={`${naira(value)} of ${naira(available)}`}
        aria-orientation="horizontal"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyUp={() => onCommit?.(value)}
        onKeyDown={onKeyDown}
        className={cn(
          "relative mt-3 w-full touch-none rounded-3xl py-2 outline-none",
          disabled ? "cursor-not-allowed opacity-60" : dragging ? "cursor-grabbing" : "cursor-grab",
          "focus-visible:ring-2 focus-visible:ring-primary/60",
        )}
      >
        <div className="relative">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full" aria-hidden>
            <BridgeDefs />
            <BridgeStructure fraction={fraction} instant={dragging} />

            {/* snap ticks */}
            {ticks.map((t, i) => (
              <line
                key={i}
                x1={deckX(t)}
                y1={BASE_Y}
                x2={deckX(t)}
                y2={BASE_Y + (i % 2 === 0 ? 5 : 3)}
                stroke={t <= fraction ? "hsl(var(--primary))" : "hsl(var(--border))"}
                strokeWidth="1"
                strokeLinecap="round"
              />
            ))}

            {/* the beacon */}
            <g
              style={{
                transform: `translate(${handleX}px, ${handleY}px) scale(${dragging ? 1.14 : 1})`,
                transition: dragging
                  ? "transform 120ms ease-out"
                  : "transform 380ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <ellipse
                cx="0"
                cy="6"
                rx={dragging ? 13 : 9}
                ry={dragging ? 4 : 2.6}
                fill="hsl(var(--foreground))"
                opacity={dragging ? 0.16 : 0.09}
                style={{ transition: "all 160ms ease-out" }}
              />
              <circle
                r={dragging ? 30 : 22}
                fill="url(#pb-beacon-glow)"
                opacity={dragging ? 1 : 0.75}
                style={{ transition: "all 160ms ease-out" }}
              />
              <g filter={dragging ? "url(#pb-beacon-shadow-lifted)" : "url(#pb-beacon-shadow)"}>
                <line x1="0" y1="0" x2="0" y2="-19" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
                <path
                  d="M 0 -30 L 5.5 -24 L 0 -18 L -5.5 -24 Z"
                  fill="hsl(var(--foreground))"
                  stroke="hsl(var(--background))"
                  strokeWidth="0.75"
                />
                <circle r="10" fill="hsl(var(--card))" stroke="hsl(var(--foreground))" strokeWidth="2.5" />
                <circle r="3.5" fill="hsl(var(--available))" />
              </g>
            </g>
          </svg>

          {/* amount chip that rides with the beacon while dragging */}
          <AnimatePresence>
            {dragging && value > 0 ? (
              <MDiv
                initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-250%" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-300%" }}
                exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-300%" }}
                transition={{ duration: 0.16 }}
                style={{ left: chip.left, top: chip.top }}
                className="pointer-events-none absolute rounded-full bg-foreground px-3 py-1 font-display text-sm font-bold text-background shadow-lg tnum"
              >
                {naira(value)}
              </MDiv>
            ) : null}
          </AnimatePresence>
        </div>

        {/* end labels */}
        <div className="mt-1 flex items-start justify-between px-1">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Today
            </p>
            <p className="text-xs font-semibold text-foreground">Earned so far</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Payday
            </p>
            <p className="text-xs font-semibold text-foreground tnum">{shortDate(payday)}</p>
          </div>
        </div>
      </div>

      {/* Selected amount */}
      <div className="mt-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Selected Amount
        </p>
        <p className="mt-1 font-display text-[2.6rem] font-extrabold leading-none tracking-tight text-foreground tnum">
          {naira(animatedValue)}
        </p>
        <div className="mt-2 min-h-[2.5rem]">
          <AnimatePresence mode="wait">
            <MDiv
              key={message}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22 }}
              className="mx-auto max-w-[22rem] text-sm font-medium text-muted-foreground"
            >
              {message}
            </MDiv>
          </AnimatePresence>
        </div>
      </div>

      {/* Live breakdown — the amount you receive is never reduced by the fee. */}
      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border/70 text-center sm:grid-cols-4">
        <div className="bg-secondary/40 px-2 py-3">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            You receive today
          </dt>
          <dd className="mt-1 font-display text-sm font-bold text-primary tnum">
            {naira(animatedReceive)}
          </dd>
        </div>
        <div className="bg-secondary/40 px-2 py-3">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Service fee
          </dt>
          <dd className="mt-1 font-display text-sm font-bold text-foreground tnum">
            {naira(animatedFee)}
          </dd>
        </div>
        <div className="bg-secondary/40 px-2 py-3">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Payroll deduction
          </dt>
          <dd className="mt-1 font-display text-sm font-bold text-foreground tnum">
            {naira(animatedDeduction)}
          </dd>
        </div>
        <div className="bg-secondary/40 px-2 py-3">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Still available
          </dt>
          <dd className="mt-1 font-display text-sm font-bold text-available tnum">
            {naira(animatedRemaining)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {value > 0
          ? `You receive the full ${naira(value)}. The ${naira(fee)} service fee is settled from payroll on payday — never taken out of what reaches your account.`
          : "You always receive the full amount you choose. The service fee is settled from payroll on payday, never deducted from your transfer."}
      </p>
      <p className="mt-1.5 text-center text-xs text-muted-foreground/80">
        Drag the beacon along the bridge. Amounts move in {naira(step)} steps.
      </p>
    </div>
  );
}
