import { useMemo, useState } from 'react';
import type { QuizMode } from '../types';
import { useProfile } from '../store/profileStore';
import { useProblemLog } from '../store/problemLogStore';
import { RankBadge } from '../components/RankBadge';
import { bucketAccuracy, summarize, type Bucket } from '../skill/analysis';
import { aggregateAttribution } from '../quiz/errorModels';

export function Stats() {
  const modes = useProfile((s) => s.modes);
  const history = useProfile((s) => s.history);
  const problems = useProblemLog((s) => s.records);
  const [mode, setMode] = useState<QuizMode>('choice');

  const attempts = useMemo(() => history.filter((h) => h.mode === mode), [history, mode]);
  const summary = useMemo(() => summarize(attempts), [attempts]);
  // Probabilistic error attribution is derived from the full problem log
  // (choice mode only — drawing has no options to attribute).
  const attribution = useMemo(
    () => aggregateAttribution(problems.filter((p) => p.mode === 'choice')),
    [problems],
  );

  return (
    <div>
      <h1 className="page-title">成績</h1>
      <p className="page-sub">正答率と誤答の傾向から、どこでつまずいているかを可視化します。</p>

      <div className="row" style={{ marginBottom: 20 }}>
        <button className={`btn${mode === 'choice' ? ' primary' : ''}`} onClick={() => setMode('choice')}>
          4択モード
        </button>
        <button className={`btn${mode === 'drawing' ? ' primary' : ''}`} onClick={() => setMode('drawing')}>
          ドローイングモード
        </button>
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="muted" style={{ marginBottom: 8 }}>
            現在のランク（{mode === 'choice' ? '4択' : 'ドローイング'}）
          </div>
          <RankBadge rating={modes[mode].rating} />
          <div style={{ marginTop: 16 }} className="muted">
            回答数: {summary.totalAttempts} ／ 総合正答率: {pct(summary.overallAccuracy)}
          </div>
        </div>

        <div className="card">
          <div className="muted" style={{ marginBottom: 8 }}>
            つまずきの要約
          </div>
          {summary.totalAttempts === 0 ? (
            <p className="muted">まだデータがありません。クイズに挑戦してみましょう。</p>
          ) : (
            <>
              <div className="callout warn" style={{ marginBottom: 8 }}>
                易しいのに間違えた: <strong>{summary.easyMisses}</strong> 回
              </div>
              <div className="callout" style={{ marginBottom: 8 }}>
                難しくて間違えた: <strong>{summary.hardMisses}</strong> 回
              </div>
              {summary.mistakeRanking[0] && (
                <div className="callout">
                  最も多い誤答: <strong>{summary.mistakeRanking[0].label}</strong>（
                  {summary.mistakeRanking[0].count}回）
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {summary.totalAttempts > 0 && (
        <>
          <BarGroup title="回転の種類別 正答率" buckets={summary.byRotationType} />
          <BarGroup title="回転軸の数別 正答率" buckets={summary.byAxisCount} />
          <BarGroup title="難易度帯別 正答率" buckets={summary.byDifficulty} />

          {mode === 'choice' && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="muted" style={{ marginBottom: 8 }}>
                誤りの傾向（推定）— 何を取り違えやすいか
              </div>
              {attribution.count === 0 ? (
                <p className="muted">誤答データはありません。</p>
              ) : (
                <>
                  {attribution.breakdown
                    .filter((b) => b.fraction > 0.005)
                    .map((b) => (
                      <div key={b.category} className="bar-row">
                        <span>{b.label}</span>
                        <div className="bar">
                          <span style={{ width: `${b.fraction * 100}%`, background: 'var(--bad)' }} />
                        </div>
                        <span>{pct(b.fraction)}</span>
                      </div>
                    ))}
                  <p className="muted" style={{ marginTop: 8 }}>
                    ※ 同じ誤答が複数の原因に当てはまることがあるため、確率的に按分した推定値です（{attribution.count}件の誤答から）。
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BarGroup({ title, buckets }: { title: string; buckets: Bucket[] }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="muted" style={{ marginBottom: 8 }}>
        {title}
      </div>
      {buckets.filter((b) => b.total > 0).length === 0 ? (
        <p className="muted">データなし</p>
      ) : (
        buckets
          .filter((b) => b.total > 0)
          .map((b) => (
            <div key={b.label} className="bar-row">
              <span>{b.label}</span>
              <div className="bar">
                <span style={{ width: `${bucketAccuracy(b) * 100}%` }} />
              </div>
              <span>{pct(bucketAccuracy(b))}</span>
            </div>
          ))
      )}
    </div>
  );
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
