import * as THREE from 'three';
import type { Axis, DistractorCategory, Question, QuizOption, RotationStep, RotationType } from '../types';
import { composeRotation, quaternionAngle } from '../three/rotation';
import { createSnapshotScene, renderOrientation } from '../three/snapshotRenderer';
import { difficultyOf } from './difficulty';

// --- small RNG helpers ------------------------------------------------------

const AXES: Axis[] = ['x', 'y', 'z'];
const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: T[]): T => arr[rand(arr.length)];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- adaptive question planning --------------------------------------------

/**
 * Choose rotation parameters aimed at a target difficulty (0..1), clamped by a
 * ceiling from settings. Higher targets add axes, allow local rotation and use
 * less "clean" angles.
 */
export function planSteps(target: number): RotationStep[] {
  const t = Math.max(0, Math.min(1, target));
  const axisCount = t < 0.34 ? 1 : t < 0.67 ? (Math.random() < 0.5 ? 1 : 2) : Math.random() < 0.5 ? 2 : 3;

  const cleanAngles = [90, -90, 180];
  const midAngles = [90, -90, 180, 45, -45];
  const hardAngles = [45, -45, 90, -90, 135, -135, 180];
  const angleSet = t < 0.34 ? cleanAngles : t < 0.67 ? midAngles : hardAngles;

  // local rotation only enters as difficulty rises
  const typeFor = (): RotationType => (t > 0.5 && Math.random() < t - 0.3 ? 'local' : 'global');

  const usedAxes: Axis[] = [];
  const steps: RotationStep[] = [];
  for (let i = 0; i < axisCount; i++) {
    const remaining = AXES.filter((a) => !usedAxes.includes(a));
    const axis = pick(remaining.length ? remaining : AXES);
    usedAxes.push(axis);
    steps.push({ axis, angleDeg: pick(angleSet), type: typeFor() });
  }
  return steps;
}

// --- distractor construction ------------------------------------------------

interface Candidate {
  quaternion: THREE.Quaternion;
  category: DistractorCategory;
  flipX?: boolean;
}

function otherAxis(axis: Axis): Axis {
  const rest = AXES.filter((a) => a !== axis);
  return pick(rest);
}

function buildCandidates(steps: RotationStep[], base: THREE.Quaternion): Candidate[] {
  const out: Candidate[] = [];

  // All distractors are applied to the SAME starting pose (base) as the answer,
  // so only the rotation itself differs.

  // sign: reverse every direction
  out.push({
    category: 'sign',
    quaternion: composeRotation(steps.map((s) => ({ ...s, angleDeg: -s.angleDeg })), base),
  });

  // axis: rotate each step around a different axis
  out.push({
    category: 'axis',
    quaternion: composeRotation(steps.map((s) => ({ ...s, axis: otherAxis(s.axis) })), base),
  });

  // magnitude: nudge every angle by ±45°
  out.push({
    category: 'magnitude',
    quaternion: composeRotation(
      steps.map((s) => ({ ...s, angleDeg: s.angleDeg + (s.angleDeg >= 0 ? 45 : -45) })),
      base,
    ),
  });

  // global<->local swap (a non-identity base makes this differ even for 1 step)
  out.push({
    category: 'globalLocalSwap',
    quaternion: composeRotation(
      steps.map((s) => ({ ...s, type: s.type === 'global' ? 'local' : 'global' })),
      base,
    ),
  });

  // NOTE: a "mirror" (enantiomer) distractor is intentionally disabled for now.
  // Many current models are axially symmetric, so a mirrored image can be
  // indistinguishable from the correct answer — an unfair option. The flipX
  // rendering path and the 'mirror' category are kept for when non-symmetric
  // models make this fair again.

  return out;
}

const MIN_SEPARATION = THREE.MathUtils.degToRad(22);

/** Pick 3 distractors that are visually distinct from the answer and each other. */
function selectDistractors(candidates: Candidate[], correct: THREE.Quaternion): Candidate[] {
  const chosen: Candidate[] = [];
  const accepted = [{ quaternion: correct, flipX: false as boolean | undefined }];

  for (const c of shuffle(candidates)) {
    if (chosen.length === 3) break;
    const tooClose = accepted.some(
      (a) => !!a.flipX === !!c.flipX && quaternionAngle(a.quaternion, c.quaternion) < MIN_SEPARATION,
    );
    if (tooClose) continue;
    chosen.push(c);
    accepted.push({ quaternion: c.quaternion, flipX: c.flipX });
  }

  // Fallback: if separation filtering left us short, top up with extra rotations.
  while (chosen.length < 3) {
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(30 + chosen.length * 40))
      .multiply(correct);
    chosen.push({ quaternion: q, category: 'magnitude' });
  }
  return chosen;
}

// --- starting pose ----------------------------------------------------------

/**
 * The pose the object is shown in *before* the rotation is applied. Most of the
 * time the object already starts rotated (the common case the user asked for);
 * occasionally it starts upright. Clean quarter/half turns keep the pose
 * readable so the user can mentally simulate from it.
 */
function randomBaseOrientation(): THREE.Quaternion {
  if (Math.random() < 0.18) return new THREE.Quaternion(); // sometimes upright
  const turns = Math.random() < 0.5 ? 1 : 2;
  const angles = [90, -90, 180];
  const steps: RotationStep[] = [];
  const used: Axis[] = [];
  for (let i = 0; i < turns; i++) {
    const remaining = AXES.filter((a) => !used.includes(a));
    const axis = pick(remaining);
    used.push(axis);
    steps.push({ axis, angleDeg: pick(angles), type: 'global' });
  }
  return composeRotation(steps);
}

// --- public API -------------------------------------------------------------

export interface GeneratedQuestion extends Question {
  minDistractorAngleRad: number;
  /** rendered image of the fixed pre-rotation pose (the "見本") */
  baseImageUrl: string;
}

/**
 * Build a full 4-choice question from a resolved model object.
 * Renders the fixed base pose + 1 correct + 3 distractor thumbnails, all from
 * the same camera so the user can simulate the rotation from the sample view.
 */
export function generateQuestion(
  modelId: string,
  object: THREE.Object3D,
  target: number,
): GeneratedQuestion {
  const steps = planSteps(target);
  const baseQ = randomBaseOrientation();
  const correctQ = composeRotation(steps, baseQ);

  const distractors = selectDistractors(buildCandidates(steps, baseQ), correctQ);

  const snap = createSnapshotScene(object);
  try {
    const baseImageUrl = renderOrientation(snap, baseQ);
    const correctOption: QuizOption = {
      imageUrl: renderOrientation(snap, correctQ),
      correct: true,
    };
    const distractorOptions: QuizOption[] = distractors.map((d) => ({
      imageUrl: renderOrientation(snap, d.quaternion, { flipX: d.flipX }),
      correct: false,
      distractorCategory: d.category,
    }));

    const options = shuffle([correctOption, ...distractorOptions]);
    const correctIndex = options.findIndex((o) => o.correct);

    const minDistractorAngleRad = Math.min(
      ...distractors.map((d) => (d.flipX ? Math.PI : quaternionAngle(correctQ, d.quaternion))),
    );
    const difficulty = difficultyOf({ steps, minDistractorAngleRad });

    return { modelId, steps, difficulty, options, correctIndex, minDistractorAngleRad, baseImageUrl };
  } finally {
    snap.dispose();
  }
}

// --- drawing mode -----------------------------------------------------------

export interface DrawingTask {
  modelId: string;
  steps: RotationStep[];
  difficulty: number;
  /** fixed pre-rotation pose the user draws from */
  baseImageUrl: string;
  /** correct post-rotation result, revealed after the user has drawn */
  answerImageUrl: string;
}

/**
 * Build a drawing task: just the base pose + the correct answer, both from the
 * same camera. No distractors (the user sketches the result instead of picking).
 */
export function generateDrawingTask(
  modelId: string,
  object: THREE.Object3D,
  target: number,
): DrawingTask {
  const steps = planSteps(target);
  const baseQ = randomBaseOrientation();
  const correctQ = composeRotation(steps, baseQ);
  // No distractors here, so difficulty omits the "closeness" term.
  const difficulty = difficultyOf({ steps });

  const snap = createSnapshotScene(object);
  try {
    return {
      modelId,
      steps,
      difficulty,
      baseImageUrl: renderOrientation(snap, baseQ),
      answerImageUrl: renderOrientation(snap, correctQ),
    };
  } finally {
    snap.dispose();
  }
}
