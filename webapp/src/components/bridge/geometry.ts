/** Shared bridge geometry so the gauge, journey and success art line up exactly. */

export const VIEW_W = 360;
export const VIEW_H = 176;
export const X0 = 30;
export const X1 = 330;
export const SPAN = X1 - X0;
export const DECK_Y = 120;
export const RISE = 46;
export const BASE_Y = 152;

/** Pylons clear the deck apex so the cable stays fan downward. */
export const TOWER_TOP = 32;
export const TOWER_LIGHT = 27;

/** Deck anchor points for the cable stays, measured from each pylon inward. */
export const STAYS = [0.1, 0.2, 0.31];

/** Bays braced under the deck. */
export const PIERS = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];

/**
 * A quadratic curve whose control point sits above the horizontal midpoint, so
 * x stays linear in t: x = X0 + t·SPAN, y = DECK_Y − 4·RISE·t(1−t).
 */
export const DECK_PATH = `M ${X0} ${DECK_Y} Q ${(X0 + X1) / 2} ${DECK_Y - 2 * RISE} ${X1} ${DECK_Y}`;

export function deckX(t: number): number {
  return X0 + t * SPAN;
}

export function deckY(t: number): number {
  return DECK_Y - 4 * RISE * t * (1 - t);
}
