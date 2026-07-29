/**
 * PayBridge brand constants — the single source of truth for the identity.
 *
 * WHY hex values live here as well as in CSS tokens: tokens cover everything
 * rendered in the browser, but favicons, OG images, email and any exported
 * asset need the literal value. One list, quoted everywhere, so the teal in a
 * social card is the same teal as the button next to it.
 */

/**
 * Navy Ink — the ground the brand stands on.
 *
 * A cool, near-black navy rather than a tinted teal: it has to sit under both
 * poles of the palette without pulling either of them toward it.
 */
export const NAVY = "#091320";

/** Emerald Teal — the identity colour, and the lit tone of the bridge span. */
export const TEAL = "#22B490";

/** Deep Teal — the weight of the two-tone teal. Gradient anchors, dark blocks. */
export const TEAL_DEEP = "#13725A";

/** Bright Teal — outcome: settled, verified, cleared, available today. */
export const TEAL_BRIGHT = "#21DEAF";

/**
 * Gold — the far bank.
 *
 * The one warm hue in the system, and the reason a navy-and-teal palette does
 * not read as pure fintech infrastructure. It carries prosperity in the
 * marketing ramp and attention in the product (a shortfall, a flag, something
 * still building). It is a trim colour: never a surface, never a second brand.
 */
export const GOLD = "#D6B166";

/** Warm off-white used for reverse (on-navy) type and marks. */
export const OFF_WHITE = "#F8F6F2";

/**
 * The PayBridge tagline, exactly as it appears in the logo lockup.
 *
 * Stored in sentence case; the lockup uppercases it in CSS so the same string
 * can be used in body copy without shouting.
 */
export const TAGLINE = "From payroll to prosperity.";

/** Tagline without the full stop — for the letterspaced logo lockup. */
export const TAGLINE_LOCKUP = "From payroll to prosperity";
