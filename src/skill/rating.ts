import { RANK_TIERS, type RankTier } from '../types';

// Skill estimation is an Elo-like rating. Each question is treated as an
// "opponent" whose strength is derived from its 0..1 difficulty. Answering a
// hard question correctly moves the rating more than an easy one; missing an
// easy question costs more. Ratings are tracked separately per mode.

export const RATING_MIN = 0;
export const RATING_MAX = 3600;
export const START_RATING = 600;

/** Map a 0..1 question difficulty onto the rating scale (its "opponent" rating). */
export function difficultyToRating(difficulty: number): number {
  return RATING_MIN + difficulty * (RATING_MAX - RATING_MIN);
}

/** Expected score (win probability) for the player vs an opponent rating. */
function expectedScore(player: number, opponent: number): number {
  return 1 / (1 + Math.pow(10, (opponent - player) / 400));
}

export interface RatingUpdate {
  next: number;
  delta: number;
}

/**
 * Update a rating after one attempt.
 * K scales the volatility; correct=true => score 1, else 0.
 */
export function updateRating(current: number, difficulty: number, correct: boolean, k = 48): RatingUpdate {
  return updateRatingScore(current, difficulty, correct ? 1 : 0, k);
}

/**
 * Elo update with a continuous score in [0,1] (used by drawing mode, whose
 * 4-level self evaluation maps to partial scores rather than a hard win/loss).
 */
export function updateRatingScore(current: number, difficulty: number, score: number, k = 48): RatingUpdate {
  const opponent = difficultyToRating(difficulty);
  const expected = expectedScore(current, opponent);
  const clamped = Math.max(0, Math.min(1, score));
  const next = clamp(current + k * (clamped - expected), RATING_MIN, RATING_MAX);
  return { next, delta: next - current };
}

// Rank bands: evenly spaced across the rating range, one band per tier.
const BAND = (RATING_MAX - RATING_MIN) / RANK_TIERS.length;

export function ratingToRank(rating: number): RankTier {
  const idx = Math.min(RANK_TIERS.length - 1, Math.floor((rating - RATING_MIN) / BAND));
  return RANK_TIERS[Math.max(0, idx)];
}

/** Progress 0..1 toward the next tier (for a progress bar). */
export function rankProgress(rating: number): number {
  const within = (rating - RATING_MIN) % BAND;
  return clamp(within / BAND, 0, 1);
}

export function nextRank(rank: RankTier): RankTier | null {
  const i = RANK_TIERS.indexOf(rank);
  return i >= 0 && i < RANK_TIERS.length - 1 ? RANK_TIERS[i + 1] : null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Drawing mode has no objective grade, only a 4-level self evaluation
// (0 = よくできた .. 3 = すごくできなかった). Map it to a pseudo score so the
// same Elo machinery drives a separate drawing-mode rank.
export const SELF_EVAL_LABELS = [
  'よくできた',
  'まぁまぁできた',
  'あまりできなかった',
  'すごくできなかった',
] as const;

/** Map a self-evaluation (0=best .. 3=worst) to a continuous Elo score [0,1]. */
export function selfRatingScore(selfRating: number): number {
  return [1.0, 0.7, 0.35, 0.0][selfRating] ?? 0.5;
}

/** Whether a self-evaluation counts as a "success" for accuracy stats. */
export function selfRatingIsSuccess(selfRating: number): boolean {
  return selfRating <= 1;
}
