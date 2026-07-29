import { Pause, Play, Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";
import { useSpeech } from "@/lib/prefs/useSpeech";

/**
 * The Listen button that sits next to money information.
 *
 * WHO IT IS FOR: someone who reads slowly, or not at all, or not in this
 * language, or cannot see the screen well and does not run a screen reader —
 * which on a shared Android phone in Nigeria is the common case, not the edge
 * case. Screen-reader users already have their own voice and do not need this.
 *
 * THREE CONTROLS, ALWAYS: start, pause, stop. Speech with no stop button traps
 * somebody in a paragraph they did not want; speech with no pause makes them
 * start over to catch one figure they missed (WCAG 1.4.2, which requires a
 * mechanism to pause or stop any audio lasting more than three seconds).
 *
 * It appears only when the person has asked for it in
 * "How should PayBridge work for you?" — an unexplained speaker icon next to a
 * balance is clutter for everyone who did not ask, and a hazard for anyone
 * holding the phone in a room where a balance should not be read out.
 */
export function ListenButton({
  /** What to read. Pass the plain words, in the same language as the screen. */
  text,
  /** Show even when read-aloud is off — used by the onboarding question. */
  always = false,
  className,
  size = "default",
}: {
  text: string;
  always?: boolean;
  className?: string;
  size?: "default" | "sm";
}) {
  const { prefs, t } = usePreferences();
  const { state, available, speak, pause, resume, stop } = useSpeech();

  if (!prefs.readAloud && !always) return null;

  if (!available) {
    // Say why the button is missing rather than leaving a gap. Somebody who
    // switched this on in settings is looking for it.
    return (
      <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>{t("listen.unsupported")}</p>
    );
  }

  const idle = state === "idle";
  const paused = state === "paused";

  // 44px minimum in both directions, at every size (WCAG 2.5.8).
  const button =
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => (idle ? speak(text) : paused ? resume() : pause())}
        aria-label={idle ? t("listen.label") : undefined}
        className={cn(button, "border-primary/45 bg-primary/10 text-primary hover:bg-primary/15")}
      >
        {idle ? (
          <Volume2 className={icon} aria-hidden />
        ) : paused ? (
          <Play className={icon} aria-hidden />
        ) : (
          <Pause className={icon} aria-hidden />
        )}
        {/* The word changes with the state, so the state is never carried by the
            icon shape alone. */}
        {idle ? t("listen.listen") : paused ? t("listen.resume") : t("listen.pause")}
      </button>

      {idle ? null : (
        <button
          type="button"
          onClick={stop}
          className={cn(button, "border-border bg-secondary/40 text-foreground hover:bg-secondary")}
        >
          <Square className={icon} aria-hidden />
          {t("listen.stop")}
        </button>
      )}

      {/* Polite, so it never interrupts a screen reader mid-sentence. */}
      <span className="sr-only" role="status">
        {state === "speaking" ? t("listen.reading") : ""}
      </span>
    </div>
  );
}
