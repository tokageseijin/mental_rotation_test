import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllModels } from '../store/libraryStore';
import { useSession } from '../store/sessionStore';
import { useProfile } from '../store/profileStore';
import { useSettings } from '../store/settingsStore';
import { useProblemLog } from '../store/problemLogStore';
import { buildPersonalModel } from '../quiz/personalModel';
import { useResolvedModel } from '../hooks/useResolvedModel';
import { RotationLegend } from '../components/RotationLegend';
import { StepInstruction } from '../components/StepInstruction';
import { RankMeter } from '../components/RankMeter';
import { RotationReplay } from '../components/RotationReplay';
import { LocalAxisReference } from '../components/LocalAxisReference';
import { DrawingQuiz } from './DrawingQuiz';
import { generateQuestion, type GeneratedQuestion } from '../quiz/generateQuestion';
import { gradeChoice } from '../quiz/grade';
import { pickTarget } from '../quiz/target';
import { adaptiveK, recentPerf } from '../skill/rating';
import { DISTRACTOR_LABELS_JA } from '../skill/analysis';

export function Quiz() {
  const models = useAllModels();
  const { selectedModelId, mode } = useSession();
  const modes = useProfile((s) => s.modes);
  const history = useProfile((s) => s.history);
  const recordAttempt = useProfile((s) => s.recordAttempt);
  const logProblem = useProblemLog((s) => s.add);
  const problems = useProblemLog((s) => s.records);
  const maxDifficulty = useSettings((s) => s.maxDifficulty);

  // individual fitting: rebuilt whenever the log grows
  const personal = useMemo(() => buildPersonalModel(problems), [problems]);
  // recent performance for difficulty targeting + adaptive learning rate
  const recent = useMemo(() => recentPerf(history, 'choice'), [history]);

  const selected = models.find((m) => m.id === selectedModelId) ?? null;
  const { object, loading, needsPermission, error, reload } = useResolvedModel(selected);

  const [round, setRound] = useState(0);
  const [question, setQuestion] = useState<GeneratedQuestion | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; delta: number } | null>(null);
  const lastKeyRef = useRef<string>('');

  // (Re)generate a question whenever the model or round changes.
  useEffect(() => {
    if (!object || !selected || mode !== 'choice') return;
    const key = `${selected.id}:${round}`;
    if (lastKeyRef.current === key) return; // dedupe StrictMode double-invoke
    lastKeyRef.current = key;
    const target = pickTarget(modes.choice.rating, maxDifficulty, recent);
    setChosen(null);
    setResult(null);
    setQuestion(generateQuestion(selected.id, object, target, personal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object, selected?.id, round, mode]);

  function answer(index: number) {
    if (!question || chosen !== null) return;
    setChosen(index);
    const graded = gradeChoice(question, index, modes.choice.rating, adaptiveK(48, recent));
    recordAttempt(graded.record);
    logProblem({
      at: Date.now(),
      mode: 'choice',
      modelId: question.modelId,
      modelName: selected?.name,
      baseQ: question.baseQ.toArray() as [number, number, number, number],
      steps: question.steps,
      difficulty: question.difficulty,
      correct: graded.correct,
      options: question.options.map((o) => ({
        correct: o.correct,
        distractorCategory: o.distractorCategory,
        orientation: o.orientation,
        flipX: o.flipX,
      })),
      correctIndex: question.correctIndex,
      chosenIndex: index,
    });
    setResult({ correct: graded.correct, delta: graded.ratingAfter - graded.record.ratingBefore });
  }

  if (!selected) {
    return (
      <div>
        <h1 className="page-title">クイズ</h1>
        <div className="callout">
          モデルが選択されていません。<Link to="/">ライブラリ</Link>から選んでください。
        </div>
      </div>
    );
  }

  if (mode === 'drawing') {
    return (
      <DrawingQuiz
        selected={selected}
        object={object}
        loading={loading}
        needsPermission={needsPermission}
        error={error}
        reload={reload}
      />
    );
  }

  return (
    <div>
      <h1 className="page-title">クイズ・4択</h1>
      <p className="page-sub">
        課題「{selected.name}」に指定の回転を加えたとき、正しい見え方はどれ？
      </p>

      <div className="quiz-layout">
        <section>
          <div style={{ marginBottom: 12 }}>
            <RankMeter rating={modes.choice.rating} />
          </div>
          <div className="card">
            <div className="muted" style={{ marginBottom: 8 }}>
              {result ? '回転の再生（見本 → 正解）' : '見本（回転前）'}
            </div>
            {result && question ? (
              <RotationReplay object={object} steps={question.steps} baseQ={question.baseQ} />
            ) : (
              <>
                {question ? (
                  <img className="sample" src={question.baseImageUrl} alt="回転前の見本" />
                ) : (
                  <div className="sample sample-placeholder">準備中…</div>
                )}
              </>
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
          {!question ? (
            <div className="callout">問題を生成中…</div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div className="muted" style={{ marginBottom: 6 }}>
                  加える回転操作
                </div>
                <div className="instruction">
                  {question.steps.map((s, i) => (
                    <StepInstruction key={i} index={i} step={s} />
                  ))}
                </div>
                <div className="muted" style={{ marginTop: 8 }}>
                  難易度: {difficultyLabel(question.difficulty)}
                </div>
              </div>

              <div className="grid options">
                {question.options.map((opt, i) => {
                  const revealed = chosen !== null;
                  let cls = 'option';
                  if (revealed && opt.correct) cls += ' correct';
                  else if (revealed && i === chosen && !opt.correct) cls += ' wrong';
                  return (
                    <button key={i} className={cls} disabled={revealed} onClick={() => answer(i)}>
                      <img src={opt.imageUrl} alt={`選択肢 ${i + 1}`} />
                      <div className="label">
                        {String.fromCharCode(65 + i)}
                        {revealed && opt.correct ? '（正解）' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>

              {result && (
                <div style={{ marginTop: 16 }}>
                  <Feedback question={question} chosen={chosen!} result={result} />
                  <button
                    className="btn primary lg"
                    style={{ marginTop: 12 }}
                    onClick={() => setRound((r) => r + 1)}
                  >
                    次の問題 →
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Feedback({
  question,
  chosen,
  result,
}: {
  question: GeneratedQuestion;
  chosen: number;
  result: { correct: boolean; delta: number };
}) {
  const sign = result.delta >= 0 ? '+' : '';
  if (result.correct) {
    return (
      <div className="callout ok">
        正解！ レーティング {sign}
        {Math.round(result.delta)}
        {question.difficulty >= 0.66 && '（難しい問題をクリア）'}
      </div>
    );
  }
  const cat = question.options[chosen]?.distractorCategory;
  const easy = question.difficulty < 0.34;
  return (
    <div className="callout warn">
      不正解。 レーティング {sign}
      {Math.round(result.delta)}
      <br />
      {cat && <>間違いの傾向: <strong>{DISTRACTOR_LABELS_JA[cat]}</strong>。</>}
      {easy ? ' 易しい問題でのミスです。基礎の取りこぼしに注意。' : question.difficulty >= 0.66 ? ' 難しい問題でした。' : ''}
    </div>
  );
}

function difficultyLabel(d: number): string {
  if (d < 0.34) return `易しい (${d.toFixed(2)})`;
  if (d < 0.66) return `ふつう (${d.toFixed(2)})`;
  return `難しい (${d.toFixed(2)})`;
}
