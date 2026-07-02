import * as THREE from 'three';
import { composeRotation, quaternionAngle } from '../three/rotation';
import type { Axis, DistractorCategory, ProblemRecord, RotationStep } from '../types';

// Shared model of the "tempting wrong answers": each error category can produce
// one or more poses from (steps, base). Used both to GENERATE distractors and to
// ATTRIBUTE a user's wrong pick probabilistically across compatible categories.

export type TemptCategory = 'sign' | 'axis' | 'magnitude' | 'globalLocalSwap' | 'offsetNeglect';
export const TEMPT_CATEGORIES: TemptCategory[] = [
  'sign',
  'axis',
  'magnitude',
  'globalLocalSwap',
  'offsetNeglect',
];

const AXES: Axis[] = ['x', 'y', 'z'];
const otherAxes = (a: Axis) => AXES.filter((x) => x !== a);
const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]): T => a[rand(a.length)];

// --- "snap to grid" (nearest of the 24 cube orientations) -------------------

let cubeCache: THREE.Quaternion[] | null = null;
function cubeOrientations(): THREE.Quaternion[] {
  if (cubeCache) return cubeCache;
  const out: THREE.Quaternion[] = [];
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 4; y++) {
      for (let z = 0; z < 4; z++) {
        const c = composeRotation([
          { axis: 'x', angleDeg: x * 90, type: 'global' },
          { axis: 'y', angleDeg: y * 90, type: 'global' },
          { axis: 'z', angleDeg: z * 90, type: 'global' },
        ]);
        if (!out.some((o) => quaternionAngle(o, c) < 0.01)) out.push(c);
      }
    }
  }
  cubeCache = out;
  return out;
}

/** The clean (axis-aligned) orientation closest to `q`. */
export function nearestGrid(q: THREE.Quaternion): THREE.Quaternion {
  let best = q;
  let bestDot = -1;
  for (const c of cubeOrientations()) {
    const d = Math.abs(c.dot(q));
    if (d > bestDot) {
      bestDot = d;
      best = c;
    }
  }
  return best.clone();
}

// --- category poses ---------------------------------------------------------

/** All poses a category could plausibly produce (for min-distance attribution). */
export function categoryRealizations(
  cat: TemptCategory,
  steps: RotationStep[],
  base: THREE.Quaternion,
): THREE.Quaternion[] {
  const out: THREE.Quaternion[] = [];
  const push = (mapped: RotationStep[], b = base) => out.push(composeRotation(mapped, b));

  switch (cat) {
    case 'sign':
      push(steps.map((s) => ({ ...s, angleDeg: -s.angleDeg }))); // flip all
      steps.forEach((_, i) =>
        push(steps.map((s, j) => (i === j ? { ...s, angleDeg: -s.angleDeg } : s))),
      );
      break;
    case 'axis':
      steps.forEach((_, i) =>
        otherAxes(steps[i].axis).forEach((ax) =>
          push(steps.map((s, j) => (i === j ? { ...s, axis: ax } : s))),
        ),
      );
      break;
    case 'magnitude':
      push(steps.map((s) => ({ ...s, angleDeg: s.angleDeg + (s.angleDeg >= 0 ? 45 : -45) })));
      push(steps.map((s) => ({ ...s, angleDeg: s.angleDeg - (s.angleDeg >= 0 ? 45 : -45) })));
      break;
    case 'globalLocalSwap':
      push(steps.map((s) => ({ ...s, type: s.type === 'global' ? 'local' : 'global' })));
      steps.forEach((_, i) =>
        push(
          steps.map((s, j) =>
            i === j ? { ...s, type: s.type === 'global' ? 'local' : 'global' } : s,
          ),
        ),
      );
      break;
    case 'offsetNeglect':
      push(steps, nearestGrid(base)); // apply the rotation as if the pose were clean
      break;
  }
  return out;
}

/** One representative pose for a category (used when generating a distractor). */
export function buildCandidatePose(
  cat: TemptCategory,
  steps: RotationStep[],
  base: THREE.Quaternion,
): THREE.Quaternion {
  const reals = categoryRealizations(cat, steps, base);
  return reals.length ? pick(reals) : composeRotation(steps, base);
}

// --- temptation weights (general priors, no personalisation yet) ------------

export interface QuestionFeatures {
  has90: boolean;
  hasGlobal: boolean;
  hasLocal: boolean;
  hasOffset: boolean;
  multiStep: boolean;
}

export function questionFeatures(steps: RotationStep[], hasOffset: boolean): QuestionFeatures {
  return {
    has90: steps.some((s) => Math.abs(s.angleDeg) % 90 === 0 && Math.abs(s.angleDeg) % 180 !== 0),
    hasGlobal: steps.some((s) => s.type === 'global'),
    hasLocal: steps.some((s) => s.type === 'local'),
    hasOffset,
    multiStep: steps.length > 1,
  };
}

/**
 * A per-user adjustment to temptation weights. `multiplier` returns how much
 * more (or less) than the general rule this user tends to fall for `cat` under
 * the given question features. The neutral model returns 1 everywhere.
 */
export interface PersonalModel {
  multiplier(cat: TemptCategory, feats: QuestionFeatures): number;
}

export const NEUTRAL_PERSONAL: PersonalModel = { multiplier: () => 1 };

/** General-rule temptation weight (0 = never offer). */
export function temptationWeight(cat: TemptCategory, f: QuestionFeatures): number {
  switch (cat) {
    case 'sign':
      return f.has90 ? 1.0 : 0.4; // direction slips happen most on 90°
    case 'axis':
      return f.hasGlobal ? 0.8 : 0.4; // global axis confusion
    case 'globalLocalSwap':
      return f.hasOffset || f.multiStep ? 0.9 : 0.3; // only clearly differs off-grid / multi-step
    case 'magnitude':
      return 0.5;
    case 'offsetNeglect':
      return f.hasOffset ? 0.9 : 0.0; // meaningful only when the pose is tilted
  }
}

// --- probabilistic attribution ----------------------------------------------

const TAU = THREE.MathUtils.degToRad(22); // softmax temperature over angular error

/**
 * Probability the wrong pick `chosenQ` reflects each error category, by softmax
 * over the (negative) min angular distance to each category's poses. Categories
 * that produce near-identical poses share the credit.
 */
export function attributeError(
  steps: RotationStep[],
  base: THREE.Quaternion,
  chosenQ: THREE.Quaternion,
): Record<TemptCategory, number> {
  const logits = TEMPT_CATEGORIES.map((cat) => {
    const reals = categoryRealizations(cat, steps, base);
    const minDist = reals.reduce((m, q) => Math.min(m, quaternionAngle(q, chosenQ)), Infinity);
    return -minDist / TAU;
  });
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  const out = {} as Record<TemptCategory, number>;
  TEMPT_CATEGORIES.forEach((cat, i) => {
    out[cat] = exps[i] / sum;
  });
  return out;
}

export const TEMPT_LABELS_JA: Record<TemptCategory, string> = {
  sign: '回転方向（±）の取り違え',
  axis: '回転軸の取り違え',
  magnitude: '回転量の誤り',
  globalLocalSwap: 'グローバル／ローカルの取り違え',
  offsetNeglect: '初期の傾きの無視',
};

export function toQuaternion(t: [number, number, number, number]): THREE.Quaternion {
  return new THREE.Quaternion(t[0], t[1], t[2], t[3]);
}

export interface AttributionSummary {
  /** number of wrong choice-mode answers analysed */
  count: number;
  breakdown: Array<{ category: TemptCategory; label: string; fraction: number }>;
}

/**
 * Aggregate probabilistic error attribution over the problem log (choice-mode
 * wrong answers). Each wrong pick contributes fractional credit to the error
 * categories consistent with it; results are normalised to fractions.
 */
export function aggregateAttribution(records: ProblemRecord[]): AttributionSummary {
  const sums = {} as Record<TemptCategory, number>;
  TEMPT_CATEGORIES.forEach((c) => (sums[c] = 0));
  let count = 0;

  for (const r of records) {
    if (r.mode !== 'choice' || r.correct || r.chosenIndex == null || !r.options) continue;
    const chosen = r.options[r.chosenIndex];
    if (!chosen || chosen.correct) continue;
    const attr = attributeError(r.steps, toQuaternion(r.baseQ), toQuaternion(chosen.orientation));
    TEMPT_CATEGORIES.forEach((c) => (sums[c] += attr[c]));
    count++;
  }

  const total = TEMPT_CATEGORIES.reduce((a, c) => a + sums[c], 0) || 1;
  const breakdown = TEMPT_CATEGORIES.map((c) => ({
    category: c,
    label: TEMPT_LABELS_JA[c],
    fraction: sums[c] / total,
  })).sort((a, b) => b.fraction - a.fraction);

  return { count, breakdown };
}

// re-export so the caller can also treat these as DistractorCategory values
export type { DistractorCategory };
