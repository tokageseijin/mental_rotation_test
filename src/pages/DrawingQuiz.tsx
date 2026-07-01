import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { ModelEntry } from '../types';
import { useProfile } from '../store/profileStore';
import { useSettings } from '../store/settingsStore';
import { RotationLegend } from '../components/RotationLegend';
import { StepInstruction } from '../components/StepInstruction';
import { RankBadge } from '../components/RankBadge';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { generateDrawingTask, type DrawingTask } from '../quiz/generateQuestion';
import { gradeDrawing } from '../quiz/grade';
import { pickTarget } from '../quiz/target';
import { SELF_EVAL_LABELS } from '../skill/rating';

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
  const recordAttempt = useProfile((s) => s.recordAttempt);
  const maxDifficulty = useSettings((s) => s.maxDifficulty);

  const [round, setRound] = useState(0);
  const [task, setTask] = useState<DrawingTask | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [selfPicked, setSelfPicked] = useState<number | null>(null);
  const [delta, setDelta] = useState(0);
  const lastKeyRef = useRef('');

  useEffect(() => {
    if (!object) return;
    const key = `${selected.id}:${round}`;
    if (lastKeyRef.current === key) return; // dedupe StrictMode double-invoke
    lastKeyRef.current = key;
    setRevealed(false);
    setSelfPicked(null);
    setTask(generateDrawingTask(selected.id, object, pickTarget(modes.drawing.rating, maxDifficulty)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object, selected.id, round]);

  function handleSelfEval(index: number) {
    if (!task || selfPicked !== null) return;
    const graded = gradeDrawing(task, index, modes.drawing.rating);
    recordAttempt(graded.record);
    setSelfPicked(index);
    setDelta(graded.ratingAfter - graded.record.ratingBefore);
  }

  return (
    <div>
      <h1 className="page-title">クイズ・ドローイング</h1>
      <p className="page-sub">
        課題「{selected.name}」に指定の回転を加えた見え方を、キャンバスに描いてから答え合わせします。
      </p>

      {/* Same layout as 4-choice mode: 見本 + 凡例 on the left, work on the right. */}
      <div className="quiz-layout">
        <section>
          <div className="card">
            <div className="muted" style={{ marginBottom: 8 }}>
              見本（回転前・この視点で固定）
            </div>
            <div className="sample-wrap">
              {task ? (
                <img className="sample" src={task.baseImageUrl} alt="回転前の見本" />
              ) : (
                <div className="sample sample-placeholder">準備中…</div>
              )}
              <div className="sample-rank">
                <RankBadge rating={modes.drawing.rating} compact />
              </div>
            </div>
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
        </section>

        <section>
          {!task ? (
            <div className="callout">問題を生成中…</div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div className="muted" style={{ marginBottom: 6 }}>
                  加える回転操作
                </div>
                <div className="instruction">
                  {task.steps.map((s, i) => (
                    <StepInstruction key={i} index={i} step={s} />
                  ))}
                </div>
              </div>

              <div className="draw-row">
                <div className="card">
                  <div className="muted" style={{ marginBottom: 8 }}>
                    あなたのスケッチ
                  </div>
                  <DrawingCanvas key={round} />
                  <p className="muted" style={{ marginTop: 6 }}>
                    ペン（筆圧対応）・マウスで描けます。答えを見る前のメモとしてどうぞ。
                  </p>
                </div>
                {revealed && (
                  <div className="card">
                    <div className="muted" style={{ marginBottom: 8 }}>
                      正答（お手本）
                    </div>
                    <img className="sample" src={task.answerImageUrl} alt="正答" />
                  </div>
                )}
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
