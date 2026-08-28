/**
 * Rebuilds the PayBridge identity from the original artwork.
 *
 * WHY this exists: the logo is not a re-drawing of the brand sheet, it *is* the
 * brand sheet. The bridge arc and its three uprights are traced out of
 * public/brand-logo-new.jpg at sub-pixel precision, the wordmark is set from the
 * real Inter outlines, and the two are locked together in one coordinate space
 * so the frame always lands on top of the bold "Bridge" — no font loading, no
 * runtime measurement, nothing to drift.
 *
 * Outputs
 *   src/components/brand/logo-art.ts   the vector data every component draws
 *   public/*.png | favicon.svg         icons, avatar and OG cards, same source
 *
 *   cd webapp && node scripts/build-brand.mjs
 */
import sharp from "sharp";
import opentype from "opentype.js";
import { writeFile, readFile, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

/* Navy + two-tone teal + gold, sampled from the brand reference. Kept in
   step with src/lib/brand.ts and the CSS tokens in src/index.css. */
const NAVY = "#091320";        // navy ink — the ground
const TEAL = "#22B490";        // emerald teal — the span
const TEAL_DEEP = "#13725A";   // deep teal — the weight
const TEAL_BRIGHT = "#21DEAF"; // bright teal — outcome
const GOLD = "#D6B166";        // gold — the far bank
const OFF_WHITE = "#F8F6F2";

/* The light-ground cuts of the two accents. In the app these are the --primary
   and --gold tokens, which drop in lightness under .theme-light; a static PNG
   has no tokens, so the same two values are written out here. #D6B166 on paper
   is 2:1, and a brand colour that cannot be read is not a brand colour. */
const TEAL_ON_LIGHT = "#147B61"; // --primary  165 72% 28%
const GOLD_ON_LIGHT = "#8B6524"; // --gold      38 60% 34%

/* ── 1. Fonts ─────────────────────────────────────────────────────────────
   Pinned static instances of Inter v20. Cached outside git: the generated
   outlines are committed, so a later run is only needed if the wordmark
   itself changes. */
const FONTS = {
  light: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuOKfMZg.ttf",
  medium: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf",
  semibold: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf",
  extrabold: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuDyYMZg.ttf",
};

async function loadFonts() {
  await mkdir(here("./.fonts"), { recursive: true });
  const out = {};
  for (const [name, url] of Object.entries(FONTS)) {
    const file = here(`./.fonts/Inter-${name}.ttf`);
    try {
      await access(file);
    } catch {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Cannot fetch Inter ${name}: ${res.status}`);
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
    }
    const buf = await readFile(file);
    // opentype.parse wants a real ArrayBuffer slice, not the Node view.
    out[name] = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return out;
}

/* ── 2. Trace the artwork ────────────────────────────────────────────────
   Everything is measured against ink coverage rather than a hard threshold,
   so the numbers survive the JPEG's antialiasing. */
const REGION = { left: 200, top: 110, width: 700, height: 290 };

async function traceArtwork() {
  const { data, info } = await sharp(here("../public/brand-logo-new.jpg"))
    .extract(REGION)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, channels: C } = info;
  const at = (x, y) => {
    const i = (y * W + x) * C;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const isBlue = (x, y) => {
    const [r, , b] = at(x, y);
    return b > 110 && b - r > 50;
  };
  /** Ink coverage 0..1 against the white page, read off the red channel. */
  const cover = (x, y, inkR) => Math.max(0, Math.min(1, (255 - at(x, y)[0]) / (255 - inkR)));
  const blueCover = (x, y) => (isBlue(x, y) ? cover(x, y, 26) : 0);
  const navyCover = (x, y) => (isBlue(x, y) ? 0 : cover(x, y, 11));

  /** Sub-pixel first/last crossing of 50% coverage down a column. */
  const span = (samples, y0) => {
    const i = samples.findIndex((v) => v > 0.5);
    if (i < 0) return null;
    const j = samples.length - 1 - [...samples].reverse().findIndex((v) => v > 0.5);
    return [y0 + i - (samples[i - 1] ?? 0), y0 + j + (samples[j + 1] ?? 0)];
  };
  const columnSpan = (x, y0, y1, ink) => {
    const s = [];
    for (let y = y0; y < y1; y++) s.push(ink(x, y));
    return span(s, y0);
  };

  // Wordmark ink box and the cap/baseline the whole identity is measured in.
  const inkBox = (x0, x1, y0, y1) => {
    let a = Infinity, b = -Infinity;
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        if (navyCover(x, y) > 0.45) { if (x < a) a = x; if (x > b) b = x; break; }
    return [a, b];
  };
  const payInk = inkBox(0, 232, 88, 230);
  const bridgeInk = inkBox(233, 690, 88, 230);
  const [capTop, baseline] = columnSpan(bridgeInk[0] + 2, 80, 210, navyCover);

  // The arc: one sub-pixel top and bottom edge per column.
  const arcCols = [];
  for (let x = 220; x <= 500; x++) {
    const s = columnSpan(x, 10, 130, blueCover);
    if (s && s[1] - s[0] > 0 && s[1] - s[0] < 30) arcCols.push([x, s[0], s[1]]);
  }

  // The three uprights, sitting between the arc and the cap line.
  const uprights = [];
  {
    const row = [];
    for (let x = bridgeInk[0] + 80; x <= bridgeInk[0] + 190; x++) row.push([x, navyCover(x, 60)]);
    let run = null;
    for (const [x, v] of row) {
      if (v > 0.5 && !run) run = { x0: x, x1: x };
      else if (v > 0.5) run.x1 = x;
      else if (run) { uprights.push(run); run = null; }
    }
  }
  const bars = uprights.map((r) => {
    const cx = (r.x0 + r.x1) / 2;
    const [top, bot] = columnSpan(Math.round(cx), 30, 100, navyCover);
    let w = 0;
    for (let x = r.x0 - 2; x <= r.x1 + 2; x++) w += navyCover(x, 60);
    return { cx, w, top, bot };
  });

  // Tagline: two rules flanking letterspaced caps.
  const ruleXs = [];
  for (let x = 0; x < W; x++) {
    let hit = false;
    for (let y = 235; y < 270; y++) if (isBlue(x, y)) hit = true;
    if (hit) ruleXs.push(x);
  }
  const ruleGroups = [];
  let cur = [ruleXs[0]];
  for (let i = 1; i < ruleXs.length; i++) {
    if (ruleXs[i] - ruleXs[i - 1] > 3) { ruleGroups.push([cur[0], cur.at(-1)]); cur = []; }
    cur.push(ruleXs[i]);
  }
  ruleGroups.push([cur[0], cur.at(-1)]);
  const ruleRows = [];
  for (let y = 235; y < 270; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) if (isBlue(x, y)) n++;
    if (n > 5) ruleRows.push(y);
  }
  const tagInk = inkBox(70, 630, 238, 268);
  let tagTop = Infinity, tagBottom = -Infinity;
  for (let y = 230; y < 275; y++)
    for (let x = tagInk[0]; x <= tagInk[1]; x++)
      if (navyCover(x, y) > 0.45) { if (y < tagTop) tagTop = y; if (y > tagBottom) tagBottom = y; }

  return {
    payInk, bridgeInk, capTop, baseline, arcCols, bars,
    rules: ruleGroups,
    ruleY: (ruleRows[0] + ruleRows.at(-1) + 1) / 2,
    ruleH: ruleRows.length,
    tagline: { x: tagInk, top: tagTop, baseline: tagBottom + 1 },
  };
}

/* ── 3. Curves ───────────────────────────────────────────────────────────── */

/** Centripetal Catmull-Rom through the traced edge, emitted as cubics. */
function smoothPath(points, close) {
  const p = points;
  const seg = (i) => p[Math.max(0, Math.min(p.length - 1, i))];
  let d = `M${fmt(p[0][0])} ${fmt(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = seg(i - 1), p1 = seg(i), p2 = seg(i + 1), p3 = seg(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return close ? `${d}Z` : d;
}

const fmt = (n) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

/** 3-point mean: takes the JPEG's edge jitter out before sampling. */
const smoothSeries = (v) => v.map((x, i, a) => (a[Math.max(0, i - 1)] + x + a[Math.min(a.length - 1, i + 1)]) / 3);

/** Even sampling that always keeps both ends. */
function sample(arr, step) {
  const out = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  if (out.at(-1) !== arr.at(-1)) out.push(arr.at(-1));
  return out;
}

/* ── 4. Type ─────────────────────────────────────────────────────────────── */

/** Lays out a string glyph by glyph — Inter's GSUB is more than we need. */
function typeset(font, text, size, tracking, x0, y0) {
  const scale = size / font.unitsPerEm;
  const path = new opentype.Path();
  let x = x0;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    path.commands.push(...g.getPath(x, y0, size).commands);
    x += g.advanceWidth * scale + tracking;
  }
  return { path, advance: x - x0 - tracking, box: path.getBoundingBox() };
}

const pathData = (p) => p.toPathData(2);

/* ── 5. Compose the lockup ───────────────────────────────────────────────── */

const art = await traceArtwork();
const fonts = await loadFonts();

const INTER_CAP = (fonts.light.tables.os2.sCapHeight / fonts.light.unitsPerEm) * 100;
const capPx = art.baseline - art.capTop;
const k = INTER_CAP / capPx; // artwork pixels → lockup units (font-size 100)

// Wordmark. A touch of negative tracking gives the identity's tight fit
// without pushing Inter's extrabold letters into each other.
const TRACKING = -1.5;
const payRaw = typeset(fonts.light, "Pay", 100, TRACKING, 0, 0);
const pay = typeset(fonts.light, "Pay", 100, TRACKING, -payRaw.box.x1, 0);

/*
 * "P" and "ay" are also emitted separately.
 *
 * WHY: in the artwork the P is the brand colour and the rest of the word is
 * navy — the P is the near abutment the span springs from, so it is the one
 * letter that belongs to the bridge rather than to the sentence. One path for
 * "Pay" cannot express that. Both are laid out at the same origin and tracking
 * as the combined path, so `p` + `ay` is `pay` to the unit.
 */
const payScale = 100 / fonts.light.unitsPerEm;
const pOnly = typeset(fonts.light, "P", 100, TRACKING, -payRaw.box.x1, 0);
const ayOnly = typeset(
  fonts.light,
  "ay",
  100,
  TRACKING,
  -payRaw.box.x1 + fonts.light.charToGlyph("P").advanceWidth * payScale + TRACKING,
  0,
);
const payRight = pay.box.x2;

// The gap between "Pay" and "Bridge", straight off the artwork.
const wordGap = (art.bridgeInk[0] - art.payInk[1]) * k;
const bridgeRaw = typeset(fonts.extrabold, "Bridge", 100, TRACKING, 0, 0);
const bridgeLeft = payRight + wordGap;
const bridge = typeset(fonts.extrabold, "Bridge", 100, TRACKING, bridgeLeft - bridgeRaw.box.x1, 0);
const bridgeBox = { x: bridge.box.x1, w: bridge.box.x2 - bridge.box.x1 };
const totalW = bridge.box.x2;

/* The arc and uprights are positioned against the *Bridge* ink box — that is
   the relationship the artwork encodes, and it is what keeps the frame over
   the bold word at any size. Vertically they are measured in cap heights, so
   the clearance above the letters is exactly as drawn. */
const artBridgeW = art.bridgeInk[1] - art.bridgeInk[0];
const ux = (xPx) => bridgeBox.x + ((xPx - art.bridgeInk[0]) / artBridgeW) * bridgeBox.w;
const uy = (yPx) => (yPx - art.baseline) * k;

const tops = smoothSeries(art.arcCols.map((c) => c[1]));
const bots = smoothSeries(art.arcCols.map((c) => c[2]));
const xs = art.arcCols.map((c) => c[0]);
const STEP = 12;

/* ── The crossing ─────────────────────────────────────────────────────────
   As drawn, the span crosses only the first two thirds of the word: it lands
   over the "d" and leaves "ge" standing in the open. At any real size that
   reads as a bridge that stopped short — the one thing this mark cannot say.
   So the same curve is re-seated to make the crossing it claims. Nothing is
   redrawn: the taper, the asymmetry and the heavy near bank are the traced
   ones, point for point. Only where they land changes.

     The near foot stays exactly where the artwork puts it, on the "y" of
     Pay, so the span still starts on the paying side. The tip now reaches
     the far edge of the "e". Payroll to prosperity, in the mark itself.

   WEIGHT exists because that is a 1.7x stretch: without it the curve thins
   to a wisp and disappears in a favicon. Thickness is scaled separately
   from the rise so the span can get longer without getting taller. */
/* In the artwork the uprights run down to the cap line. Inter's "i" tittle and
   "d" ascender both sit *above* that line, so stopping there would spear the
   dot on the "i". The deck instead rests a hair above the tallest ink in the
   word — same three bars, same tops, no collision. */
const deck = bridge.box.y1 - 1.2;

const drawnTop = xs.map((x, i) => [ux(x), uy(tops[i])]);
const drawnBot = xs.map((x, i) => [ux(x), uy(bots[i])]);
const spanFrom = drawnTop[0][0];
const drawnRise = deck - Math.min(...drawnTop.map((p) => p[1]));

/**
 * Re-seats the traced curve on a span of a given length and height, and hangs
 * the three uprights off its underside.
 *
 *   to      where the tip lands, in lockup units
 *   rise    crown height above the deck, in cap heights
 *   weight  thickness multiplier — applied independently of the rise, so a
 *           span can get longer without getting taller or thinner
 *   gap/w   the uprights, also in cap heights
 */
function seatSpan({ from = spanFrom, to, rise, weight, gap, w, footDrop = 0 }) {
  const drawnLength = drawnTop.at(-1)[0] - spanFrom;
  const kSpan = (to - from) / drawnLength;
  const kRise = (rise * INTER_CAP) / drawnRise;
  const seated = drawnTop.map((_, i) => {
    const x = from + (drawnTop[i][0] - spanFrom) * kSpan;
    /*
     * `footDrop` lets the near end settle BELOW the deck, so the span can land
     * on the cap of the "P" instead of floating above the lowercase letters.
     * It decays as the square of the distance along the span, which means the
     * foot meets its abutment and the crown is left exactly where `rise` put
     * it — the drop is a landing, not a tilt.
     */
    const t = (drawnTop[i][0] - spanFrom) / drawnLength;
    const drop = footDrop * INTER_CAP * (1 - t) ** 2;
    const mid = deck + drop + ((drawnTop[i][1] + drawnBot[i][1]) / 2 - deck) * kRise;
    const half = ((drawnBot[i][1] - drawnTop[i][1]) * weight) / 2;
    return [[x, mid - half], [x, mid + half]];
  });
  const top = sample(seated.map((p) => p[0]), STEP);
  const bot = sample(seated.map((p) => p[1]), STEP).reverse();

  const underside = (x) => {
    for (let i = 1; i < seated.length; i++) {
      const [x0, y0] = seated[i - 1][1];
      const [x1, y1] = seated[i][1];
      if (x >= x0 && x <= x1 && x0 !== x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
    return deck - 1;
  };
  const crownX = seated.reduce((a, p) => (p[0][1] < a[1] ? p[0] : a), seated[0][0])[0];
  const barW = w * INTER_CAP;
  const bars = [-1, 0, 1].map((n) => {
    const x = crownX + n * gap * INTER_CAP;
    const y = underside(x);
    return { x: fmt(x - barW / 2), y: fmt(y), w: fmt(barW), h: fmt(deck - y) };
  });

  return {
    path: smoothPath(top.concat(bot), true),
    bars,
    from,
    to,
    crown: Math.min(...top.map((p) => p[1])),
    foot: Math.max(...bars.map((b) => b.y + b.h)),
  };
}

/* ── The crossing ─────────────────────────────────────────────────────────
   As drawn, the span crosses only the first two thirds of the word: it lands
   over the "d" and leaves "ge" standing in the open. At any real size that
   reads as a bridge that stopped short — the one thing this mark cannot say.
   So the same curve is re-seated to make the crossing it claims. Nothing is
   redrawn: the taper, the asymmetry and the heavy near bank are the traced
   ones, point for point. Only where they land changes.

     The near foot lands on the CAP OF THE "P" and the tip reaches the far
     edge of the "e". Payroll to prosperity, in the mark itself.

   WHY the P and not the "y" it was seated on before: an abutment needs
   ground. Sprung from the "y" the span began in mid-air over two lowercase
   letters, and at small sizes the near foot read as a stray blob resting on
   nothing. The P is the only full-height letter on the paying side, so it is
   the only thing in the word that can carry a bridge — which is exactly what
   the reference artwork does. `footDrop` is what lets the foot reach it.

   The 2.7x stretch that follows (429 units of span against the 315 drawn)
   is why `weight` climbs with it: thickness is scaled independently of rise,
   so a longer span does not thin to a wisp or grow into an arch. */
const SPAN = seatSpan({
  from: pOnly.box.x2 - 0.02 * INTER_CAP,
  to: totalW,
  rise: 0.5,
  weight: 2.05,
  gap: 0.55,
  w: 0.066,
  footDrop: 0.1,
});
const ARC = SPAN.path;
const UPRIGHTS = SPAN.bars;

/* The same curve, seated short and high, for anywhere the mark stands alone.
   A crossing that reaches across a whole wordmark is 7 times wider than it is
   tall; dropped into a square tile it is a horizon line, not a logo. The icon
   therefore keeps the drawing and changes only its span — a compact dome at
   roughly 3.5:1 that still has a crown to read at 16px. */
const MARK = seatSpan({ to: spanFrom + 2.24 * INTER_CAP, rise: 0.62, weight: 2.0, gap: 0.3, w: 0.052 });

// Tagline: outlined so the rule/text/rule rhythm can never reflow.
const tagCap = art.tagline.baseline - art.tagline.top;
const tagSize = (tagCap * k) / (INTER_CAP / 100);
const TAGLINE_TEXT = "FROM PAYROLL TO PROSPERITY";
const tagTargetW = ((art.tagline.x[1] - art.tagline.x[0]) / (art.payInk[1] - art.payInk[0] + (art.bridgeInk[1] - art.bridgeInk[0]) + (art.bridgeInk[0] - art.payInk[1]))) * totalW;
const tagNatural = typeset(fonts.semibold, TAGLINE_TEXT, tagSize, 0, 0, 0);
const tagTracking = (tagTargetW - (tagNatural.box.x2 - tagNatural.box.x1)) / (TAGLINE_TEXT.length - 1);
const tagRaw = typeset(fonts.semibold, TAGLINE_TEXT, tagSize, tagTracking, 0, 0);
const tagBaselineY = (art.tagline.baseline - art.baseline) * k;
const tagX = ((art.tagline.x[0] - art.payInk[0]) / (art.bridgeInk[1] - art.payInk[0])) * totalW;
const tagline = typeset(fonts.semibold, TAGLINE_TEXT, tagSize, tagTracking, tagX - tagRaw.box.x1, tagBaselineY);

const wordSpanPx = art.bridgeInk[1] - art.payInk[0];
const RULES = art.rules.map(([a, b]) => ({
  x: fmt(((a - art.payInk[0]) / wordSpanPx) * totalW),
  y: fmt((art.ruleY - art.baseline) * k - (art.ruleH * k) / 2),
  w: fmt(((b - a + 1) / wordSpanPx) * totalW),
  h: fmt(art.ruleH * k),
}));

// View boxes, with a hair of optical padding.
const arcTop = SPAN.crown;
const inkTop = Math.min(arcTop, bridge.box.y1);
const inkBottom = Math.max(pay.box.y2, bridge.box.y2);
const box = (x, y, w, h) => `${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)}`;
const VIEW = {
  lockup: box(0, inkTop, totalW, inkBottom - inkTop),
  wordmark: box(0, bridge.box.y1, totalW, inkBottom - bridge.box.y1),
  /* The far rule overhangs the wordmark by a unit and a half, so the tagline
     lockup is measured to the rules rather than to the word — otherwise the
     gold tip is sliced off at the right edge. */
  taglineLockup: box(
    0,
    inkTop,
    Math.max(totalW, ...RULES.map((r) => Number(r.x) + Number(r.w))),
    tagline.box.y2 - inkTop,
  ),
  mark: box(MARK.from, MARK.crown, MARK.to - MARK.from, MARK.foot - MARK.crown),
};

/* ── 6. Emit the art module ──────────────────────────────────────────────── */

const ts = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Traced from public/brand-logo-new.jpg and set in Inter by
 * scripts/build-brand.mjs. Regenerate with:
 *
 *   cd webapp && node scripts/build-brand.mjs
 *
 * Coordinate space: the wordmark is typeset at font-size 100 with its ink left
 * edge at x=0 and its baseline at y=0, so every number below is directly
 * comparable to a cap height of ${fmt(INTER_CAP)}. The arc and uprights were measured
 * against the "Bridge" ink box in the original artwork and re-projected onto
 * this one, which is why the frame sits over the bold word at every size.
 */

/** SVG viewBox strings for each lockup variant. */
export const VIEW_BOX = {
  /** Wordmark + bridge frame. */
  lockup: "${VIEW.lockup}",
  /** Wordmark on its own. */
  wordmark: "${VIEW.wordmark}",
  /** Wordmark + bridge frame + tagline rule. */
  taglineLockup: "${VIEW.taglineLockup}",
  /** The bridge frame on its own, cropped tight. */
  mark: "${VIEW.mark}",
} as const;

/** Outlines, so the lockup never waits on — or shifts with — a webfont. */
export const WORDMARK = {
  /** "Pay" whole. Use when the word is one colour. */
  pay: "${pathData(pay.path)}",
  /**
   * The P alone — the abutment the span springs from, and the one letter that
   * carries brand colour in the artwork. Identical geometry to the first glyph
   * of \`pay\`, so the two forms are interchangeable.
   */
  p: "${pathData(pOnly.path)}",
  /** "ay" alone, to pair with \`p\`. */
  ay: "${pathData(ayOnly.path)}",
  bridge: "${pathData(bridge.path)}",
} as const;

/** The span, traced edge by edge from the artwork. */
export const ARC_PATH = "${ARC}";

/** The three uprights, in draw order left to right. */
export const UPRIGHTS = ${JSON.stringify(UPRIGHTS)} as const;

/**
 * The mark on its own — same curve, seated short and high.
 *
 * The lockup's span crosses a whole wordmark, so it is seven times wider than
 * it is tall. In a square tile that is a horizon line. This is the compact
 * cut, roughly 3.5:1, which still has a crown at 16px.
 */
export const MARK = {
  path: "${MARK.path}",
  uprights: ${JSON.stringify(MARK.bars)},
  span: { from: ${fmt(MARK.from)}, to: ${fmt(MARK.to)} },
} as const;

/** Tagline lockup: two rules flanking letterspaced caps. */
export const TAGLINE = {
  path: "${pathData(tagline.path)}",
  rules: ${JSON.stringify(RULES)},
} as const;

/** Everything a caller might need to place the lockup in another layout. */
export const METRICS = {
  /** Full ink width of the wordmark. */
  width: ${fmt(totalW)},
  /** Cap height, in the same units. */
  cap: ${fmt(INTER_CAP)},
  /** Ink box of the bold "Bridge" the frame is anchored to. */
  bridge: { x: ${fmt(bridgeBox.x)}, width: ${fmt(bridgeBox.w)} },
  /** Highest point of the arc (negative = above the baseline). */
  arcTop: ${fmt(arcTop)},
  /** Where the span starts and ends, for locking a gradient to the crossing. */
  span: { from: ${fmt(SPAN.from)}, to: ${fmt(SPAN.to)} },
  /** Ratio of lockup height to width, frame and wordmark only. */
  aspect: ${fmt((inkBottom - inkTop) / totalW)},
  /** Same, including the tagline rule. */
  taglineAspect: ${fmt((tagline.box.y2 - inkTop) / totalW)},
} as const;
`;
await writeFile(here("../src/components/brand/logo-art.ts"), ts);

/* ── 7. Raster assets, drawn from the very same geometry ─────────────────── */

const upRects = (bars, boldFactor = 1) =>
  bars.map((u) => {
    const w = u.w * boldFactor;
    return `<rect x="${fmt(u.x - (w - u.w) / 2)}" y="${u.y}" width="${fmt(w)}" height="${u.h}" rx="${fmt(w / 3)}"/>`;
  }).join("");

/* The span is filled with the two teals rather than one, deep at the near
   foot and emerald at the tip. It is the same colour at two depths, so the
   mark still reads as one teal object — it just stops looking flat. Locked
   to the span's own coordinates, so the icon's shorter cut gets the whole
   ramp rather than a slice of it.

   `tip` adds a third stop in gold, which turns the two depths into a crossing:
   deep teal where the span meets the P, emerald over the middle, gold as it
   lands. That is the tagline drawn rather than written. It goes on the full
   lockup only — the icon cuts are a monogram, and at 16px a third stop is a
   smudge. */
const spanGrad = (id, from, to, s = SPAN, tip = null) => `
  <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fmt(s.from)}" y1="0" x2="${fmt(s.to)}" y2="0">
    <stop offset="0%" stop-color="${from}"/><stop offset="${tip ? "56%" : "100%"}" stop-color="${to}"/>${
      tip ? `<stop offset="100%" stop-color="${tip}"/>` : ""
    }
  </linearGradient>`;

const markSvg = (boldFactor, uprightFill, arcFill = "url(#span)") =>
  `<path d="${ARC}" fill="${arcFill}"/><g fill="${uprightFill}">${upRects(UPRIGHTS, boldFactor)}</g>`;

/* The tagline rules are the one place gold enters the identity: the near rule
   is teal, the far one gold. Two flat marks, no blend — "from payroll to
   prosperity" stated in colour, at the size of a hyphen. */
const ruleFill = (i, tip = GOLD) => (i === RULES.length - 1 ? tip : TEAL);

/* `accent` colours the P, the abutment the span springs from and the one letter
   that carries brand colour. Pass null for a single-plate cut, where the whole
   lockup has to survive one ink. */
const lockupSvg = (fill, withTagline, accent = null, tip = GOLD) => `
  ${WORD_PATHS(fill, accent)}
  ${markSvg(1, fill)}
  ${withTagline ? `<path d="${pathData(tagline.path)}" fill="${fill}" fill-opacity="0.9"/>${RULES.map((r, i) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${ruleFill(i, tip)}"/>`).join("")}` : ""}`;
function WORD_PATHS(fill, accent = null) {
  const name = accent
    ? `<path d="${pathData(pOnly.path)}" fill="${accent}"/><path d="${pathData(ayOnly.path)}" fill="${fill}"/>`
    : `<path d="${pathData(pay.path)}" fill="${fill}"/>`;
  return `${name}<path d="${pathData(bridge.path)}" fill="${fill}"/>`;
}

/* App icons take the compact cut of the mark and let it overflow the tile.
 *
 * Even at 3.5:1 the dome fitted whole into a square would float in a sea of
 * white, so the icon is drawn ~1.25x wider than the tile and centred on the
 * middle upright: the crown fills the width and the tapered ends run off both
 * edges, which is what a bridge does.
 *
 * Colour follows the brand sheet: teal span, navy uprights, light ground.
 * Teal on white survives a 16px tab strip; teal on navy does not. Gold
 * stays out of the icon — it never enters the mark.
 */
const [mx, my, mw, mh] = VIEW.mark.split(" ").map(Number);
const MID_UPRIGHT = MARK.bars[1].x + MARK.bars[1].w / 2;
const markIn48 = (overflow, uprightFill, arcFill, bold) => {
  const scale = (48 * overflow) / mw;
  const tx = 24 - MID_UPRIGHT * scale;
  const ty = 24 - (my + mh / 2) * scale;
  const inner = `<path d="${MARK.path}" fill="${arcFill}"/><g fill="${uprightFill}">${upRects(MARK.bars, bold)}</g>`;
  return `<g transform="translate(${fmt(tx)},${fmt(ty)}) scale(${fmt(scale)})">${inner}</g>`;
};
const markGrad = (id, from, to) => spanGrad(id, from, to, MARK);

const iconSvg = (size, radiusRatio = 11 / 48) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}">
  <defs>
    <clipPath id="tile"><rect width="48" height="48" rx="${fmt(48 * radiusRatio)}"/></clipPath>
    ${markGrad("span", TEAL_DEEP, TEAL)}
  </defs>
  <g clip-path="url(#tile)">
    <rect width="48" height="48" fill="${OFF_WHITE}"/>
    ${markIn48(1.25, NAVY, "url(#span)", 1.6)}
  </g>
  <rect x="0.5" y="0.5" width="47" height="47" rx="${fmt(48 * radiusRatio - 0.5)}" fill="none" stroke="${NAVY}" stroke-opacity="0.1"/>
</svg>`;

/* Maskable icon: the same crop as the tile, but full bleed and unrounded so
   Android can cut its own shape out of it. A maskable icon with transparent
   corners gets those corners rendered, which is why this cannot just be
   iconSvg again. The uprights sit well inside the 80% safe circle; only the
   tapered ends of the span fall outside it, which is where they belong. */
const maskableSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}">
  <defs>${markGrad("span", TEAL_DEEP, TEAL)}</defs>
  <rect width="48" height="48" fill="${OFF_WHITE}"/>
  ${markIn48(1.25, NAVY, "url(#span)", 1.6)}
</svg>`;

/** Circular social avatar: navy ground, so it holds its own in a feed. */
const avatarSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}">
  <defs>
    <clipPath id="disc"><circle cx="24" cy="24" r="24"/></clipPath>
    ${markGrad("span", TEAL, "#5FE9C4")}
  </defs>
  <g clip-path="url(#disc)">
    <circle cx="24" cy="24" r="24" fill="${NAVY}"/>
    ${markIn48(1.18, OFF_WHITE, "url(#span)", 1.6)}
  </g>
</svg>`;

/** 1200x630 Open Graph card — the primary lockup on navy. */
const ogSvg = () => {
  const targetW = 720;
  const s = targetW / totalW;
  const x = (1200 - targetW) / 2;
  const y = 322;
  const strap = typeset(fonts.medium, "You work every day. Why wait until payday?", 30, 0, 0, 0);
  const strapX = (1200 - (strap.box.x2 - strap.box.x1)) / 2 - strap.box.x1;
  const strapPath = typeset(fonts.medium, "You work every day. Why wait until payday?", 30, 0, strapX, 528);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="#050C15"/>
    </linearGradient>
    <radialGradient id="glow" cx="46%" cy="32%" r="46%">
      <stop offset="0%" stop-color="${TEAL}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="${TEAL}" stop-opacity="0"/>
    </radialGradient>
    <!-- The gold stays a corner, not a wash: pushed to 88/90 with a tighter
         radius so it lights the far bank of the card and lets the navy hold
         the middle, where the wordmark has to read. -->
    <radialGradient id="glowg" cx="88%" cy="90%" r="40%">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <!-- The payroll-to-prosperity ramp, run edge to edge along the foot of
         the card. It is the one place the two poles appear together at
         full strength, which is what makes the gold read as a decision
         rather than a stray tint. -->
    <linearGradient id="ramp" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${TEAL_DEEP}" stop-opacity="0"/>
      <stop offset="16%" stop-color="${TEAL_DEEP}"/>
      <stop offset="46%" stop-color="${TEAL}"/>
      <stop offset="66%" stop-color="${TEAL_BRIGHT}"/>
      <stop offset="86%" stop-color="${GOLD}"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </linearGradient>
    ${spanGrad("span", "#2FC7A0", "#7FE9CE", SPAN, GOLD)}
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#glowg)"/>
  <g transform="translate(${fmt(x)},${y}) scale(${fmt(s)})">${lockupSvg(OFF_WHITE, true, "#2FC7A0")}</g>
  <path d="${pathData(strapPath.path)}" fill="#9FB2C2"/>
  <rect x="0" y="624" width="1200" height="6" fill="url(#ramp)"/>
</svg>`;
};

const png = (svg, file, width) =>
  sharp(Buffer.from(svg)).resize({ width }).png().toFile(here(`../public/${file}`));

/**
 * favicon.ico, hand-assembled around a single 32px PNG.
 *
 * Every browser since Vista reads a PNG payload inside an ICO container, and
 * the container is 22 bytes of header — cheaper than a dependency, and it
 * keeps the .ico in step with the rest of the set instead of quietly ageing
 * into the previous logo.
 */
const ico = async (svg, size = 32) => {
  const body = await sharp(Buffer.from(svg)).resize({ width: size }).png().toBuffer();
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); // reserved
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(1, 4); // one image
  head.writeUInt8(size % 256, 6); // width  (0 means 256)
  head.writeUInt8(size % 256, 7); // height
  head.writeUInt8(0, 8); // palette size: none
  head.writeUInt8(0, 9); // reserved
  head.writeUInt16LE(1, 10); // colour planes
  head.writeUInt16LE(32, 12); // bits per pixel
  head.writeUInt32LE(body.length, 14);
  head.writeUInt32LE(22, 18); // payload offset
  await writeFile(here("../public/favicon.ico"), Buffer.concat([head, body]));
};

/** Installable-app metadata, so a home-screen PayBridge is navy and not white. */
const manifest = {
  name: "PayBridge",
  short_name: "PayBridge",
  description: "Financial wellbeing, built around work.",
  start_url: "/",
  display: "standalone",
  background_color: NAVY,
  theme_color: NAVY,
  icons: [
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  ],
};

/* ── The download pack ────────────────────────────────────────────────────
 *
 * Everything above is built for the product: favicons, tiles, share cards.
 * None of it is a file you can hand to a printer, a bank onboarding form or
 * a conference organiser. This is that file — the lockup on its own, with
 * proper clear space, in the four combinations anyone ever actually asks for
 * (on light, on dark, and transparent in each ink).
 *
 * Clear space is half a cap height on every side, which is the usual rule and
 * happens to be what the mark needs: less and the span's tapered tip touches
 * whatever is beside it.
 */
const PAD = INTER_CAP * 0.5;

const packSvg = ({ withTagline, ink, ground, accent = null, tip = null }) => {
  const [vx, vy, vw, vh] = (withTagline ? VIEW.taglineLockup : VIEW.lockup)
    .split(" ")
    .map(Number);
  const w = vw + PAD * 2;
  const h = vh + PAD * 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(vx - PAD)} ${fmt(vy - PAD)} ${fmt(w)} ${fmt(h)}">
  <defs>${spanGrad("span", TEAL_DEEP, TEAL, SPAN, tip)}</defs>
  ${ground ? `<rect x="${fmt(vx - PAD)}" y="${fmt(vy - PAD)}" width="${fmt(w)}" height="${fmt(h)}" fill="${ground}"/>` : ""}
  ${lockupSvg(ink, withTagline, accent, tip ?? GOLD)}
</svg>`;
};

/** The mark alone, padded, transparent — for stamps, watermarks and avatars. */
const packMarkSvg = (uprightInk) => {
  const [vx, vy, vw, vh] = VIEW.mark.split(" ").map(Number);
  const p = INTER_CAP * 0.28;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(vx - p)} ${fmt(vy - p)} ${fmt(vw + p * 2)} ${fmt(vh + p * 2)}">
  <defs>${markGrad("span", TEAL_DEEP, TEAL)}</defs>
  <path d="${MARK.path}" fill="url(#span)"/>
  <g fill="${uprightInk}">${upRects(MARK.bars, 1)}</g>
</svg>`;
};

/* 2400px wide is enough for a full-bleed slide or an A4 letterhead at 300dpi,
   and still small enough to email. The SVG beside each one is the real master. */
const PACK_W = 2400;
/* Which cut of the accents each variant gets. A navy-ink lockup is going onto
   something pale whether or not this file paints the ground, and a white-ink one
   is going onto something dark, so the accents follow the ink. */
const ON_LIGHT = { accent: TEAL_ON_LIGHT, tip: GOLD_ON_LIGHT };
const ON_DARK = { accent: TEAL, tip: GOLD };

const PACK = [
  ["paybridge-logo-tagline-on-light", packSvg({ withTagline: true, ink: NAVY, ground: OFF_WHITE, ...ON_LIGHT })],
  ["paybridge-logo-tagline-on-dark", packSvg({ withTagline: true, ink: OFF_WHITE, ground: NAVY, ...ON_DARK })],
  ["paybridge-logo-tagline-navy", packSvg({ withTagline: true, ink: NAVY, ground: null, ...ON_LIGHT })],
  ["paybridge-logo-tagline-white", packSvg({ withTagline: true, ink: OFF_WHITE, ground: null, ...ON_DARK })],
  ["paybridge-logo-on-light", packSvg({ withTagline: false, ink: NAVY, ground: OFF_WHITE, ...ON_LIGHT })],
  ["paybridge-logo-on-dark", packSvg({ withTagline: false, ink: OFF_WHITE, ground: NAVY, ...ON_DARK })],
  ["paybridge-logo-navy", packSvg({ withTagline: false, ink: NAVY, ground: null, ...ON_LIGHT })],
  ["paybridge-logo-white", packSvg({ withTagline: false, ink: OFF_WHITE, ground: null, ...ON_DARK })],
  ["paybridge-mark-navy", packMarkSvg(NAVY)],
  ["paybridge-mark-white", packMarkSvg(OFF_WHITE)],
];

await mkdir(here("../public/brand"), { recursive: true });
for (const [name, svg] of PACK) {
  await writeFile(here(`../public/brand/${name}.svg`), `${svg.trim()}\n`);
  await sharp(Buffer.from(svg))
    .resize({ width: name.startsWith("paybridge-mark") ? 1200 : PACK_W })
    .png()
    .toFile(here(`../public/brand/${name}.png`));
}

await writeFile(here("../public/favicon.svg"), `${iconSvg(48).trim()}\n`);
await writeFile(here("../public/site.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`);
await ico(iconSvg(512));
await png(iconSvg(512), "favicon-32.png", 32);
await png(iconSvg(512, 12 / 48), "apple-touch-icon.png", 180);
await png(iconSvg(512), "icon-512.png", 512);
await png(maskableSvg(512), "icon-maskable-512.png", 512);
await png(avatarSvg(512), "social-avatar.png", 512);
await png(ogSvg(), "og-paybridge.png", 1200);
await png(ogSvg(), "og-base.png", 1200);

console.log(`Wordmark width ${fmt(totalW)}, cap ${fmt(INTER_CAP)}, arc top ${fmt(arcTop)}`);
console.log(`Bridge ink x ${fmt(bridgeBox.x)} w ${fmt(bridgeBox.w)} · uprights`, UPRIGHTS.map((u) => u.x));
console.log("Brand art + raster assets rebuilt.");
