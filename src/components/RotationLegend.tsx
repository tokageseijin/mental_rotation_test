import { useMemo } from 'react';
import { renderAxisLegend } from '../three/snapshotRenderer';
import { AXIS_UI_COLOR } from '../theme/axisColors';

// Axis / rotation-direction key for the quiz. The gizmo is rendered with the
// same 3D engine and a near-identical camera to the option images, so "+Y" here
// means the same thing as "+Y" in the rotation instruction.
export function RotationLegend() {
  const url = useMemo(() => renderAxisLegend(), []);
  return (
    <div className="card" style={{ padding: 'var(--sp-3)' }}>
      <div className="muted" style={{ marginBottom: 6 }}>
        グローバル座標での回転
      </div>
      <div className="row" style={{ alignItems: 'center', gap: 'var(--sp-4)', flexWrap: 'nowrap' }}>
        <img
          src={url}
          width={128}
          height={128}
          alt="3軸と各軸まわりの正の回転方向"
          style={{ background: '#fff', borderRadius: 8, flexShrink: 0 }}
        />
        <div style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.7 }}>
          <div>
            <Swatch c={AXIS_UI_COLOR.x} /> X軸（左右）
          </div>
          <div>
            <Swatch c={AXIS_UI_COLOR.y} /> Y軸（上下）
          </div>
          <div>
            <Swatch c={AXIS_UI_COLOR.z} /> Z軸（奥行き・手前が＋）
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            曲がった矢印＝各軸まわりの<strong>＋方向</strong>（右手系）。−は逆回り。
          </div>
        </div>
      </div>
    </div>
  );
}

function Swatch({ c }: { c: string }) {
  return (
    <span
      aria-hidden
      style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: c, marginRight: 6 }}
    />
  );
}
