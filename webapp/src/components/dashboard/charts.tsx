import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AllocationSlice, SeriesPoint } from "@/lib/platform/models";
import { nairaCompact } from "@/lib/platform/format";
import { cn } from "@/lib/utils";

/** Chart colours resolve to the existing PayBridge tokens. */
const TONE_COLOR: Record<AllocationSlice["tone"], string> = {
  primary: "hsl(var(--primary))",
  available: "hsl(var(--available))",
  protected: "hsl(var(--protected))",
  gold: "hsl(var(--gold))",
  muted: "hsl(var(--muted-foreground) / 0.45)",
};

const axisStyle = { fontSize: 11, fill: "hsl(var(--muted-foreground))" } as const;

function TooltipShell({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; dataKey?: string | number }>;
  label?: string;
  format: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="mt-1 text-sm font-semibold text-foreground tnum">
          {format(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function TrendChart({
  data,
  height = 220,
  format = nairaCompact,
  tone = "primary",
}: {
  data: SeriesPoint[];
  height?: number;
  format?: (value: number) => string;
  tone?: "primary" | "available" | "protected";
}) {
  const color = TONE_COLOR[tone];
  const gradientId = `pb-grad-${tone}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisStyle} dy={6} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={axisStyle}
            width={54}
            tickFormatter={(value: number) => format(value)}
          />
          <Tooltip content={<TooltipShell format={format} />} cursor={{ stroke: "hsl(var(--border))" }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarSeries({
  data,
  height = 200,
  format = nairaCompact,
  tone = "primary",
}: {
  data: SeriesPoint[];
  height?: number;
  format?: (value: number) => string;
  tone?: "primary" | "available" | "protected";
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisStyle} dy={6} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={axisStyle}
            width={54}
            tickFormatter={(value: number) => format(value)}
          />
          <Tooltip content={<TooltipShell format={format} />} cursor={{ fill: "hsl(var(--secondary) / 0.5)" }} />
          <Bar dataKey="value" fill={TONE_COLOR[tone]} radius={[6, 6, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutSplit({
  slices,
  centerLabel,
  centerValue,
  height = 220,
  format = nairaCompact,
}: {
  slices: AllocationSlice[];
  centerLabel?: string;
  centerValue?: string;
  height?: number;
  format?: (value: number) => string;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div style={{ height, width: height }} className="relative mx-auto shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="66%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((slice, i) => (
                <Cell key={i} fill={TONE_COLOR[slice.tone]} />
              ))}
            </Pie>
            <Tooltip content={<TooltipShell format={format} />} />
          </PieChart>
        </ResponsiveContainer>
        {centerValue ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {centerLabel}
            </span>
            <span className="mt-1 font-display text-lg font-extrabold text-foreground tnum">{centerValue}</span>
          </div>
        ) : null}
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: TONE_COLOR[slice.tone] }}
                aria-hidden
              />
              <span className="truncate text-muted-foreground">{slice.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-foreground tnum">
              {format(slice.value)}
              <span className="ml-2 text-xs font-medium text-muted-foreground">
                {total ? Math.round((slice.value / total) * 100) : 0}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pill tabs used to filter charts (period, view). */
export function ChartTabs({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-full border border-border bg-secondary/50 p-1", className)}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
            value === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/** Convenience hook for chart period filters. */
export function useChartRange(options: readonly string[]) {
  const [value, setValue] = useState(options[options.length - 1]);
  return { value, setValue, options };
}

/** Trims a series to the selected period label (3M / 6M / 12M style). */
export function sliceSeries(data: SeriesPoint[], range: string): SeriesPoint[] {
  const months = range === "3M" ? 3 : range === "6M" ? 6 : data.length;
  return data.slice(Math.max(0, data.length - months));
}
