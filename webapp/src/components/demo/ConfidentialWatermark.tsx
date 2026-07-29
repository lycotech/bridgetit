/**
 * Discreet, unmissable-on-a-screenshot watermark for the private demo.
 *
 * WHY it is drawn over the whole viewport rather than placed in a corner: the
 * risk is not someone reading the page, it is a screenshot of one screen being
 * forwarded without context. A tiled mark survives cropping.
 *
 * It is `pointer-events-none` and `aria-hidden`, so it changes nothing about
 * how the demo is used or how a screen reader announces it.
 */
const LINE_ONE = "Confidential PayBridge Demonstration";
const LINE_TWO = "Shared for evaluation only";

const TILE = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="240">
     <text x="0" y="120" transform="rotate(-24 0 120)"
           font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="600"
           fill="rgb(148 163 184)" fill-opacity="0.14">${LINE_ONE}</text>
     <text x="0" y="140" transform="rotate(-24 0 120)"
           font-family="ui-sans-serif, system-ui, sans-serif" font-size="13"
           fill="rgb(148 163 184)" fill-opacity="0.14">${LINE_TWO}</text>
   </svg>`.replace(/\s+/g, " "),
);

export function ConfidentialWatermark({ viewer }: { viewer?: string | null }) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] print:opacity-60"
        style={{ backgroundImage: `url("data:image/svg+xml,${TILE}")`, backgroundRepeat: "repeat" }}
      />
      {/* The same statement in text, for anyone who cannot see the tiling. */}
      <p className="sr-only">
        {LINE_ONE}. {LINE_TWO}.{viewer ? ` Access recorded for ${viewer}.` : ""}
      </p>
    </>
  );
}
