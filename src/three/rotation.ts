import * as THREE from 'three';
import type { Axis, RotationStep, RotationType } from '../types';

export const AXIS_VECTORS: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

export const AXIS_LABELS: Record<Axis, string> = { x: 'X', y: 'Y', z: 'Z' };

/**
 * Compose a sequence of rotation steps into a single quaternion.
 *
 * The global/local distinction is the core teaching content:
 *  - global (world axis): pre-multiply   q' = qΔ · q
 *  - local  (object axis): post-multiply  q' = q · qΔ
 */
export function composeRotation(
  steps: RotationStep[],
  base: THREE.Quaternion = new THREE.Quaternion(),
): THREE.Quaternion {
  const q = base.clone();
  for (const step of steps) {
    const delta = new THREE.Quaternion().setFromAxisAngle(
      AXIS_VECTORS[step.axis],
      THREE.MathUtils.degToRad(step.angleDeg),
    );
    if (step.type === 'global') q.premultiply(delta);
    else q.multiply(delta);
  }
  return q;
}

/** Shortest-arc angle (radians) between two orientations. */
export function quaternionAngle(a: THREE.Quaternion, b: THREE.Quaternion): number {
  const dot = Math.min(1, Math.abs(a.dot(b)));
  return 2 * Math.acos(dot);
}

/** Human-readable instruction, e.g. "Y軸 まわりに +90°（グローバル）". */
export function describeStep(step: RotationStep): string {
  const dir = step.angleDeg >= 0 ? '+' : '';
  const kind = step.type === 'global' ? 'グローバル' : 'ローカル';
  return `${AXIS_LABELS[step.axis]}軸まわりに ${dir}${step.angleDeg}°（${kind}）`;
}

export function describeSteps(steps: RotationStep[]): string[] {
  return steps.map(describeStep);
}

export function oppositeType(type: RotationType): RotationType {
  return type === 'global' ? 'local' : 'global';
}
