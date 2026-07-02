import * as THREE from 'three';
import { quaternionAngle } from '../three/rotation';
import type { ProblemRecord, RotationStep } from '../types';
import {
  attributeError,
  nearestGrid,
  toQuaternion,
  TEMPT_CATEGORIES,
  type PersonalModel,
  type QuestionFeatures,
  type TemptCategory,
} from './errorModels';

// Individual fitting of temptation tendencies from the problem log.
//
// For each error category we estimate, in log-odds, how much the user's
// attributed-error rate LIFTS under each single condition, plus a pairwise
// interaction term (the "A→B specific" residual not explained by A or B alone).
// Everything is shrunk toward 0 by sample count, so with little data the model
// returns ~1 (fall back to the general rule).

const CONDS = ['has90', 'hasGlobal', 'hasLocal', 'hasOffset', 'multiStep'] as const;
type Cond = (typeof CONDS)[number];

const OFFSET_TOL = THREE.MathUtils.degToRad(5);
const MIN_WRONG = 10; // cold-start guard
const SHRINK_K = 6; // pseudo-count: log-lift ~0 until this many samples
const EPS = 0.02;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function featuresFromRecord(steps: RotationStep[], baseQ: THREE.Quaternion): QuestionFeatures {
  return {
    has90: steps.some((s) => Math.abs(s.angleDeg) % 90 === 0 && Math.abs(s.angleDeg) % 180 !== 0),
    hasGlobal: steps.some((s) => s.type === 'global'),
    hasLocal: steps.some((s) => s.type === 'local'),
    multiStep: steps.length > 1,
    hasOffset: quaternionAngle(baseQ, nearestGrid(baseQ)) > OFFSET_TOL,
  };
}

function condsOf(f: QuestionFeatures): Cond[] {
  return CONDS.filter((c) => f[c]);
}

export function buildPersonalModel(records: ProblemRecord[]): PersonalModel {
  const rows: Array<{ conds: Cond[]; attr: Record<TemptCategory, number> }> = [];
  for (const r of records) {
    if (r.mode !== 'choice' || r.correct || r.chosenIndex == null || !r.options) continue;
    const chosen = r.options[r.chosenIndex];
    if (!chosen || chosen.correct) continue;
    const base = toQuaternion(r.baseQ);
    rows.push({
      conds: condsOf(featuresFromRecord(r.steps, base)),
      attr: attributeError(r.steps, base, toQuaternion(chosen.orientation)),
    });
  }
  const N = rows.length;
  if (N < MIN_WRONG) return { multiplier: () => 1 };

  const marginal = Object.fromEntries(TEMPT_CATEGORIES.map((c) => [c, 0])) as Record<TemptCategory, number>;
  const condN = Object.fromEntries(CONDS.map((c) => [c, 0])) as Record<Cond, number>;
  const condHit = Object.fromEntries(
    TEMPT_CATEGORIES.map((c) => [c, Object.fromEntries(CONDS.map((cd) => [cd, 0]))]),
  ) as Record<TemptCategory, Record<Cond, number>>;
  const pairN: Record<string, number> = {};
  const pairHit = Object.fromEntries(TEMPT_CATEGORIES.map((c) => [c, {}])) as Record<
    TemptCategory,
    Record<string, number>
  >;

  for (const row of rows) {
    for (const c of TEMPT_CATEGORIES) marginal[c] += row.attr[c];
    for (const cond of row.conds) {
      condN[cond] += 1;
      for (const c of TEMPT_CATEGORIES) condHit[c][cond] += row.attr[c];
    }
    for (let i = 0; i < row.conds.length; i++) {
      for (let j = i + 1; j < row.conds.length; j++) {
        const key = `${row.conds[i]}|${row.conds[j]}`;
        pairN[key] = (pairN[key] ?? 0) + 1;
        for (const c of TEMPT_CATEGORIES) pairHit[c][key] = (pairHit[c][key] ?? 0) + row.attr[c];
      }
    }
  }

  const r0 = Object.fromEntries(
    TEMPT_CATEGORIES.map((c) => [c, Math.max(EPS, marginal[c] / N)]),
  ) as Record<TemptCategory, number>;

  // single-condition shrunk log-lifts
  const singleLL = Object.fromEntries(
    TEMPT_CATEGORIES.map((c) => [
      c,
      Object.fromEntries(
        CONDS.map((cond) => {
          const n = condN[cond];
          if (n === 0) return [cond, 0];
          const obs = Math.max(EPS, condHit[c][cond] / n);
          return [cond, Math.log(obs / r0[c]) * (n / (n + SHRINK_K))];
        }),
      ),
    ]),
  ) as Record<TemptCategory, Record<Cond, number>>;

  // pairwise interaction: residual over the multiplicative single-condition prediction
  const pairLL = Object.fromEntries(
    TEMPT_CATEGORIES.map((c) => [
      c,
      Object.fromEntries(
        Object.keys(pairN).map((key) => {
          const [a, b] = key.split('|') as Cond[];
          const n = pairN[key];
          const obs = Math.max(EPS, (pairHit[c][key] ?? 0) / n);
          const predicted = Math.max(EPS, r0[c] * Math.exp(singleLL[c][a]) * Math.exp(singleLL[c][b]));
          return [key, Math.log(obs / predicted) * (n / (n + SHRINK_K))];
        }),
      ),
    ]),
  ) as Record<TemptCategory, Record<string, number>>;

  return {
    multiplier(cat, feats) {
      const conds = condsOf(feats);
      let s = 0;
      for (const cond of conds) s += singleLL[cat][cond] ?? 0;
      for (let i = 0; i < conds.length; i++) {
        for (let j = i + 1; j < conds.length; j++) {
          s += pairLL[cat][`${conds[i]}|${conds[j]}`] ?? 0;
        }
      }
      return clamp(Math.exp(s), 0.4, 2.5);
    },
  };
}
