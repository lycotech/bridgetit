import { useEffect, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { MDiv } from "@/lib/motion";
import { naira } from "@/lib/platform/format";
import { BridgeDefs, BridgeStructure } from "./BridgeArt";
import { VIEW_H, VIEW_W, deckX, deckY } from "./geometry";

/** Drives 0 → 1 over a duration; snaps to 1 when motion is reduced. */
function useProgress(durationMs: number, onDone?: () => void): number {
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (reduce) {
      setProgress(1);
      if (!doneRef.current) {
        doneRef.current = true;
        const timer = setTimeout(() => onDone?.(), 400);
        return () => clearTimeout(timer);
      }
      return;
    }
    let raf = 0;
    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const value = Math.min(1, (ts - start) / durationMs);
      setProgress(value);
      if (value < 1) {
        raf = requestAnimationFrame(step);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, onDone, reduce]);

  return progress;
}

/** Eases the traveller so it sets off gently and arrives gently. */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function BridgeFrame({ fraction, children }: { fraction: number; children?: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full" aria-hidden>
      <BridgeDefs />
      <BridgeStructure fraction={fraction} sweep />
      {children}
    </svg>
  );
}

/** The amount travelling across the bridge, between the gauge and Review. */
export function BridgeJourney({ amount, onComplete }: { amount: number; onComplete: () => void }) {
  const raw = useProgress(1700, onComplete);
  const progress = easeInOut(raw);
  const arrived = raw >= 0.98;

  return (
    <div className="py-2">
      <BridgeFrame fraction={progress}>
        <g
          style={{
            transform: `translate(${deckX(progress)}px, ${deckY(progress)}px) scale(${arrived ? 1.15 : 1})`,
            transition: "transform 260ms ease-out",
          }}
        >
          <circle r="20" fill="url(#pb-beacon-glow)" />
          <g filter="url(#pb-beacon-shadow)">
            <circle r="9" fill="hsl(var(--card))" stroke="hsl(var(--foreground))" strokeWidth="2.5" />
            <circle r="3" fill="hsl(var(--available))" />
          </g>
        </g>
      </BridgeFrame>

      <div className="mt-1 text-center">
        <p className="font-display text-3xl font-extrabold tracking-tight text-foreground tnum">
          {naira(amount)}
        </p>
        <div className="mt-2 min-h-[1.25rem]">
          <AnimatePresence mode="wait">
            <MDiv
              key={arrived ? "ready" : "building"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-medium text-muted-foreground"
            >
              {arrived ? "Ready for you to review." : "Building your bridge…"}
            </MDiv>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/** Light travelling across a completed bridge on the success screen. */
export function BridgeComplete({ onSettled }: { onSettled?: () => void }) {
  const progress = useProgress(1500, onSettled);
  return <BridgeFrame fraction={easeInOut(progress)} />;
}
