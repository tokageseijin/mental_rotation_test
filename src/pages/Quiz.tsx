import { useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { ModelEntry, QuizMode } from '../types';
import { useAllModels } from '../store/libraryStore';
import { useSession, type Scoring } from '../store/sessionStore';
import { confirmLeaveQuiz } from '../quiz/leaveGuard';
import { useProfile } from '../store/profileStore';
import { useSettings } from '../store/settingsStore';
import { useProblemLog } from '../store/problemLogStore';
import { useModelConfig, type ModelConfig } from '../store/modelConfigStore';
import { buildPersonalModel } from '../quiz/personalModel';
import { useResolvedModel } from '../hooks/useResolvedModel';
import { RotationLegend } from '../components/RotationLegend';
import { StepInstruction } from '../components/StepInstruction';
import { RankMeter } from '../components/RankMeter';
import { EnjoyControls } from '../components/EnjoyControls';
import { RotationReplay } from '../components/RotationReplay';
import { LocalAxisReference } from '../components/LocalAxisReference';
import { ModelThumbnail } from '../components/ModelThumbnail';
import { DrawingQuiz } from './DrawingQuiz';
import { generateQuestion, type GeneratedQuestion } from '../quiz/generateQuestion';
import { gradeChoice } from '../quiz/grade';
import { pickTarget } from '../quiz/target';
import { adaptiveK, recentPerf } from '../skill/rating';
import { DISTRACTOR_LABELS_JA } from '../skill/analysis';

const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// The Quiz page has two phases: pick the set of models to be quizzed on, then
// (on Start) play in-place. Each round draws one model at random from the set.
// Play/scoring state lives in the session store so leaving (here or via the
// sidebar) can confirm + reset the session consistently.
export function Quiz() {
  const playing = useSession((s) => s.playing);
  const selectedModelIds = useSession((s) => s.selectedModelIds);

  if (playing && selectedModelIds.length > 0) {
    return <QuizPlay />;
  }
  return <QuizSelect />;
}

// --- selection phase --------------------------------------------------------

function QuizSelect() {
  const models = useAllModels();
  const selectedModelIds = useSession((s) => s.selectedModelIds);
  const toggleModel = useSession((s) => s.toggleModel);
  const mode = useSession((s) => s.mode);
  const setMode = useSession((s) => s.setMode);
  const startSession = useSession((s) => s.startSession);
  const count = selectedModelIds.length;

  return (
    <div className="quiz-select">
      <h1 className="page-title">クイズ</h1>
      <p className="page-sub">出題するオブジェクトを選んでスタートします（複数選択可・各問でランダムに出題）。</p>

      <div className="grid models quiz-select-grid">
        {models.map((m) => {
          const on = selectedModelIds.includes(m.id);
          return (
            <div
              key={m.id}
              className={`model-card${on ? ' selected' : ''}`}
              onClick={() => toggleModel(m.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && toggleModel(m.id)}
            >
              <div className="thumb">
                <ModelThumbnail entry={m} />
                {on && <span className="check-badge">✓</span>}
              </div>
              <div className="meta">
                <div className="name">{m.name}</div>
                <div className="tag">
                  {m.source === 'preset' ? (m.category === 'abstract' ? '抽象' : '具象') : 'ユーザー'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {count > 0 && (
        <div className="bottom-bar">
          <div className="bb-count">
            <strong>{count}</strong> 件を選択中
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
          <div className="bb-start">
            <button
              className="btn primary lg"
              title="結果がレーティングに反映されます"
              onClick={() => startSession('rating')}
            >
              レーティングで開始 →
            </button>
            <button
              className="btn lg"
              title="レートは変動しません。新しいオブジェクトの練習用"
              onClick={() => startSession('enjoy')}
            >
              エンジョイで開始 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: QuizMode; onChange: (m: QuizMode) => void }) {
  return (
    <div className="row" style={{ flexWrap: 'nowrap' }}>
      <button className={`btn${mode === 'choice' ? ' primary' : ''}`} onClick={() => onChange('choice')}>
        4択
      </button>
      <button className={`btn${mode === 'drawing' ? ' primary' : ''}`} onClick={() => onChange('drawing')}>
        ドローイング
      </button>
    </div>
  );
}

// --- play phase -------------------------------------------------------------

function QuizPlay() {
  const models = useAllModels();
  const selectedModelIds = useSession((s) => s.selectedModelIds);
  const mode = useSession((s) => s.mode);
  const scoring = useSession((s) => s.scoring);
  const endSession = useSession((s) => s.endSession);
  const getConfig = useModelConfig((s) => s.getConfig);

  // each round draws a model from the selected set
  const [round, setRound] = useState(0);
  const [currentId, setCurrentId] = useState(() => pickRandom(selectedModelIds));

  const entry = models.find((m) => m.id === currentId) ?? models.find((m) => m.id === selectedModelIds[0]) ?? null;
  // key on the id string (entry is a fresh object each render) so the config
  // reference stays stable per round and doesn't re-trigger the WebGL renders.
  const config = useMemo(() => (entry ? getConfig(entry.id) : undefined), [getConfig, entry?.id]);
  const resolved = useResolvedModel(entry);

  const next = () => {
    setCurrentId(pickRandom(selectedModelIds));
    setRound((r) => r + 1);
  };

  const leave = () => {
    if (confirmLeaveQuiz()) endSession();
  };

  const backBtn = (
    <div className="play-head">
      <button className="btn" onClick={leave}>
        ← 終了して選択に戻る
      </button>
      <span className={`scoring-badge${scoring === 'enjoy' ? ' enjoy' : ''}`}>
        {scoring === 'enjoy' ? 'エンジョイ（レート変動なし）' : 'レーティング'}
      </span>
    </div>
  );

  if (!entry) {
    return (
      <div>
        {backBtn}
        <div className="callout">モデルが選択されていません。</div>
      </div>
    );
  }

  if (mode === 'drawing') {
    return (
      <div>
        {backBtn}
        <DrawingQuiz
          selected={entry}
          object={resolved.object}
          config={config}
          scoring={scoring}
          round={round}
          onNext={next}
          loading={resolved.loading}
          needsPermission={resolved.needsPermission}
          error={resolved.error}
          reload={resolved.reload}
        />
      </div>
    );
  }

  return (
    <div>
      {backBtn}
      <ChoiceGame
        selected={entry}
        object={resolved.object}
        config={config}
        scoring={scoring}
        round={round}
        onNext={next}
        loading={resolved.loading}
        needsPermission={resolved.needsPermission}
        error={resolved.error}
        reload={resolved.reload}
      />
    </div>
  );
}

interface GameProps {
  selected: ModelEntry;
  object: THREE.Object3D | null;
  config?: ModelConfig;
  scoring: Scoring;
  round: number;
  onNext: () => void;
  loading: boolean;
  needsPermission: boolean;
  error: string | null;
  reload: () => void;
}

function ChoiceGame({
  selected,
  object,
  config,
  scoring,
  round,
  onNext,
  loading,
  needsPermission,
  error,
  reload,
}: GameProps) {
  const modes = useProfile((s) => s.modes);
  const history = useProfile((s) => s.history);
  const recordAttempt = useProfile((s) => s.recordAttempt);
  const logProblem = useProblemLog((s) => s.add);
  const problems = useProblemLog((s) => s.records);
  const maxDifficulty = useSettings((s) => s.maxDifficulty);
  const renderFov = useSettings((s) => s.renderFov);
  const enjoyDifficulty = useSettings((s) => s.enjoyDifficulty);
  const enjoyStepCount = useSettings((s) => s.enjoyStepCount);
  const fitRotationSafe = useSettings((s) => s.fitRotationSafe);

  const personal = useMemo(() => buildPersonalModel(problems), [problems]);
  const recent = useMemo(() => recentPerf(history, 'choice'), [history]);

  const [question, setQuestion] = useState<GeneratedQuestion | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; delta: number } | null>(null);
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    if (!object) return;
    const key = `${selected.id}:${round}`;
    if (lastKeyRef.current === key) return; // dedupe StrictMode double-invoke
    lastKeyRef.current = key;
    const enjoy = scoring === 'enjoy';
    const target = enjoy ? enjoyDifficulty : pickTarget(modes.choice.rating, maxDifficulty, recent);
    const overrides = enjoy ? { stepCount: enjoyStepCount } : undefined;
    setChosen(null);
    setResult(null);
    setQuestion(
      generateQuestion(selected.id, object, target, personal, config, { fov: renderFov, rotationSafe: fitRotationSafe }, overrides),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object, selected.id, round]);

  function answer(index: number) {
    if (!question || chosen !== null) return;
    setChosen(index);
    const graded = gradeChoice(question, index, modes.choice.rating, adaptiveK(48, recent));
    // Enjoy mode is pure practice: grade for feedback, but don't touch rating,
    // history, or the problem log so a rough warm-up can't hurt your standing.
    if (scoring === 'rating') {
      recordAttempt(graded.record);
      logProblem({
        at: Date.now(),
        mode: 'choice',
        modelId: question.modelId,
        modelName: selected.name,
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
    }
    const delta = scoring === 'rating' ? graded.ratingAfter - graded.record.ratingBefore : 0;
    setResult({ correct: graded.correct, delta });
  }

  return (
    <div>
      <h1 className="page-title">クイズ・4択</h1>
      <p className="page-sub">課題オブジェクトに指定の回転を加えたときの正しい見え方を選ぶ。（{selected.name}）</p>

      <div className="quiz-layout">
        <section>
          <div style={{ marginBottom: 12 }}>
            {scoring === 'enjoy' ? <EnjoyControls /> : <RankMeter rating={modes.choice.rating} />}
          </div>
          <div className="card">
            <div className="muted" style={{ marginBottom: 8 }}>
              {result ? '回転の再生（見本 → 正解）' : '見本（回転前）'}
            </div>
            {result && question ? (
              <RotationReplay
                object={object}
                steps={question.steps}
                baseQ={question.baseQ}
                config={config}
                fov={renderFov}
                rotationSafe={fitRotationSafe}
              />
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
            <LocalAxisReference object={object} config={config} />
          </div>
        </section>

        <section>
          {!question ? (
            <div className="callout">問題を生成中…</div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div className="quiz-heading">
                  見本画像に以下の回転操作を加えたときの答えを、以下の4択から選択する。
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

              {/* reserved so the layout doesn't shift when the answer is revealed */}
              <div className="quiz-actions">
                {result && (
                  <>
                    <Feedback question={question} chosen={chosen!} result={result} scoring={scoring} />
                    <button className="btn primary lg" style={{ marginTop: 12 }} onClick={onNext}>
                      次の問題 →
                    </button>
                  </>
                )}
              </div>
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
  scoring,
}: {
  question: GeneratedQuestion;
  chosen: number;
  result: { correct: boolean; delta: number };
  scoring: Scoring;
}) {
  const sign = result.delta >= 0 ? '+' : '';
  const ratingText = scoring === 'enjoy' ? 'レート変動なし' : `レーティング ${sign}${Math.round(result.delta)}`;
  if (result.correct) {
    return (
      <div className="callout ok">
        正解！ {ratingText}
        {question.difficulty >= 0.66 && '（難しい問題をクリア）'}
      </div>
    );
  }
  const cat = question.options[chosen]?.distractorCategory;
  const easy = question.difficulty < 0.34;
  return (
    <div className="callout warn">
      不正解。 {ratingText}
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
