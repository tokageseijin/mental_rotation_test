import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QuizMode } from '../types';
import { BASE_FOV, clampFov } from '../three/renderCamera';

/** Bounds for the enjoy-mode manual controls. */
export const ENJOY_STEPS_MIN = 1;
export const ENJOY_STEPS_MAX = 4;

export interface SettingsState {
  defaultMode: QuizMode;
  /** upper bound (0..1) on adaptive difficulty, for gentle onboarding */
  maxDifficulty: number;
  /** vertical FOV (deg) used to render the quiz images (see renderCamera) */
  renderFov: number;
  /** enjoy-mode fixed difficulty target (0..1) */
  enjoyDifficulty: number;
  /** enjoy-mode fixed number of rotation operations */
  enjoyStepCount: number;
  /** auto-size the model so it never clips the frame at any rotation */
  fitRotationSafe: boolean;
  setDefaultMode: (m: QuizMode) => void;
  setMaxDifficulty: (v: number) => void;
  setRenderFov: (v: number) => void;
  setEnjoyDifficulty: (v: number) => void;
  setEnjoyStepCount: (v: number) => void;
  setFitRotationSafe: (v: boolean) => void;
  replaceAll: (
    s: Partial<
      Pick<
        SettingsState,
        | 'defaultMode'
        | 'maxDifficulty'
        | 'renderFov'
        | 'enjoyDifficulty'
        | 'enjoyStepCount'
        | 'fitRotationSafe'
      >
    >,
  ) => void;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clampSteps = (v: number) =>
  Math.max(ENJOY_STEPS_MIN, Math.min(ENJOY_STEPS_MAX, Math.round(v)));

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      defaultMode: 'choice',
      maxDifficulty: 1,
      renderFov: BASE_FOV,
      enjoyDifficulty: 0.5,
      enjoyStepCount: 2,
      fitRotationSafe: true,
      setDefaultMode: (defaultMode) => set({ defaultMode }),
      setMaxDifficulty: (maxDifficulty) => set({ maxDifficulty }),
      setRenderFov: (renderFov) => set({ renderFov: clampFov(renderFov) }),
      setEnjoyDifficulty: (v) => set({ enjoyDifficulty: clamp01(v) }),
      setEnjoyStepCount: (v) => set({ enjoyStepCount: clampSteps(v) }),
      setFitRotationSafe: (fitRotationSafe) => set({ fitRotationSafe }),
      replaceAll: (s) => set(s),
    }),
    { name: 'mrt.settings' },
  ),
);
