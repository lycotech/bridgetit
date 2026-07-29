import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Eases toward a moving target. Used for the Bridge Gauge's live figures so the
 * numbers count rather than jump as the handle is dragged.
 */
export function useAnimatedNumber(target: number, durationMs = 420): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduce) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;

    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min(1, (ts - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (target - from) * eased);
      fromRef.current = next;
      setValue(next);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs, reduce]);

  return value;
}
