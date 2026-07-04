import { create } from 'zustand';
import type { QuizMode } from '../types';

// Ephemeral UI/session state for the Quiz page. Not persisted: a session only
// matters while it is running, and leaving the quiz restarts it from scratch.
//
// Two independent axes:
//  - `mode`    : answer format (4-choice vs drawing)
//  - `scoring` : whether the session counts toward your rating ('rating') or is
//                casual practice that never changes it ('enjoy'). Enjoy lets you
//                warm up on a new object without tanking your rating.
export type Scoring = 'rating' | 'enjoy';

interface SessionState {
  selectedModelIds: string[];
  mode: QuizMode;
  scoring: Scoring;
  /** true while a quiz session is running (past the selection screen) */
  playing: boolean;
  toggleModel: (id: string) => void;
  setSelectedModels: (ids: string[]) => void;
  setMode: (m: QuizMode) => void;
  /** begin a session with the given scoring (from the selection screen) */
  startSession: (scoring: Scoring) => void;
  /** end the current session; the Quiz page returns to model selection */
  endSession: () => void;
}

export const useSession = create<SessionState>((set) => ({
  selectedModelIds: ['teapot'],
  mode: 'choice',
  scoring: 'rating',
  playing: false,
  toggleModel: (id) =>
    set((s) => ({
      selectedModelIds: s.selectedModelIds.includes(id)
        ? s.selectedModelIds.filter((m) => m !== id)
        : [...s.selectedModelIds, id],
    })),
  setSelectedModels: (selectedModelIds) => set({ selectedModelIds }),
  setMode: (mode) => set({ mode }),
  startSession: (scoring) => set({ scoring, playing: true }),
  endSession: () => set({ playing: false }),
}));
