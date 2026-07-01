import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AttemptRecord, QuizMode } from '../types';
import { START_RATING } from '../skill/rating';

interface ModeState {
  rating: number;
}

export interface ProfileState {
  modes: Record<QuizMode, ModeState>;
  history: AttemptRecord[];
  /** append a graded attempt and move that mode's rating to record.ratingAfter */
  recordAttempt: (record: AttemptRecord) => void;
  reset: () => void;
  replaceAll: (s: Pick<ProfileState, 'modes' | 'history'>) => void;
}

const initialModes = (): Record<QuizMode, ModeState> => ({
  choice: { rating: START_RATING },
  drawing: { rating: START_RATING },
});

const MAX_HISTORY = 2000;

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      modes: initialModes(),
      history: [],
      recordAttempt: (record) =>
        set((state) => {
          const history = [...state.history, record].slice(-MAX_HISTORY);
          return {
            history,
            modes: {
              ...state.modes,
              [record.mode]: { rating: record.ratingAfter },
            },
          };
        }),
      reset: () => set({ modes: initialModes(), history: [] }),
      replaceAll: (s) => set({ modes: s.modes, history: s.history }),
    }),
    { name: 'mrt.profile' },
  ),
);
