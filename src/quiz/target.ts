import { RATING_MAX } from '../skill/rating';

/**
 * Choose a target difficulty (0..1) for the next question from the current
 * rating, with a little jitter for variety, clamped by the settings ceiling.
 * Shared by both quiz modes so adaptivity behaves consistently.
 */
export function pickTarget(rating: number, ceiling: number): number {
  const base = Math.min(1, Math.max(0, rating / RATING_MAX));
  const jitter = Math.random() * 0.24 - 0.12;
  return Math.min(ceiling, Math.max(0.05, base + jitter));
}
