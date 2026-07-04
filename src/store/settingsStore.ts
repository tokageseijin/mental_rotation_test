import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QuizMode } from '../types';
import { BASE_FOV, clampFov } from '../three/renderCamera';

export interface SettingsState {
  defaultMode: QuizMode;
  /** upper bound (0..1) on adaptive difficulty, for gentle onboarding */
  maxDifficulty: number;
  /** vertical FOV (deg) used to render the quiz images (see renderCamera) */
  renderFov: number;
  setDefaultMode: (m: QuizMode) => void;
  setMaxDifficulty: (v: number) => void;
  setRenderFov: (v: number) => void;
  replaceAll: (
    s: Partial<Pick<SettingsState, 'defaultMode' | 'maxDifficulty' | 'renderFov'>>,
  ) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      defaultMode: 'choice',
      maxDifficulty: 1,
      renderFov: BASE_FOV,
      setDefaultMode: (defaultMode) => set({ defaultMode }),
      setMaxDifficulty: (maxDifficulty) => set({ maxDifficulty }),
      setRenderFov: (renderFov) => set({ renderFov: clampFov(renderFov) }),
      replaceAll: (s) => set(s),
    }),
    { name: 'mrt.settings' },
  ),
);
