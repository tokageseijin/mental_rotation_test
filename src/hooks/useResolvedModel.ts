import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { ModelEntry } from '../types';
import { PermissionNeededError, resolveModel } from '../three/modelLoader';

export interface ResolvedModelState {
  object: THREE.Object3D | null;
  loading: boolean;
  error: string | null;
  /** true when a persisted file handle needs the user to re-grant access */
  needsPermission: boolean;
  /** re-resolve, allowing a permission prompt (call from a user gesture) */
  reload: () => void;
}

/**
 * Resolve a library entry to a THREE.Object3D, handling FSA permission state.
 * Pass `{ enabled: false }` to skip resolution entirely (e.g. when a cached
 * thumbnail already covers this model, so its geometry never needs loading).
 */
export function useResolvedModel(
  entry: ModelEntry | null,
  options?: { enabled?: boolean },
): ResolvedModelState {
  const enabled = options?.enabled ?? true;
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [nonce, setNonce] = useState(0);
  const interactiveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!entry || !enabled) {
      setObject(null);
      setLoading(false);
      setError(null);
      setNeedsPermission(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNeedsPermission(false);
    const interactive = interactiveRef.current;
    interactiveRef.current = false;

    resolveModel(entry, interactive)
      .then((obj) => {
        if (cancelled) return;
        setObject(obj);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setObject(null);
        setLoading(false);
        if (err instanceof PermissionNeededError) setNeedsPermission(true);
        else setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id, nonce, enabled]);

  const reload = () => {
    interactiveRef.current = true;
    setNonce((n) => n + 1);
  };

  return { object, loading, error, needsPermission, reload };
}
