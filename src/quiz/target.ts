import {
  COLD_THRESHOLD,
  HOT_THRESHOLD,
  RATING_MAX,
  hasRecentSignal,
  type RecentPerf,
} from '../skill/rating';

// Difficulty targeting for motivation: aim for ~68% success (a miss every 3–4
// questions). In Elo terms that means the "opponent" sits a bit below the
// player's rating. Only when recent results clearly diverge do we serve the
// asymmetric (harder-when-underrated / easier-when-overrated) questions that
// let the rating converge quickly.

/** Rating gap (opponent − player) that yields success probability p. */
function offsetForP(p: number): number {
  return 400 * Math.log10((1 - p) / p);
}

const NORMAL_OFFSET = offsetForP(0.68); // ≈ −131 (target band 60–75%)
const UNDERRATED_OFFSET = offsetForP(0.35); // doing great → serve much harder (≈ +107) to climb fast
const OVERRATED_OFFSET = offsetForP(0.85); // struggling → serve easier (≈ −301)
const JITTER = 0.025; // small, so we stay inside the band (avoid extreme easy/hard)

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Choose a target difficulty (0..1) for the next question from the current
 * rating and recent performance, clamped by the settings ceiling.
 */
export function pickTarget(rating: number, ceiling: number, recent?: RecentPerf): number {
  let offset = NORMAL_OFFSET;
  if (recent && hasRecentSignal(recent)) {
    if (recent.successRate > HOT_THRESHOLD) offset = UNDERRATED_OFFSET;
    else if (recent.successRate < COLD_THRESHOLD) offset = OVERRATED_OFFSET;
  }
  const base = clamp01((rating + offset) / RATING_MAX);
  const jitter = (Math.random() * 2 - 1) * JITTER;
  return Math.min(ceiling, Math.max(0.05, base + jitter));
}
