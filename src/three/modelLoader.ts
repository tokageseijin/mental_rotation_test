import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { get, set, del } from 'idb-keyval';
import type { ModelEntry } from '../types';
import { getPreset } from './presets';

// User models are loaded via the File System Access API where available: we
// persist a FileSystemFileHandle in IndexedDB so the library "remembers" the
// file across sessions. Browsers without the API fall back to storing bytes.

const gltfLoader = new GLTFLoader();

export function isFsaSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

type StoredModel =
  | { kind: 'handle'; handle: FileSystemFileHandle; name: string }
  | { kind: 'bytes'; bytes: ArrayBuffer; name: string };

const dbKey = (id: string) => `model:${id}`;

/** Raised when a persisted handle needs the user to re-grant read permission. */
export class PermissionNeededError extends Error {
  constructor() {
    super('ファイルへのアクセス許可が必要です');
    this.name = 'PermissionNeededError';
  }
}

export interface PickedModel {
  entry: Omit<ModelEntry, 'addedAt'>;
}

/** Prompt the user to choose a .glb/.gltf file and persist it. */
export async function pickAndStoreModel(): Promise<PickedModel> {
  const id = crypto.randomUUID();
  if (isFsaSupported()) {
    const [handle] = await window.showOpenFilePicker!({
      multiple: false,
      types: [
        { description: '3D model', accept: { 'model/gltf-binary': ['.glb'], 'model/gltf+json': ['.gltf'] } },
      ],
    });
    const name = handle.name;
    await set(dbKey(id), { kind: 'handle', handle, name } satisfies StoredModel);
    return { entry: { id, name, source: 'user', storageMode: 'handle' } };
  }
  // fallback: <input type=file> path -> caller passes a File to storeFileBytes
  throw new Error('FSA_UNSUPPORTED');
}

/** Fallback for browsers without File System Access: store the raw bytes. */
export async function storeFileBytes(file: File): Promise<PickedModel> {
  const id = crypto.randomUUID();
  const bytes = await file.arrayBuffer();
  await set(dbKey(id), { kind: 'bytes', bytes, name: file.name } satisfies StoredModel);
  return { entry: { id, name: file.name, source: 'user', storageMode: 'bytes' } };
}

async function verifyPermission(handle: FileSystemFileHandle): Promise<boolean> {
  if (!handle.queryPermission) return true;
  const opts = { mode: 'read' as const };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if (handle.requestPermission && (await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

async function bytesForUserModel(id: string, interactive: boolean): Promise<ArrayBuffer> {
  const stored = (await get(dbKey(id))) as StoredModel | undefined;
  if (!stored) throw new Error('保存されたモデルが見つかりません');
  if (stored.kind === 'bytes') return stored.bytes;
  // handle: re-check permission. requestPermission must run in a user gesture,
  // so when `interactive` is false we surface a PermissionNeededError instead.
  const granted = interactive
    ? await verifyPermission(stored.handle)
    : (await stored.handle.queryPermission?.({ mode: 'read' })) === 'granted' ||
      !stored.handle.queryPermission;
  if (!granted) throw new PermissionNeededError();
  const file = await stored.handle.getFile();
  return file.arrayBuffer();
}

function parseGltf(bytes: ArrayBuffer): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    gltfLoader.parse(
      bytes,
      '',
      (gltf) => resolve(gltf.scene),
      (err) => reject(err),
    );
  });
}

/**
 * Resolve a library entry to a fresh THREE.Object3D.
 * `interactive` should be true when called directly from a user gesture so a
 * permission prompt is allowed.
 */
export async function resolveModel(entry: ModelEntry, interactive = false): Promise<THREE.Object3D> {
  if (entry.source === 'preset') {
    const preset = getPreset(entry.id);
    if (!preset) throw new Error(`プリセットが見つかりません: ${entry.id}`);
    return preset.build();
  }
  const bytes = await bytesForUserModel(entry.id, interactive);
  return parseGltf(bytes);
}

export async function deleteUserModel(id: string): Promise<void> {
  await del(dbKey(id));
}
