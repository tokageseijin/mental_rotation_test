import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QuizMode } from '../types';

export interface SettingsState {
  defaultMode: QuizMode;
  /** upper bound (0..1) on adaptive difficulty, for gentle onboarding */
  maxDifficulty: number;
  setDefaultMode: (m: QuizMode) => void;
  setMaxDifficulty: (v: number) => void;
  replaceAll: (s: Partial<Pick<SettingsState, 'defaultMode' | 'maxDifficulty'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      defaultMode: 'choice',
      maxDifficulty: 1,
      setDefaultMode: (defaultMode) => set({ defaultMode }),
      setMaxDifficulty: (maxDifficulty) => set({ maxDifficulty }),
      replaceAll: (s) => set(s),
    }),
    { name: 'mrt.settings' },
  ),
);
