import { useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { MPath } from "@/lib/motion";

/**
 * A calm monthly timeline: earnings accumulate day by day while payday waits
 * at the end of the month. A subtle PayBridge line connects a present need to
 * an approved portion of income already earned.
 */
export function MonthTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();

  // Cumulative earnings curve (rising). Points across a ~30 day month.
  const line = "M 40 200 C 140 195, 210 150, 300 130 S 470 95, 560 70 640 55 720 48";
  const todayX = 470;
  const todayY = 96;

  return (
    <div ref={ref} className="w-full">
      <svg viewBox="0 0 760 260" className="h-auto w-full" role="img" aria-label="Monthly earnings timeline">
        <defs>
          <linearGradient id="mt-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line x1="40" y1="220" x2="720" y2="220" stroke="hsl(var(--border))" strokeWidth="1.5" />

        {/* day ticks */}
        {Array.from({ length: 30 }).map((_, i) => {
          const x = 40 + (i * (680 / 29));
          return <line key={i} x1={x} y1="220" x2={x} y2={i % 5 === 0 ? 212 : 216} stroke="hsl(var(--border))" strokeWidth="1" />;
        })}

        {/* area fill under curve */}
        <path d={`${line} L 720 220 L 40 220 Z`} fill="url(#mt-fill)" opacity={inView ? 1 : 0} style={{ transition: "opacity 1s ease 0.4s" }} />

        {/* the earnings curve */}
        <MPath
          d={line}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={inView ? { pathLength: 1 } : {}}
          transition={{ duration: 1.6, ease: "easeInOut" }}
        />

        {/* PayBridge line: from today's need up to earned income */}
        <MPath
          d={`M ${todayX} 200 Q ${todayX - 30} 150, ${todayX} ${todayY}`}
          fill="none"
          stroke="hsl(var(--gold))"
          strokeWidth="2.5"
          strokeDasharray="4 5"
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0, opacity: 0 }}
          animate={inView ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 0.9, delay: 1.5, ease: "easeOut" }}
        />

        {/* today marker */}
        <circle cx={todayX} cy={todayY} r="7" fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth="2.5" />
        <text x={todayX} y="250" textAnchor="middle" fontSize="19" fontWeight="700" fill="hsl(var(--foreground))">
          Today
        </text>

        {/* need marker at baseline */}
        <circle cx={todayX} cy="200" r="4" fill="hsl(var(--gold))" />

        {/* payday flag */}
        <line x1="720" y1="48" x2="720" y2="220" stroke="hsl(var(--protected))" strokeWidth="2" strokeDasharray="3 4" />
        <circle cx="720" cy="48" r="6" fill="hsl(var(--protected))" />
        <text x="716" y="32" textAnchor="end" fontSize="19" fontWeight="700" fill="hsl(var(--foreground))">
          Payday
        </text>
      </svg>
    </div>
  );
}
