import { AXIS_LABELS } from '../three/rotation';
import { AXIS_UI_COLOR } from '../theme/axisColors';
import type { RotationStep } from '../types';

// A single rotation instruction, rendered as styled tokens rather than a flat
// string so we can emphasise the parts that matter for reading accuracy:
//  - the axis letter is coloured by axis (matches the legend)
//  - the angle is coloured by sign (+ / −) to make direction hard to misread
//  - "まわりに" is kept at the base size; the meaningful tokens are enlarged
export function StepInstruction({ index, step }: { index: number; step: RotationStep }) {
  const positive = step.angleDeg >= 0;
  const magnitude = Math.abs(step.angleDeg);
  const kind = step.type === 'global' ? 'グローバル' : 'ローカル';
  return (
    <div className="step">
      <span className="step-num">{index + 1}.</span>
      <span className="step-tokens">
        <span className="axis-letter" style={{ color: AXIS_UI_COLOR[step.axis] }}>
          {AXIS_LABELS[step.axis]}
        </span>
        <span className="unit">軸</span>
        <span className="mawari">まわりに</span>
        <span className="angle" style={{ color: positive ? 'var(--sign-plus)' : 'var(--sign-minus)' }}>
          {positive ? '+' : '−'}
          {magnitude}°
        </span>
        <span className="kind">（{kind}）</span>
      </span>
    </div>
  );
}
