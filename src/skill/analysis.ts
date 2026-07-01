import type { AttemptRecord, Axis, DistractorCategory, RotationType } from '../types';

// Aggregations over attempt history that answer "where do I go wrong?".
// All functions are pure over a list of attempts so the Stats page can slice by
// mode before calling them.

export interface Bucket {
  label: string;
  total: number;
  correct: number;
}

function acc(b: Bucket): number {
  return b.total ? b.correct / b.total : 0;
}

export const DISTRACTOR_LABELS_JA: Record<DistractorCategory, string> = {
  axis: '回転軸の取り違え',
  sign: '回転方向（符号）の誤り',
  magnitude: '回転量の誤り',
  globalLocalSwap: 'グローバル / ローカルの取り違え',
  mirror: '鏡像・裏表の混同',
};

const TYPE_ORDER: RotationType[] = ['global', 'local'];

export interface AnalysisSummary {
  totalAttempts: number;
  overallAccuracy: number;
  byRotationType: Bucket[];
  byAxisCount: Bucket[];
  byDifficulty: Bucket[];
  /** ranked list of the mistake categories the user makes most */
  mistakeRanking: Array<{ category: DistractorCategory; label: string; count: number }>;
  /** wrong answers on easy questions (difficulty < 0.34) */
  easyMisses: number;
  /** wrong answers on hard questions (difficulty >= 0.66) */
  hardMisses: number;
}

function difficultyBand(d: number): '易しい' | 'ふつう' | '難しい' {
  if (d < 0.34) return '易しい';
  if (d < 0.66) return 'ふつう';
  return '難しい';
}

export function summarize(attempts: AttemptRecord[]): AnalysisSummary {
  const total = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;

  const typeBuckets: Record<RotationType, Bucket> = {
    global: { label: 'グローバル回転', total: 0, correct: 0 },
    local: { label: 'ローカル回転', total: 0, correct: 0 },
  };
  const axisCountBuckets = new Map<number, Bucket>();
  const diffBuckets: Record<string, Bucket> = {
    易しい: { label: '易しい', total: 0, correct: 0 },
    ふつう: { label: 'ふつう', total: 0, correct: 0 },
    難しい: { label: '難しい', total: 0, correct: 0 },
  };
  const mistakes = new Map<DistractorCategory, number>();
  let easyMisses = 0;
  let hardMisses = 0;

  for (const a of attempts) {
    const t = typeBuckets[a.rotationType];
    t.total++;
    if (a.correct) t.correct++;

    const ac = axisCountBuckets.get(a.axisCount) ?? { label: `${a.axisCount}軸`, total: 0, correct: 0 };
    ac.total++;
    if (a.correct) ac.correct++;
    axisCountBuckets.set(a.axisCount, ac);

    const db = diffBuckets[difficultyBand(a.difficulty)];
    db.total++;
    if (a.correct) db.correct++;

    if (!a.correct) {
      if (a.difficulty < 0.34) easyMisses++;
      if (a.difficulty >= 0.66) hardMisses++;
      if (a.chosenCategory) mistakes.set(a.chosenCategory, (mistakes.get(a.chosenCategory) ?? 0) + 1);
    }
  }

  return {
    totalAttempts: total,
    overallAccuracy: total ? correct / total : 0,
    byRotationType: TYPE_ORDER.map((t) => typeBuckets[t]),
    byAxisCount: [...axisCountBuckets.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b),
    byDifficulty: ['易しい', 'ふつう', '難しい'].map((k) => diffBuckets[k]),
    mistakeRanking: [...mistakes.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, label: DISTRACTOR_LABELS_JA[category], count })),
    easyMisses,
    hardMisses,
  };
}

export { acc as bucketAccuracy };
export type { Axis };
