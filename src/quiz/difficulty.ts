import * as THREE from 'three';
import { AXIS_VECTORS, composeRotation } from '../three/rotation';
import type { RotationStep } from '../types';
import { offsetDifficulty, type PoseOffsets } from './pose';

// Pose-driven difficulty. The dominant factor is how "off-grid" the pose is at
// each step relative to the operation being applied:
//  - base offset difficulty is the sum of per-axis offsets (0/1/2)
//  - a step whose WORLD-space axis lines up with an offset axis CANCELS that
//    offset (rotating about an axis you're already offset on adds no extra load).
//    Global step world-axis = its axis; local step world-axis = axis·R (the axis
//    in the current pose). Cancellation is binary (aligned within ~20°).
//  - plus small per-operation risk (direction on 90°, axis on global) and
//    super-additive terms for step count and simultaneous multi-axis offsets.

const COS_TOL = Math.cos(THREE.MathUtils.degToRad(20));
const RAW_MAX = 7;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function poseDifficulty(
  offsets: PoseOffsets,
  steps: RotationStep[],
  baseQ: THREE.Quaternion,
): number {
  const poseDiff: Record<'x' | 'y' | 'z', number> = {
    x: offsetDifficulty(offsets.x),
    y: offsetDifficulty(offsets.y),
    z: offsetDifficulty(offsets.z),
  };

  // walk the steps, cancelling offsets whose axis the step rotates about
  let running = baseQ.clone();
  for (const step of steps) {
    const worldAxis =
      step.type === 'global'
        ? AXIS_VECTORS[step.axis].clone()
        : AXIS_VECTORS[step.axis].clone().applyQuaternion(running);
    (['x', 'y', 'z'] as const).forEach((ax) => {
      if (poseDiff[ax] > 0 && Math.abs(worldAxis.dot(AXIS_VECTORS[ax])) > COS_TOL) poseDiff[ax] = 0;
    });
    running = composeRotation([step], running);
  }

  const baseOffset = poseDiff.x + poseDiff.y + poseDiff.z;

  let opDiff = 0;
  for (const s of steps) {
    const a = Math.abs(s.angleDeg);
    opDiff += a % 180 === 0 ? 0 : a % 90 === 0 ? 0.4 : 0.8; // 180 easy, 90 dir-risk, else harder
    opDiff += s.type === 'global' ? 0.25 : 0.1; // global axis-confusion vs intuitive local
  }

  const stepExtra = 0.3 * Math.max(0, steps.length - 1); // sequential working memory
  const uncancelled = (poseDiff.x > 0 ? 1 : 0) + (poseDiff.y > 0 ? 1 : 0) + (poseDiff.z > 0 ? 1 : 0);
  const multiExtra = uncancelled >= 2 ? 0.6 * (uncancelled - 1) : 0; // compounding offsets

  return clamp01((baseOffset + opDiff + stepExtra + multiExtra) / RAW_MAX);
}

/** Coarse metadata about a step list, stored on each attempt for analysis. */
export function stepStats(steps: RotationStep[]): {
  axisCount: number;
  totalAngle: number;
  rotationType: 'global' | 'local';
} {
  const axisCount = new Set(steps.map((s) => s.axis)).size;
  const totalAngle = steps.reduce((sum, s) => sum + Math.abs(s.angleDeg), 0);
  const rotationType = steps.some((s) => s.type === 'local') ? 'local' : 'global';
  return { axisCount, totalAngle, rotationType };
}
