/**
 * Rasterises the current lockup exactly as the app draws it, so the logo can be
 * eyeballed against the artwork without a browser.
 *
 *   cd webapp && node scripts/preview-logo.mjs
 */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const art = await import(here("../src/components/brand/logo-art.ts"));

const NAVY = "#091320";
const TEAL = "#22B490";
const TEAL_DEEP = "#13725A";


const { VIEW_BOX, WORDMARK, ARC_PATH, UPRIGHTS, TAGLINE, METRICS } = art;

/* The light-theme resolutions of the two tokens the lockup uses. */
const PRIMARY_LIGHT = "#147B61"; // --primary  165 72% 28%
const GOLD_LIGHT = "#8B6524"; //    --gold     38 60% 34%

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX.taglineLockup}" width="1200" fill="none">
  <rect x="-40" y="-140" width="600" height="340" fill="#ffffff"/>
  <defs>
    <linearGradient id="span" gradientUnits="userSpaceOnUse" x1="${METRICS.span.from}" y1="0" x2="${METRICS.span.to}" y2="0">
      <stop offset="0%" stop-color="${TEAL_DEEP}"/>
      <stop offset="56%" stop-color="${TEAL}"/>
      <stop offset="100%" stop-color="${GOLD_LIGHT}"/>
    </linearGradient>
  </defs>
  <path d="${WORDMARK.p}" fill="${PRIMARY_LIGHT}"/>
  <g fill="${NAVY}">
    <path d="${WORDMARK.ay}"/><path d="${WORDMARK.bridge}"/>
  </g>
  <path d="${ARC_PATH}" fill="url(#span)"/>
  <g fill="${NAVY}">
    ${UPRIGHTS.map((u) => `<rect x="${u.x}" y="${u.y}" width="${u.w}" height="${u.h}" rx="${u.w / 3}"/>`).join("")}
  </g>
  <path d="${TAGLINE.path}" fill="${NAVY}" fill-opacity="0.88"/>
  ${TAGLINE.rules
    .map(
      (r, i) =>
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${i === TAGLINE.rules.length - 1 ? GOLD_LIGHT : TEAL}"/>`,
    )
    .join("")}
</svg>`;

await writeFile("/tmp/logo-current.svg", svg);
await sharp(Buffer.from(svg)).png().toFile("/tmp/logo-current.png");
console.log("wrote /tmp/logo-current.png");
