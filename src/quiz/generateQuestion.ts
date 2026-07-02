import * as THREE from 'three';
import type { Axis, DistractorCategory, Question, QuizOption, RotationStep, RotationType } from '../types';
import { composeRotation, quaternionAngle } from '../three/rotation';
import { createSnapshotScene, renderOrientation } from '../three/snapshotRenderer';
import { poseDifficulty } from './difficulty';
import { offsetDifficulty, poseFromOffsets, type PoseOffsets } from './pose';
import {
  buildCandidatePose,
  questionFeatures,
  temptationWeight,
  TEMPT_CATEGORIES,
  NEUTRAL_PERSONAL,
  type PersonalModel,
  type QuestionFeatures,
  type TemptCategory,
} from './errorModels';

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

// --- question sampling (matched to a target difficulty) --------------------

const ALL_ANGLES = [90, -90, 180, 45, -45, 135, -135];
const OFFSET_DEVS = [15, 30, 45, 60, 75];
const MATCH_SAMPLES = 28; // rejection samples per question

/** A broadly-sampled challenge rotation (1–3 axes, mixed angles/frames). */
function sampleSteps(): RotationStep[] {
  const axisCount = 1 + rand(3);
  const usedAxes: Axis[] = [];
  const steps: RotationStep[] = [];
  for (let i = 0; i < axisCount; i++) {
    const remaining = AXES.filter((a) => !usedAxes.includes(a));
    const axis = pick(remaining.length ? remaining : AXES);
    usedAxes.push(axis);
    const type: RotationType = Math.random() < 0.4 ? 'local' : 'global';
    steps.push({ axis, angleDeg: pick(ALL_ANGLES), type });
  }
  return steps;
}

/** A broadly-sampled initial pose (0–2 axes tilted off the grid). */
function sampleOffsets(): PoseOffsets {
  const offsets: PoseOffsets = { x: 90 * rand(4), y: 90 * rand(4), z: 90 * rand(4) };
  for (const ax of shuffle(AXES).slice(0, rand(3))) offsets[ax] += pick(OFFSET_DEVS);
  return offsets;
}

interface MatchedConfig {
  baseQ: THREE.Quaternion;
  offsets: PoseOffsets;
  steps: RotationStep[];
  poseDiff: number;
}

/**
 * Sample several random questions and keep the one whose pose difficulty is
 * closest to the target. This makes the realized difficulty actually track the
 * target (the old threshold-based planner under-produced), so a rising rating
 * yields harder, more varied questions and meaningful rewards.
 */
function generateMatched(target: number): MatchedConfig {
  let best: MatchedConfig | null = null;
  let bestErr = Infinity;
  for (let i = 0; i < MATCH_SAMPLES; i++) {
    const offsets = sampleOffsets();
    const steps = sampleSteps();
    const baseQ = poseFromOffsets(offsets);
    const poseDiff = poseDifficulty(offsets, steps, baseQ);
    const err = Math.abs(poseDiff - target);
    if (err < bestErr) {
      bestErr = err;
      best = { baseQ, offsets, steps, poseDiff };
    }
  }
  return best!;
}

// --- distractor construction (temptation-weighted, general rules) ----------

interface Candidate {
  quaternion: THREE.Quaternion;
  category: DistractorCategory;
  flipX?: boolean;
  weight: number;
}

function temptingCandidates(
  steps: RotationStep[],
  base: THREE.Quaternion,
  feats: QuestionFeatures,
  personal: PersonalModel,
): Candidate[] {
  const out: Candidate[] = [];
  for (const cat of TEMPT_CATEGORIES) {
    // general prior × personal multiplier (individual fitting)
    const weight = temptationWeight(cat as TemptCategory, feats) * personal.multiplier(cat as TemptCategory, feats);
    if (weight <= 0) continue;
    out.push({ category: cat, quaternion: buildCandidatePose(cat as TemptCategory, steps, base), weight });
  }
  return out;
}

/**
 * Extra difficulty from how tempting the offered distractors are (0 = neutral).
 * Couples the intrinsic pose difficulty with the actual options so the rating
 * update (Elo) stays calibrated to the real chance of being lured.
 */
function temptationDifficulty(distractors: Candidate[]): number {
  if (!distractors.length) return 0;
  const mean = distractors.reduce((a, d) => a + Math.max(0, d.weight - 0.5), 0) / distractors.length;
  return Math.max(0, Math.min(1, mean));
}

const MIN_SEPARATION = THREE.MathUtils.degToRad(22);

/**
 * Pick 3 distractors: prefer the most tempting (highest weight) wrong answers,
 * with a little exploration noise, but keep them visually distinct from the
 * answer and from each other.
 */
function selectDistractors(candidates: Candidate[], correct: THREE.Quaternion): Candidate[] {
  const scored = candidates
    .map((c) => ({ c, score: c.weight + Math.random() * 0.4 }))
    .sort((a, b) => b.score - a.score);

  const chosen: Candidate[] = [];
  const accepted = [correct];
  for (const { c } of scored) {
    if (chosen.length === 3) break;
    if (accepted.some((a) => quaternionAngle(a, c.quaternion) < MIN_SEPARATION)) continue;
    chosen.push(c);
    accepted.push(c.quaternion);
  }

  // Fallback: top up with extra rotations if separation filtering left us short.
  while (chosen.length < 3) {
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(35 + chosen.length * 40))
      .multiply(correct);
    chosen.push({ quaternion: q, category: 'magnitude', weight: 0 });
  }
  return chosen;
}

function baseHasOffset(offsets: { x: number; y: number; z: number }): boolean {
  return offsetDifficulty(offsets.x) + offsetDifficulty(offsets.y) + offsetDifficulty(offsets.z) > 0;
}

// --- public API -------------------------------------------------------------

export interface GeneratedQuestion extends Question {
  minDistractorAngleRad: number;
  /** rendered image of the fixed pre-rotation pose (the "見本") */
  baseImageUrl: string;
  /** the starting orientation, for animating base -> answer after grading */
  baseQ: THREE.Quaternion;
}

const TEMPT_COUPLING = 0.15; // how much distractor temptation adds to difficulty

/** Build a full 4-choice question from a resolved model object. */
export function generateQuestion(
  modelId: string,
  object: THREE.Object3D,
  target: number,
  personal: PersonalModel = NEUTRAL_PERSONAL,
): GeneratedQuestion {
  // Rejection-sample on the FINAL difficulty (pose + temptation) so the realized
  // question — including how tempting its distractors are — actually matches the
  // target. Only rendering is deferred to the winning sample.
  let best: {
    baseQ: THREE.Quaternion;
    correctQ: THREE.Quaternion;
    steps: RotationStep[];
    distractors: Candidate[];
    difficulty: number;
  } | null = null;
  let bestErr = Infinity;
  for (let i = 0; i < MATCH_SAMPLES; i++) {
    const offsets = sampleOffsets();
    const steps = sampleSteps();
    const baseQ = poseFromOffsets(offsets);
    const correctQ = composeRotation(steps, baseQ);
    const feats = questionFeatures(steps, baseHasOffset(offsets));
    const distractors = selectDistractors(temptingCandidates(steps, baseQ, feats, personal), correctQ);
    const difficulty = Math.min(
      1,
      poseDifficulty(offsets, steps, baseQ) + TEMPT_COUPLING * temptationDifficulty(distractors),
    );
    const err = Math.abs(difficulty - target);
    if (err < bestErr) {
      bestErr = err;
      best = { baseQ, correctQ, steps, distractors, difficulty };
    }
  }
  const { baseQ, correctQ, steps, distractors, difficulty } = best!;

  const snap = createSnapshotScene(object);
  try {
    const baseImageUrl = renderOrientation(snap, baseQ);
    const correctOption: QuizOption = {
      imageUrl: renderOrientation(snap, correctQ),
      correct: true,
      orientation: correctQ.toArray() as [number, number, number, number],
    };
    const distractorOptions: QuizOption[] = distractors.map((d) => ({
      imageUrl: renderOrientation(snap, d.quaternion, { flipX: d.flipX }),
      correct: false,
      distractorCategory: d.category,
      orientation: d.quaternion.toArray() as [number, number, number, number],
      flipX: d.flipX,
    }));

    const options = shuffle([correctOption, ...distractorOptions]);
    const correctIndex = options.findIndex((o) => o.correct);

    const minDistractorAngleRad = Math.min(
      ...distractors.map((d) => quaternionAngle(correctQ, d.quaternion)),
    );

    return { modelId, steps, difficulty, options, correctIndex, minDistractorAngleRad, baseImageUrl, baseQ };
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
  /** the starting orientation, for animating base -> answer on reveal */
  baseQ: THREE.Quaternion;
}

/** Build a drawing task: base pose + the correct answer, from the same camera. */
export function generateDrawingTask(
  modelId: string,
  object: THREE.Object3D,
  target: number,
): DrawingTask {
  const { baseQ, steps, poseDiff } = generateMatched(target);
  const correctQ = composeRotation(steps, baseQ);

  const snap = createSnapshotScene(object);
  try {
    return {
      modelId,
      steps,
      difficulty: poseDiff,
      baseImageUrl: renderOrientation(snap, baseQ),
      answerImageUrl: renderOrientation(snap, correctQ),
      baseQ,
    };
  } finally {
    snap.dispose();
  }
}
