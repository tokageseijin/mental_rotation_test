import { useSettings, ENJOY_STEPS_MIN, ENJOY_STEPS_MAX } from '../store/settingsStore';

// Enjoy-mode manual controls, shown in place of the RankMeter (no rating there in
// enjoy mode). Two compact fields — fixed difficulty and rotation-operation count
// — laid out to roughly match the RankMeter's footprint. Changes apply from the
// next question.
export function EnjoyControls() {
  const difficulty = useSettings((s) => s.enjoyDifficulty);
  const setDifficulty = useSettings((s) => s.setEnjoyDifficulty);
  const stepCount = useSettings((s) => s.enjoyStepCount);
  const setStepCount = useSettings((s) => s.setEnjoyStepCount);

  const steps: number[] = [];
  for (let n = ENJOY_STEPS_MIN; n <= ENJOY_STEPS_MAX; n++) steps.push(n);

  return (
    <div className="enjoy-controls">
      <div className="ec-field">
        <div className="ec-label">
          <span>難易度</span>
          <span className="ec-val">{difficultyBand(difficulty)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={difficulty}
          onChange={(e) => setDifficulty(Number(e.target.value))}
        />
      </div>
      <div className="ec-field">
        <div className="ec-label">
          <span>回転操作数</span>
        </div>
        <div className="ec-steps">
          {steps.map((n) => (
            <button
              key={n}
              className={`ec-step${n === stepCount ? ' active' : ''}`}
              onClick={() => setStepCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function difficultyBand(d: number): string {
  if (d < 0.34) return `易しい ${d.toFixed(2)}`;
  if (d < 0.66) return `ふつう ${d.toFixed(2)}`;
  return `難しい ${d.toFixed(2)}`;
}
