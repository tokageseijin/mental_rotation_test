import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModelConfig } from './modelConfigStore';

// Cache of rendered model-list thumbnails (data URLs), persisted so we don't
// re-resolve + re-render every model on each visit. A thumbnail is regenerated
// only when its signature (the config values that affect the render) changes, or
// when the user forces a refresh. Symmetry flags don't change the image, so the
// signature covers orientation + offset only.

export interface ThumbEntry {
  url: string;
  sig: string;
}

/** Signature of the render-affecting config. Same string => reuse the cache. */
export function thumbSignature(config: ModelConfig): string {
  const { orientation: o, offset: f } = config;
  return `${o.x},${o.y},${o.z}|${f.x},${f.y},${f.z}`;
}

interface ThumbnailState {
  thumbs: Record<string, ThumbEntry>;
  set: (id: string, url: string, sig: string) => void;
  /** Drop one model's cached thumbnail (forces a re-render next time it shows). */
  refresh: (id: string) => void;
  /** Drop all cached thumbnails. */
  clear: () => void;
}

export const useThumbnails = create<ThumbnailState>()(
  persist(
    (set) => ({
      thumbs: {},
      set: (id, url, sig) => set((s) => ({ thumbs: { ...s.thumbs, [id]: { url, sig } } })),
      refresh: (id) =>
        set((s) => {
          const next = { ...s.thumbs };
          delete next[id];
          return { thumbs: next };
        }),
      clear: () => set({ thumbs: {} }),
    }),
    { name: 'mrt.thumbnails' },
  ),
);
