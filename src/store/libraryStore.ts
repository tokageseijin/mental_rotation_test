import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModelEntry } from '../types';
import { PRESETS } from '../three/presets';

// Presets are static code, so we only persist *user* models here and merge
// presets in at read time. This keeps the library list stable even if the
// preset set changes between releases.

export function presetEntries(): ModelEntry[] {
  return PRESETS.map((p) => ({
    id: p.id,
    name: p.name,
    source: 'preset',
    category: p.category,
    addedAt: 0,
  }));
}

export interface LibraryState {
  userModels: ModelEntry[];
  addUserModel: (entry: Omit<ModelEntry, 'addedAt'>) => void;
  removeUserModel: (id: string) => void;
  replaceAll: (userModels: ModelEntry[]) => void;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set) => ({
      userModels: [],
      addUserModel: (entry) =>
        set((s) => ({ userModels: [...s.userModels, { ...entry, addedAt: Date.now() }] })),
      removeUserModel: (id) => set((s) => ({ userModels: s.userModels.filter((m) => m.id !== id) })),
      replaceAll: (userModels) => set({ userModels }),
    }),
    { name: 'mrt.library' },
  ),
);

/** Combined library list (presets first, then user models). */
export function useAllModels(): ModelEntry[] {
  const userModels = useLibrary((s) => s.userModels);
  return [...presetEntries(), ...userModels];
}
