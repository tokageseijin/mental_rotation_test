import { useSettings } from './settingsStore';
import { useProfile } from './profileStore';
import { useLibrary } from './libraryStore';

// Import / export of all user data as a single JSON file.
//
// NOTE: user-model *file contents* live in IndexedDB (as File System Access
// handles or bytes) and are NOT included here — handles cannot be transported
// to another machine. The export records model metadata so the UI can tell the
// user which files need re-linking after importing on a new device.

const EXPORT_VERSION = 1;

export interface ExportBundle {
  app: 'mental-rotation-trainer';
  version: number;
  exportedAt: number;
  settings: { defaultMode: string; maxDifficulty: number };
  profile: {
    modes: ReturnType<typeof useProfile.getState>['modes'];
    history: ReturnType<typeof useProfile.getState>['history'];
  };
  library: { userModels: ReturnType<typeof useLibrary.getState>['userModels'] };
}

export function buildExport(): ExportBundle {
  const s = useSettings.getState();
  const p = useProfile.getState();
  const l = useLibrary.getState();
  return {
    app: 'mental-rotation-trainer',
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    settings: { defaultMode: s.defaultMode, maxDifficulty: s.maxDifficulty },
    profile: { modes: p.modes, history: p.history },
    library: { userModels: l.userModels },
  };
}

export function downloadExport(): void {
  const bundle = buildExport();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mrt-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export class ImportError extends Error {}

export function applyImport(raw: unknown): void {
  const bundle = raw as Partial<ExportBundle>;
  if (!bundle || bundle.app !== 'mental-rotation-trainer') {
    throw new ImportError('このアプリのバックアップファイルではありません。');
  }
  if (typeof bundle.version !== 'number' || bundle.version > EXPORT_VERSION) {
    throw new ImportError('対応していないバージョンのバックアップです。');
  }
  if (bundle.settings) {
    useSettings.getState().replaceAll({
      defaultMode: bundle.settings.defaultMode === 'drawing' ? 'drawing' : 'choice',
      maxDifficulty: clamp01(bundle.settings.maxDifficulty ?? 1),
    });
  }
  if (bundle.profile?.modes && bundle.profile.history) {
    useProfile.getState().replaceAll({ modes: bundle.profile.modes, history: bundle.profile.history });
  }
  if (bundle.library?.userModels) {
    useLibrary.getState().replaceAll(bundle.library.userModels);
  }
}

export async function importFromFile(file: File): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new ImportError('JSONの読み込みに失敗しました。');
  }
  applyImport(parsed);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
