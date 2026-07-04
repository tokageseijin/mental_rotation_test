import { useMemo } from 'react';
import type * as THREE from 'three';
import type { ModelConfig } from '../store/modelConfigStore';
import { renderLocalAxes } from '../three/snapshotRenderer';

// A quarter-view render of the selected object with its local +X/+Y/+Z axes as
// coloured arrows (depth-ordered against the object). Image only — no text.
// Sized to 90% of the sample (--work-img-size). Shown below the global legend.
export function LocalAxisReference({
  object,
  config,
  label = 'ローカル座標での回転',
}: {
  object: THREE.Object3D | null;
  config?: ModelConfig;
  label?: string;
}) {
  const url = useMemo(() => (object ? renderLocalAxes(object, config) : null), [object, config]);
  if (!url) return null;
  return (
    <div className="card">
      <div className="muted" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <img className="local-axes" src={url} alt="オブジェクトのローカル座標軸" />
    </div>
  );
}
