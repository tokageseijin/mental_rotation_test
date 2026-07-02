import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProblemRecord } from '../types';

// A capped log of full problem records (question makeup + the user's answer),
// kept for later review / analysing the distractor algorithm. Separate from the
// lean AttemptRecord analytics.

const MAX_RECORDS = 500;

export interface ProblemLogState {
  records: ProblemRecord[];
  add: (record: ProblemRecord) => void;
  clear: () => void;
}

export const useProblemLog = create<ProblemLogState>()(
  persist(
    (set) => ({
      records: [],
      add: (record) => set((s) => ({ records: [...s.records, record].slice(-MAX_RECORDS) })),
      clear: () => set({ records: [] }),
    }),
    { name: 'mrt.problemlog' },
  ),
);
