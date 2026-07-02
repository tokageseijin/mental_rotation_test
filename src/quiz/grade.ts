import type { AttemptRecord, QuizMode } from '../types';
import type { DrawingTask, GeneratedQuestion } from './generateQuestion';
import { stepStats } from './difficulty';
import { selfRatingIsSuccess, selfRatingScore, updateRating, updateRatingScore } from '../skill/rating';

// Turn a raw answer into a graded AttemptRecord + the new rating. Kept separate
// from the store so it is easy to unit-test.

export interface GradeResult {
  record: AttemptRecord;
  ratingAfter: number;
  correct: boolean;
}

/** Grade a 4-choice answer. `chosenIndex` indexes into question.options. */
export function gradeChoice(
  question: GeneratedQuestion,
  chosenIndex: number,
  ratingBefore: number,
  k = 48,
): GradeResult {
  const chosen = question.options[chosenIndex];
  const correct = !!chosen?.correct;
  const { axisCount, totalAngle, rotationType } = stepStats(question.steps);
  const { next } = updateRating(ratingBefore, question.difficulty, correct, k);

  const record: AttemptRecord = {
    at: Date.now(),
    mode: 'choice',
    modelId: question.modelId,
    difficulty: question.difficulty,
    axisCount,
    rotationType,
    totalAngle,
    correct,
    chosenCategory: correct ? undefined : chosen?.distractorCategory,
    ratingBefore,
    ratingAfter: next,
  };
  return { record, ratingAfter: next, correct };
}

/**
 * Grade a drawing attempt from the user's 4-level self evaluation
 * (0=よくできた .. 3=すごくできなかった). The self rating maps to a continuous
 * Elo score; drawing uses a smaller K because self assessment is noisier.
 */
export function gradeDrawing(
  task: DrawingTask,
  selfRating: number,
  ratingBefore: number,
  k = 36,
): GradeResult {
  const { axisCount, totalAngle, rotationType } = stepStats(task.steps);
  const score = selfRatingScore(selfRating);
  const correct = selfRatingIsSuccess(selfRating);
  const { next } = updateRatingScore(ratingBefore, task.difficulty, score, k);

  const record: AttemptRecord = {
    at: Date.now(),
    mode: 'drawing',
    modelId: task.modelId,
    difficulty: task.difficulty,
    axisCount,
    rotationType,
    totalAngle,
    correct,
    selfRating,
    ratingBefore,
    ratingAfter: next,
  };
  return { record, ratingAfter: next, correct };
}

export type { QuizMode };
