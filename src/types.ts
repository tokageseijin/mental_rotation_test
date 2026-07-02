// Shared domain types for the mental-rotation trainer.

export type Axis = 'x' | 'y' | 'z';
export type RotationType = 'global' | 'local';
export type QuizMode = 'choice' | 'drawing';

/** A single rotation instruction shown to the user and applied to the model. */
export interface RotationStep {
  axis: Axis;
  /** signed degrees; sign encodes direction */
  angleDeg: number;
  type: RotationType;
}

/**
 * Why a distractor is wrong. Recorded when a user picks it so we can analyse
 * *what* kind of mistake the user tends to make.
 */
export type DistractorCategory =
  | 'axis' // rotated around a different axis
  | 'sign' // right axis/magnitude, wrong direction
  | 'magnitude' // right axis, wrong angle amount
  | 'globalLocalSwap' // applied as local instead of global (or vice-versa)
  | 'offsetNeglect' // ignored the initial off-grid tilt (applied to a clean pose)
  | 'mirror'; // mirrored / chirality confusion (currently disabled)

/** A serialisable quaternion [x, y, z, w]. */
export type QuatTuple = [number, number, number, number];

export interface QuizOption {
  /** rasterised preview of the model at this orientation */
  imageUrl: string;
  correct: boolean;
  /** only present on wrong options */
  distractorCategory?: DistractorCategory;
  /** orientation used to render this option (for logging / reconstruction) */
  orientation: QuatTuple;
  flipX?: boolean;
}

export interface Question {
  modelId: string;
  steps: RotationStep[];
  /** 0..1 estimated difficulty of this question */
  difficulty: number;
  options: QuizOption[];
  /** index into options that is correct */
  correctIndex: number;
}

/** One graded attempt, stored in history for analysis. */
export interface AttemptRecord {
  at: number; // epoch ms
  mode: QuizMode;
  modelId: string;
  difficulty: number;
  axisCount: number;
  rotationType: RotationType;
  totalAngle: number; // sum of |angleDeg|
  correct: boolean;
  /** for choice mode wrong answers: which kind of distractor was chosen */
  chosenCategory?: DistractorCategory;
  /** for drawing mode: user self-evaluation 0..3 (best..worst) */
  selfRating?: number;
  ratingBefore: number;
  ratingAfter: number;
}

// --- Ranks -----------------------------------------------------------------

export const RANK_TIERS = [
  'Iron',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Emerald',
  'Diamond',
  'Master',
  'Grandmaster',
] as const;

export type RankTier = (typeof RANK_TIERS)[number];

export const RANK_LABELS_JA: Record<RankTier, string> = {
  Iron: 'アイアン',
  Bronze: 'ブロンズ',
  Silver: 'シルバー',
  Gold: 'ゴールド',
  Platinum: 'プラチナ',
  Emerald: 'エメラルド',
  Diamond: 'ダイヤモンド',
  Master: 'マスター',
  Grandmaster: 'グランドマスター',
};

// --- Model library ---------------------------------------------------------

export type ModelSource = 'preset' | 'user';
export type ModelCategory = 'abstract' | 'concrete';

export interface ModelEntry {
  id: string;
  name: string;
  source: ModelSource;
  category?: ModelCategory;
  /** how the user model's bytes are persisted (user models only) */
  storageMode?: 'handle' | 'bytes';
  addedAt: number;
}

// --- problem log -----------------------------------------------------------

/** A single option as stored in the problem log (no image, just its makeup). */
export interface LoggedOption {
  correct: boolean;
  distractorCategory?: DistractorCategory;
  orientation: QuatTuple;
  flipX?: boolean;
}

/**
 * Full record of one presented problem, kept so the exact question (initial
 * pose, applied rotation, the 4 options) and the user's answer can be reviewed
 * or reconstructed later. Distinct from AttemptRecord, which is lean analytics.
 */
export interface ProblemRecord {
  at: number;
  mode: QuizMode;
  modelId: string;
  modelName?: string;
  /** initial orientation (before the challenge rotation) */
  baseQ: QuatTuple;
  /** the challenge rotation the user had to apply */
  steps: RotationStep[];
  difficulty: number;
  correct: boolean;
  // --- choice mode ---
  options?: LoggedOption[];
  correctIndex?: number;
  /** index the user picked (choice mode) */
  chosenIndex?: number;
  // --- drawing mode ---
  /** self evaluation 0..3 (best..worst) */
  selfRating?: number;
}
