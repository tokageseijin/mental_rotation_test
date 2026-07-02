import { useMemo } from 'react';
import type * as THREE from 'three';
import { renderLocalAxes } from '../three/snapshotRenderer';

// A quarter-view render of the selected object with its local +X/+Y/+Z axes as
// coloured arrows (depth-ordered against the object). Image only — no text.
// Sized to 90% of the sample (--work-img-size). Shown below the global legend.
export function LocalAxisReference({ object }: { object: THREE.Object3D | null }) {
  const url = useMemo(() => (object ? renderLocalAxes(object) : null), [object]);
  if (!url) return null;
  return (
    <div className="card">
      <div className="muted" style={{ marginBottom: 8 }}>
        ローカル座標での回転
      </div>
      <img className="local-axes" src={url} alt="オブジェクトのローカル座標軸" />
    </div>
  );
}
