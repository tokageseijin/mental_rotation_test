import { useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { ModelEntry } from '../types';
import { useProfile } from '../store/profileStore';
import { useSettings } from '../store/settingsStore';
import { useProblemLog } from '../store/problemLogStore';
import { RotationLegend } from '../components/RotationLegend';
import { StepInstruction } from '../components/StepInstruction';
import { RankMeter } from '../components/RankMeter';
import { RotationReplay } from '../components/RotationReplay';
import { LocalAxisReference } from '../components/LocalAxisReference';
import { DrawingCanvas, type DrawingCanvasHandle } from '../components/DrawingCanvas';
import { generateDrawingTask, type DrawingTask } from '../quiz/generateQuestion';
import { gradeDrawing } from '../quiz/grade';
import { pickTarget } from '../quiz/target';
import { adaptiveK, recentPerf, SELF_EVAL_LABELS } from '../skill/rating';

// Self-eval colours run good -> poor so the scale reads at a glance.
const SELF_COLORS = ['var(--ok)', '#6fae5a', '#d59a52', 'var(--bad)'];

interface Props {
  selected: ModelEntry;
  object: THREE.Object3D | null;
  loading: boolean;
  needsPermission: boolean;
  error: string | null;
  reload: () => void;
}

export function DrawingQuiz({ selected, object, loading, needsPermission, error, reload }: Props) {
  const modes = useProfile((s) => s.modes);
  const history = useProfile((s) => s.history);
  const recordAttempt = useProfile((s) => s.recordAttempt);
  const logProblem = useProblemLog((s) => s.add);
  const maxDifficulty = useSettings((s) => s.maxDifficulty);
  const recent = useMemo(() => recentPerf(history, 'drawing'), [history]);

  const [round, setRound] = useState(0);
  const [task, setTask] = useState<DrawingTask | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [selfPicked, setSelfPicked] = useState<number | null>(null);
  const [delta, setDelta] = useState(0);
  const lastKeyRef = useRef('');
  const canvasRef = useRef<DrawingCanvasHandle>(null);

  useEffect(() => {
    if (!object) return;
    const key = `${selected.id}:${round}`;
    if (lastKeyRef.current === key) return; // dedupe StrictMode double-invoke
    lastKeyRef.current = key;
    setRevealed(false);
    setSelfPicked(null);
    setTask(generateDrawingTask(selected.id, object, pickTarget(modes.drawing.rating, maxDifficulty, recent)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object, selected.id, round]);

  function handleSelfEval(index: number) {
    if (!task || selfPicked !== null) return;
    const graded = gradeDrawing(task, index, modes.drawing.rating, adaptiveK(36, recent));
    recordAttempt(graded.record);
    logProblem({
      at: Date.now(),
      mode: 'drawing',
      modelId: task.modelId,
      modelName: selected.name,
      baseQ: task.baseQ.toArray() as [number, number, number, number],
      steps: task.steps,
      difficulty: task.difficulty,
      correct: graded.correct,
      selfRating: index,
    });
    setSelfPicked(index);
    setDelta(graded.ratingAfter - graded.record.ratingBefore);
  }

  return (
    <div>
      <h1 className="page-title">クイズ・ドローイング</h1>
      <p className="page-sub">課題オブジェクトに指定の回転を加えたときの正しい見え方を描く。</p>

      {/* Same layout as 4-choice mode: 見本 + 凡例 on the left, work on the right. */}
      <div className="quiz-layout">
        <section>
          <div style={{ marginBottom: 12 }}>
            <RankMeter rating={modes.drawing.rating} />
          </div>
          <div className="card">
            <div className="muted" style={{ marginBottom: 8 }}>
              {revealed ? '回転の再生（見本 → 正解）' : '見本（回転前）'}
            </div>
            {revealed && task ? (
              <RotationReplay object={object} steps={task.steps} baseQ={task.baseQ} />
            ) : task ? (
              <img className="sample" src={task.baseImageUrl} alt="回転前の見本" />
            ) : (
              <div className="sample sample-placeholder">準備中…</div>
            )}
          </div>
          {loading && <p className="muted">読み込み中…</p>}
          {needsPermission && (
            <div className="callout warn" style={{ marginTop: 12 }}>
              ファイルへのアクセス許可が必要です。
              <button className="btn" style={{ marginLeft: 8 }} onClick={reload}>
                アクセスを許可
              </button>
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
          <div style={{ marginTop: 16 }}>
            <RotationLegend />
          </div>
          <div style={{ marginTop: 16 }}>
            <LocalAxisReference object={object} />
          </div>
        </section>

        <section>
          {!task ? (
            <div className="callout">問題を生成中…</div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div className="quiz-heading">
                  見本画像に以下の回転操作を加えたときの答えをドローイングする。
                </div>
                <div className="instruction">
                  {task.steps.map((s, i) => (
                    <StepInstruction key={i} index={i} step={s} />
                  ))}
                </div>
              </div>

              <div className="draw-row">
                <div className="card">
                  <div className="row" style={{ marginBottom: 8 }}>
                    <span className="muted">あなたのスケッチ</span>
                    <span className="spacer" />
                    <button className="tb-btn" onClick={() => canvasRef.current?.clear()}>
                      全消し
                    </button>
                  </div>
                  <DrawingCanvas key={round} ref={canvasRef} />
                  <p className="muted" style={{ marginTop: 6 }}>
                    ペン・マウスに対応
                  </p>
                </div>
                {/* answer slot is always present (reserved) so the canvas size
                    stays stable; it holds the answer once revealed. */}
                <div className="card">
                  <div className="muted" style={{ marginBottom: 8 }}>
                    正答（お手本）
                  </div>
                  {revealed ? (
                    <img className="sample" src={task.answerImageUrl} alt="正答" />
                  ) : (
                    <div className="sample sample-placeholder">答え合わせ後に表示</div>
                  )}
                </div>
              </div>

              {!revealed ? (
                <button className="btn primary lg" style={{ marginTop: 16 }} onClick={() => setRevealed(true)}>
                  描けたら答え合わせ →
                </button>
              ) : (
                <>
                  <div style={{ marginTop: 20 }}>
                    <div className="muted" style={{ marginBottom: 8 }}>
                      自己評価（お手本と比べてどうでしたか？）
                    </div>
                    <div className="self-eval">
                      {SELF_EVAL_LABELS.map((label, i) => (
                        <button
                          key={i}
                          className="btn"
                          disabled={selfPicked !== null}
                          onClick={() => handleSelfEval(i)}
                          style={
                            selfPicked === i
                              ? { borderColor: SELF_COLORS[i], color: '#fff', background: SELF_COLORS[i] }
                              : { borderColor: SELF_COLORS[i], color: SELF_COLORS[i] }
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selfPicked !== null && (
                    <div style={{ marginTop: 20 }}>
                      <div className="callout ok">
                        記録しました。レーティング {delta >= 0 ? '+' : ''}
                        {Math.round(delta)}
                      </div>
                      <button className="btn primary lg" style={{ marginTop: 12 }} onClick={() => setRound((r) => r + 1)}>
                        次の問題 →
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
