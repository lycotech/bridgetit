import { useEffect, useId, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { naira } from "@/lib/platform/format";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";
import { ListenButton } from "@/components/prefs/ListenButton";

/**
 * Four ways to choose the same number.
 *
 * WHY FOUR. The Bridge Gauge is the product's signature and it stays exactly as
 * it is — but a drag along a curve is the single least accessible input there is.
 * It fails somebody using one hand, somebody with a tremor, somebody whose
 * dexterity varies through the day, somebody on a cracked touchscreen, and
 * anybody navigating by keyboard or switch. WCAG 2.5.7 puts it plainly: any
 * dragging action needs a single-pointer alternative.
 *
 * So the same amount can be set by: dragging the beacon, typing the figure,
 * pressing plus or minus, or tapping a preset. None is the "accessible version"
 * of the others; they are the same control with four doors, and the typed field
 * is the one that can express ₦12,340 when the steps cannot.
 *
 * THE ANNOUNCEMENT is debounced. A live region updated on every pixel of a drag
 * produces a screen reader stuttering numbers nobody can follow — so it settles
 * for half a second, then says the amount, the fee and the payday total once.
 *
 * The fee is quoted here and never subtracted from the figure being chosen.
 */

/**
 * The smallest sensible bridge. Below this the ₦100 minimum fee is more than a
 * tenth of the amount, which is a bad deal we should not let somebody walk into
 * by mistyping.
 */
export const MIN_BRIDGE = 1_000;

/** Presets, smallest first, filtered against what the person actually has. */
function presetsFor(available: number, step: number): number[] {
  const candidates = [step, step * 2, step * 4, Math.round(available / 2 / step) * step];
  return Array.from(new Set(candidates))
    .filter((amount) => amount >= MIN_BRIDGE && amount < available)
    .sort((a, b) => a - b)
    .slice(0, 3);
}

export function BridgeAmountControl({
  available,
  value,
  onChange,
  step,
  fee,
  onInteract,
}: {
  available: number;
  value: number;
  onChange: (value: number) => void;
  step: number;
  /** Fee for the CURRENT value, computed by the caller. Quoted, never deducted. */
  fee: number;
  onInteract?: () => void;
}) {
  const { t } = usePreferences();
  const id = useId();
  const [raw, setRaw] = useState(value > 0 ? String(value) : "");
  const [announcement, setAnnouncement] = useState("");
  const editing = useRef(false);

  /* The slider and the presets also change `value`, so the field follows it —
     except while it is being typed into, where overwriting somebody mid-number
     is the classic way a controlled money input becomes unusable. */
  useEffect(() => {
    if (editing.current) return;
    setRaw(value > 0 ? String(value) : "");
  }, [value]);

  /* One settled announcement, not one per keystroke or per pixel. */
  useEffect(() => {
    if (value <= 0) {
      setAnnouncement("");
      return;
    }
    const timer = window.setTimeout(() => {
      setAnnouncement(
        t("bridge.selected_announcement", {
          amount: naira(value),
          fee: naira(fee),
          total: naira(value + fee),
        }),
      );
    }, 550);
    return () => window.clearTimeout(timer);
  }, [value, fee, t]);

  const commit = (next: number) => {
    onInteract?.();
    onChange(Math.min(available, Math.max(0, next)));
  };

  const tooMuch = value > available;
  const tooLittle = value > 0 && value < MIN_BRIDGE;
  const error = tooMuch
    ? t("bridge.too_much", { max: naira(available) })
    : tooLittle
      ? t("bridge.too_little", { min: naira(MIN_BRIDGE) })
      : null;

  const presets = presetsFor(available, step);
  const stepButton =
    "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-foreground transition-colors hover:border-primary/50 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]";

  return (
    <div className="mt-5 rounded-2xl border border-border bg-secondary/20 p-4">
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {t("bridge.amount_label")}
      </label>
      <p id={`${id}-hint`} className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t("bridge.amount_hint", { max: naira(available) })}
      </p>

      <div className="mt-3 flex items-stretch gap-2">
        {/* Minus and plus are the whole point of WCAG 2.5.7: the same change the
            drag makes, available to a single tap. 56px, so they are reachable
            with a thumb and hittable with an unsteady hand. */}
        <button
          type="button"
          onClick={() => commit(Math.max(0, value - step))}
          disabled={value <= 0}
          aria-label={t("bridge.decrease", { step: naira(step) })}
          className={stepButton}
        >
          <Minus className="h-5 w-5" aria-hidden />
        </button>

        <div className="relative min-w-0 flex-1">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-display text-lg font-bold text-muted-foreground"
          >
            ₦
          </span>
          <input
            id={id}
            // `inputMode="numeric"` gives a phone the number pad without the
            // spinner arrows and locale headaches of `type="number"`.
            inputMode="numeric"
            autoComplete="off"
            value={raw ? Number(raw).toLocaleString("en-NG") : ""}
            placeholder="0"
            aria-describedby={error ? `${id}-error` : `${id}-hint`}
            aria-invalid={error ? true : undefined}
            onFocus={() => {
              editing.current = true;
            }}
            onBlur={() => {
              editing.current = false;
              setRaw(value > 0 ? String(value) : "");
            }}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").slice(0, 9);
              setRaw(digits);
              commit(digits ? Number(digits) : 0);
            }}
            className={cn(
              "h-14 w-full rounded-2xl border bg-card pl-9 pr-3 font-display text-xl font-extrabold text-foreground tnum",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]",
              error ? "border-destructive/70" : "border-border",
            )}
          />
        </div>

        <button
          type="button"
          onClick={() => commit(Math.min(available, value + step))}
          disabled={value >= available}
          aria-label={t("bridge.increase", { step: naira(step) })}
          className={stepButton}
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {error ? (
        // role="alert": this appeared because of something just typed, so it is
        // announced rather than left to be discovered.
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => commit(amount)}
            aria-pressed={value === amount}
            aria-label={t("bridge.preset", { amount: naira(amount) })}
            className={cn(
              // 44px minimum, not a 24px chip. A preset nobody can hit is not a
              // simpler option (WCAG 2.5.8).
              "inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]",
              value === amount
                ? "border-primary/60 bg-primary/12 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {naira(amount)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => commit(available)}
          aria-pressed={value === available}
          className={cn(
            "inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]",
            value === available
              ? "border-primary/60 bg-primary/12 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          {t("bridge.max")}
        </button>
      </div>

      {value > 0 ? (
        <ListenButton
          className="mt-3"
          text={t("bridge.selected_announcement", {
            amount: naira(value),
            fee: naira(fee),
            total: naira(value + fee),
          })}
        />
      ) : null}

      {/* The settled announcement. Polite and off-screen: it exists for the
          person who cannot see the number change, and interrupts nobody. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
