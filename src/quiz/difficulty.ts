import type { RotationStep } from '../types';

// A 0..1 difficulty estimate. Difficulty rises with: more rotation axes, using
// local (object-frame) rotation, larger / less "clean" angles, and distractors
// that sit visually close to the correct answer.

export interface DifficultyInput {
  steps: RotationStep[];
  /** smallest angular gap (radians) between the correct answer and any distractor */
  minDistractorAngleRad?: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function difficultyOf({ steps, minDistractorAngleRad }: DifficultyInput): number {
  const axisCount = new Set(steps.map((s) => s.axis)).size;
  const usesLocal = steps.some((s) => s.type === 'local');
  const totalAngle = steps.reduce((sum, s) => sum + Math.abs(s.angleDeg), 0);
  const oddAngles = steps.some((s) => Math.abs(s.angleDeg) % 90 !== 0);

  const axisFactor = (axisCount - 1) / 2; // 0, .5, 1
  const typeFactor = usesLocal ? 0.18 : 0;
  const angleFactor = clamp01(totalAngle / 360) * 0.4 + (oddAngles ? 0.15 : 0);
  // closer distractors => harder to discriminate
  const closeness =
    minDistractorAngleRad === undefined ? 0 : clamp01(1 - minDistractorAngleRad / (Math.PI / 2)) * 0.4;

  const raw = axisFactor * 0.35 + typeFactor + angleFactor * 0.5 + closeness;
  return clamp01(raw);
}

/** Coarse metadata about a step list, stored on each attempt for analysis. */
export function stepStats(steps: RotationStep[]): {
  axisCount: number;
  totalAngle: number;
  rotationType: 'global' | 'local';
} {
  const axisCount = new Set(steps.map((s) => s.axis)).size;
  const totalAngle = steps.reduce((sum, s) => sum + Math.abs(s.angleDeg), 0);
  // classify by the dominant type; "local" if any local step present
  const rotationType = steps.some((s) => s.type === 'local') ? 'local' : 'global';
  return { axisCount, totalAngle, rotationType };
}
