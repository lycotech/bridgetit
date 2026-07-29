import { useId } from "react";
import { cn } from "@/lib/utils";
import { TAGLINE_LOCKUP, TEAL, TEAL_DEEP } from "@/lib/brand";
import { ARC_PATH, MARK, METRICS, TAGLINE, UPRIGHTS, VIEW_BOX, WORDMARK } from "./logo-art";

/**
 * The PayBridge logo, exactly as drawn in the identity.
 *
 * The lockup is one SVG rather than a mark sitting next to some text, because
 * the mark does not sit next to the text: the bridge frame lands *on top of*
 * the bold "Bridge", its span starting at the "B" and its three uprights coming
 * down onto the word. That relationship is the logo. Splitting it into a flex
 * row of separate elements loses it the moment a font or a font-size changes.
 *
 * The geometry in ./logo-art.ts is traced from the original artwork and the
 * wordmark is stored as outlines, so the lockup is identical everywhere — no
 * webfont to wait for, nothing that reflows.
 *
 * Colour: the span starts in the literal brand teal at the foot, where it meets
 * the P, and warms as it crosses — deep teal, emerald, then gold at the far
 * tip. That is the tagline drawn instead of written: from payroll to prosperity,
 * left bank to right. The gold end is the `--gold` token rather than #D6B166 so
 * it darkens to bronze on warm white, where the raw gold is 2:1 and vanishes.
 * The teals stay literal — the near half of the mark never shifts shade.
 *
 * The P is the one letter that carries colour, because it is the abutment the
 * span springs from. It uses `--primary` for the same readability reason as the
 * gold: a letter of the company name has to be legible on paper as well as on
 * ink. Everything else is currentColor, so the lockup still inverts whole.
 */
function BridgeFrame({
  monochrome = false,
  warmTip = false,
  path = ARC_PATH,
  uprights = UPRIGHTS,
  span = METRICS.span,
}: {
  monochrome?: boolean;
  /**
   * Gold at the far end. On for the lockup, off for the compact mark: the
   * mark is a monogram, not a journey, and at 16px a third stop is a smudge.
   */
  warmTip?: boolean;
  /** Geometry override — the standalone mark uses its own shorter seating. */
  path?: string;
  uprights?: readonly { x: number; y: number; w: number; h: number }[];
  span?: { from: number; to: number };
}) {
  // Scoped per instance: several logos can share a page without colliding ids.
  const gradId = `pb-span-${useId()}`;
  return (
    <>
      {monochrome ? null : (
        <defs>
          <linearGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            x1={span.from}
            y1={0}
            x2={span.to}
            y2={0}
          >
            <stop offset="0%" stopColor={TEAL_DEEP} />
            <stop offset={warmTip ? "56%" : "100%"} stopColor={TEAL} />
            {warmTip ? <stop offset="100%" stopColor="hsl(var(--gold))" /> : null}
          </linearGradient>
        </defs>
      )}
      <path d={path} fill={monochrome ? "currentColor" : `url(#${gradId})`} />
      <g fill="currentColor">
        {uprights.map((u) => (
          <rect key={u.x} x={u.x} y={u.y} width={u.w} height={u.h} rx={u.w / 3} />
        ))}
      </g>
    </>
  );
}

/**
 * The bridge frame on its own — favicons, avatars, loading states, and any
 * place too tight for 476 units of wordmark.
 *
 * This is the same curve as the lockup's, seated short and high. The lockup's
 * span crosses a whole wordmark, so it is seven times wider than it is tall;
 * dropped into a square that is a horizon line, not a logo. The compact cut is
 * roughly 3.6:1 and still has a crown to read at 16px.
 */
export function LogoMark({
  className,
  monochrome = false,
}: {
  className?: string;
  monochrome?: boolean;
}) {
  return (
    <svg
      viewBox={VIEW_BOX.mark}
      fill="none"
      role="img"
      aria-label="PayBridge"
      className={cn("h-5 w-auto", className)}
    >
      <BridgeFrame
        monochrome={monochrome}
        path={MARK.path}
        uprights={MARK.uprights}
        span={MARK.span}
      />
    </svg>
  );
}

/**
 * The name, drawn: a teal P then the rest in currentColor. One shared piece so
 * the lockup and the standalone wordmark can never drift apart.
 */
function WordmarkPaths({ monochrome = false }: { monochrome?: boolean }) {
  if (monochrome) {
    return (
      <g fill="currentColor">
        <path d={WORDMARK.pay} />
        <path d={WORDMARK.bridge} />
      </g>
    );
  }
  return (
    <>
      <path d={WORDMARK.p} fill="hsl(var(--primary))" />
      <g fill="currentColor">
        <path d={WORDMARK.ay} />
        <path d={WORDMARK.bridge} />
      </g>
    </>
  );
}

/** The wordmark without the frame. Reference material; rarely the right choice. */
export function Wordmark({ className, monochrome = false }: { className?: string; monochrome?: boolean }) {
  return (
    <svg
      viewBox={VIEW_BOX.wordmark}
      fill="none"
      role="img"
      aria-label="PayBridge"
      className={cn("h-6 w-auto", className)}
    >
      <WordmarkPaths monochrome={monochrome} />
    </svg>
  );
}

/**
 * The lockup. Size it with a height class — `h-8` in a header, `h-16` for the
 * primary lockup — and the width follows.
 *
 * `withTagline` adds the rule-and-caps line beneath, which is the primary
 * lockup from the brand sheet. Headers use the plain form: at 32px tall the
 * tagline would set at 3px and read as dirt.
 */
export function Logo({
  className,
  showWordmark = true,
  withTagline = false,
  monochrome = false,
}: {
  className?: string;
  showWordmark?: boolean;
  withTagline?: boolean;
  monochrome?: boolean;
}) {
  if (!showWordmark) return <LogoMark className={className} monochrome={monochrome} />;

  return (
    <svg
      viewBox={withTagline ? VIEW_BOX.taglineLockup : VIEW_BOX.lockup}
      fill="none"
      role="img"
      aria-label={withTagline ? `PayBridge — ${TAGLINE_LOCKUP}` : "PayBridge"}
      className={cn("h-8 w-auto", className)}
    >
      <WordmarkPaths monochrome={monochrome} />
      <BridgeFrame monochrome={monochrome} warmTip />
      {withTagline ? (
        <>
          <path d={TAGLINE.path} fill="currentColor" fillOpacity={0.88} />
          {/* The near rule is teal, the far one gold — "from payroll to
              prosperity" said in colour, at the size of a hyphen. The gold
              is a token so it darkens to bronze when the lockup sits on
              white, where #D6B166 would disappear. */}
          {TAGLINE.rules.map((r, i) => (
            <rect
              key={r.x}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              fill={
                monochrome
                  ? "currentColor"
                  : i === TAGLINE.rules.length - 1
                    ? "hsl(var(--gold))"
                    : TEAL
              }
            />
          ))}
        </>
      ) : null}
    </svg>
  );
}
