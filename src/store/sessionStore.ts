import { create } from 'zustand';
import type { QuizMode } from '../types';

// Ephemeral UI selection shared between the Library and Quiz pages.
// Not persisted: it only matters within a session.
interface SessionState {
  selectedModelId: string | null;
  mode: QuizMode;
  setSelectedModel: (id: string) => void;
  setMode: (m: QuizMode) => void;
}

export const useSession = create<SessionState>((set) => ({
  selectedModelId: 'sm-l',
  mode: 'choice',
  setSelectedModel: (selectedModelId) => set({ selectedModelId }),
  setMode: (mode) => set({ mode }),
}));
