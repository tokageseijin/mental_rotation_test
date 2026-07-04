import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Per-model authoring settings, configured on the Library page and read by the
// quiz generator + all render paths. Persisted so a model keeps its canonical
// pose/symmetry between sessions.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlaneFlags {
  xy: boolean;
  yz: boolean;
  xz: boolean;
}
export interface AxisFlags {
  x: boolean;
  y: boolean;
  z: boolean;
}

/**
 * Symmetries the object has *about the origin after its orientation+offset are
 * applied* — i.e. mirror symmetry across each coordinate plane and rotational
 * symmetry about each axis. Each is set independently. Used to gate which quiz
 * distractors are fair for the model.
 */
export interface SymmetryFlags {
  planes: PlaneFlags;
  axes: AxisFlags;
}

export interface ModelConfig {
  /** canonical orientation as global Euler degrees (baked before quiz rotation) */
  orientation: Vec3;
  /** translation in the normalised render space (shifts the rotation centre) */
  offset: Vec3;
  symmetry: SymmetryFlags;
}

export const DEFAULT_CONFIG: ModelConfig = {
  orientation: { x: 0, y: 0, z: 0 },
  offset: { x: 0, y: 0, z: 0 },
  symmetry: {
    planes: { xy: false, yz: false, xz: false },
    axes: { x: false, y: false, z: false },
  },
};

/** Deep-partial patch for a field-level update from the UI. */
export interface ModelConfigPatch {
  orientation?: Partial<Vec3>;
  offset?: Partial<Vec3>;
  symmetry?: { planes?: Partial<PlaneFlags>; axes?: Partial<AxisFlags> };
}

// Sensible per-preset defaults. The teapot is mirror-symmetric across the plane
// through its spout+handle (the XY plane), so mirror distractors are unfair for
// it — mark that plane out of the box.
const PRESET_DEFAULTS: Record<string, ModelConfigPatch> = {
  teapot: { symmetry: { planes: { xy: true } } },
};

function mergeSymmetry(...layers: Array<ModelConfigPatch['symmetry'] | undefined>): SymmetryFlags {
  const out: SymmetryFlags = {
    planes: { ...DEFAULT_CONFIG.symmetry.planes },
    axes: { ...DEFAULT_CONFIG.symmetry.axes },
  };
  for (const l of layers) {
    if (!l) continue;
    if (l.planes) out.planes = { ...out.planes, ...l.planes };
    if (l.axes) out.axes = { ...out.axes, ...l.axes };
  }
  return out;
}

function withDefaults(id: string, stored?: ModelConfig): ModelConfig {
  const preset = PRESET_DEFAULTS[id];
  return {
    orientation: { ...DEFAULT_CONFIG.orientation, ...preset?.orientation, ...stored?.orientation },
    offset: { ...DEFAULT_CONFIG.offset, ...preset?.offset, ...stored?.offset },
    symmetry: mergeSymmetry(preset?.symmetry, stored?.symmetry),
  };
}

interface ModelConfigState {
  configs: Record<string, ModelConfig>;
  /** Resolved config for a model (stored value merged over preset/global defaults). */
  getConfig: (id: string) => ModelConfig;
  /** Merge a field-level patch into a model's config. */
  setConfig: (id: string, patch: ModelConfigPatch) => void;
}

export const useModelConfig = create<ModelConfigState>()(
  persist(
    (set, get) => ({
      configs: {},
      getConfig: (id) => withDefaults(id, get().configs[id]),
      setConfig: (id, patch) =>
        set((s) => {
          const current = withDefaults(id, s.configs[id]);
          const next: ModelConfig = {
            orientation: { ...current.orientation, ...patch.orientation },
            offset: { ...current.offset, ...patch.offset },
            symmetry: mergeSymmetry(current.symmetry, patch.symmetry),
          };
          return { configs: { ...s.configs, [id]: next } };
        }),
    }),
    { name: 'mrt.modelConfig' },
  ),
);

/** True when the object has any plane (mirror) symmetry — makes a mirror unfair. */
export function hasAnyPlaneSymmetry(c: SymmetryFlags): boolean {
  return c.planes.xy || c.planes.yz || c.planes.xz;
}
