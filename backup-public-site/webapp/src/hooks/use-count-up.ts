import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Animate a number from 0 to `target` once `active` becomes true.
 * Respects reduced-motion by snapping straight to the target.
 */
export function useCountUp(target: number, active: boolean, durationMs = 1400): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;

    if (reduce) {
      setValue(target);
      return;
    }

    let raf = 0;
    let startTs = 0;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const progress = Math.min(1, (ts - startTs) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, target, durationMs, reduce]);

  return value;
}

export function formatNaira(value: number): string {
  return "₦" + value.toLocaleString("en-NG");
}
