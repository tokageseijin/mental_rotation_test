import * as THREE from 'three';
import { composeRotation } from '../three/rotation';
import type { Axis } from '../types';

// The initial pose ("見本") is built from explicit per-axis offsets from the
// 90° grid, so its difficulty is known by construction (no ambiguous quaternion
// decomposition). Offset difficulty: a 90° grid pose is "clean" (0); a 45°
// half-step is mildly off (1); 15/30/60/75° is clearly off-grid (2).

export interface PoseOffsets {
  x: number;
  y: number;
  z: number;
}

export function offsetDifficulty(angleDeg: number): number {
  const m = ((Math.round(angleDeg) % 90) + 90) % 90;
  if (m === 0) return 0;
  if (m === 45) return 1;
  return 2;
}

const AXES: Axis[] = ['x', 'y', 'z'];
const randInt = (n: number) => Math.floor(Math.random() * n);
const pickOf = <T,>(a: T[]): T => a[randInt(a.length)];

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Build the base orientation from per-axis global offsets (Rz·Ry·Rx). */
export function poseFromOffsets(offsets: PoseOffsets): THREE.Quaternion {
  return composeRotation([
    { axis: 'x', angleDeg: offsets.x, type: 'global' },
    { axis: 'y', angleDeg: offsets.y, type: 'global' },
    { axis: 'z', angleDeg: offsets.z, type: 'global' },
  ]);
}

/**
 * Generate an initial pose for a target difficulty. Every axis starts on a
 * random 90° multiple (clean); higher targets tilt 1–2 axes off-grid.
 */
export function generateBasePose(target: number): { baseQ: THREE.Quaternion; offsets: PoseOffsets } {
  const t = Math.max(0, Math.min(1, target));
  const offsets: PoseOffsets = { x: 90 * randInt(4), y: 90 * randInt(4), z: 90 * randInt(4) };

  const nOff = t < 0.34 ? 0 : t < 0.67 ? 1 : Math.random() < 0.5 ? 1 : 2;
  for (const ax of shuffle(AXES).slice(0, nOff)) {
    // diff-2 offsets grow more likely with target; otherwise a 45° half-step
    const dev = Math.random() < t - 0.3 ? pickOf([15, 30, 60, 75]) : 45;
    offsets[ax] += dev;
  }
  return { baseQ: poseFromOffsets(offsets), offsets };
}
