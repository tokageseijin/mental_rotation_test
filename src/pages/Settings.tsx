import { useRef, useState } from 'react';
import { useSettings } from '../store/settingsStore';
import { useProfile } from '../store/profileStore';
import { useProblemLog } from '../store/problemLogStore';
import { useThumbnails } from '../store/thumbnailStore';
import { downloadExport, importFromFile } from '../store/persistence';
import { FOV_MIN, FOV_MAX } from '../three/renderCamera';

export function Settings() {
  const {
    defaultMode,
    maxDifficulty,
    renderFov,
    fitRotationSafe,
    setDefaultMode,
    setMaxDifficulty,
    setRenderFov,
    setFitRotationSafe,
  } = useSettings();
  const resetProfile = useProfile((s) => s.reset);
  const resetRanks = useProfile((s) => s.resetRanks);
  const problemLog = useProblemLog((s) => s.records);
  const clearProblemLog = useProblemLog((s) => s.clear);
  const clearThumbnails = useThumbnails((s) => s.clear);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  function exportProblemLog() {
    const blob = new Blob([JSON.stringify(problemLog, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mrt-problem-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await importFromFile(file);
      setMsg({ kind: 'ok', text: 'インポートが完了しました。' });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div>
      <h1 className="page-title">設定</h1>
      <p className="page-sub">設定とユーザーデータはブラウザ内に保存されます。バックアップの書き出し・読み込みも可能です。</p>

      <div className="card" style={{ maxWidth: 560 }}>
        <label className="field" htmlFor="defmode">
          既定の回答モード
        </label>
        <select
          id="defmode"
          className="btn"
          value={defaultMode}
          onChange={(e) => setDefaultMode(e.target.value === 'drawing' ? 'drawing' : 'choice')}
        >
          <option value="choice">4択で答える</option>
          <option value="drawing">ドローイングで答える</option>
        </select>

        <label className="field" htmlFor="maxdiff" style={{ marginTop: 20 }}>
          難易度の上限: {Math.round(maxDifficulty * 100)}%
        </label>
        <input
          id="maxdiff"
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={maxDifficulty}
          style={{ width: '100%' }}
          onChange={(e) => setMaxDifficulty(Number(e.target.value))}
        />
        <p className="muted">出題される問題の難しさに上限を設けます。慣れるまで低めがおすすめです。</p>

        <label className="field" htmlFor="fov" style={{ marginTop: 20 }}>
          レンダリングの画角（FOV）: {Math.round(renderFov)}°
        </label>
        <input
          id="fov"
          type="range"
          min={FOV_MIN}
          max={FOV_MAX}
          step={1}
          value={renderFov}
          style={{ width: '100%' }}
          onChange={(e) => setRenderFov(Number(e.target.value))}
        />
        <p className="muted">
          クイズの見本・選択肢・回転再生を描くカメラの画角です。小さいほど遠近感が弱く（望遠寄りで平ら）、
          大きいほど強くなります。被写体の大きさは一定に保たれます。既定は35°。
        </p>

        <label className="check" style={{ marginTop: 20 }}>
          <input
            type="checkbox"
            checked={fitRotationSafe}
            onChange={(e) => setFitRotationSafe(e.target.checked)}
          />
          回転してもはみ出さないよう表示サイズを自動調整
        </label>
        <p className="muted">
          どの角度に回転してもモデルがフレーム外に出ないよう、現在の画角に合わせて表示サイズを自動で縮めます。
          オフにすると従来どおり最大辺基準（大きく表示されますが、回転ではみ出すことがあります）。
        </p>
      </div>

      <div className="card" style={{ maxWidth: 560, marginTop: 16 }}>
        <strong>データのバックアップ</strong>
        <p className="muted" style={{ marginTop: 4 }}>
          設定・成績・ランク・モデル一覧（メタ情報）を1つのJSONに書き出します。
          ※ユーザーが追加したモデルのファイル内容自体は端末内に残るため、別端末では再リンクが必要です。
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => downloadExport()}>
            エクスポート
          </button>
          <button className="btn" onClick={() => importRef.current?.click()}>
            インポート
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
        </div>
        {msg && <p className={msg.kind === 'ok' ? 'callout ok' : 'error-text'} style={{ marginTop: 8 }}>{msg.text}</p>}
      </div>

      <div className="card" style={{ maxWidth: 560, marginTop: 16 }}>
        <strong>成績のリセット</strong>
        <p className="muted" style={{ marginTop: 4 }}>いずれも元に戻せません。</p>
        <div className="row" style={{ marginTop: 8 }}>
          <button
            className="btn"
            style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}
            onClick={() => {
              if (confirm('ランクと経験値だけをリセットしますか？（回答履歴・問題ログは残ります）')) {
                resetRanks();
                setMsg({ kind: 'ok', text: 'ランク・経験値をリセットしました。' });
              }
            }}
          >
            ランク・経験値のみリセット
          </button>
          <button
            className="btn"
            style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}
            onClick={() => {
              if (confirm('ランク・経験値・回答履歴をすべてリセットしますか？')) {
                resetProfile();
                setMsg({ kind: 'ok', text: '成績をすべてリセットしました。' });
              }
            }}
          >
            成績をすべてリセット
          </button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          ※「すべてリセット」は回答履歴も消えます（成績ページの集計が空になります）。問題ログは別途「問題ログを削除」から。
        </p>
      </div>

      <div className="card" style={{ maxWidth: 560, marginTop: 16 }}>
        <strong>サムネイル</strong>
        <p className="muted" style={{ marginTop: 4 }}>
          モデル一覧のサムネイルはキャッシュされ、向き・オフセットを変えたときに自動で作り直されます。
          リセットすると全モデルのサムネイルを次回表示時に再生成します。
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          <button
            className="btn"
            onClick={() => {
              clearThumbnails();
              setMsg({ kind: 'ok', text: 'サムネイルをリセットしました。' });
            }}
          >
            サムネイルをリセット
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560, marginTop: 16 }}>
        <strong>問題ログ</strong>
        <p className="muted" style={{ marginTop: 4 }}>
          出題内容（初期姿勢・回転・選択肢）と回答の記録。最新 {problemLog.length} / 500 件を保存中。
          分析用にJSONで書き出せます。
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={exportProblemLog} disabled={problemLog.length === 0}>
            問題ログを書き出し
          </button>
          <button
            className="btn"
            style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}
            disabled={problemLog.length === 0}
            onClick={() => {
              if (confirm('問題ログをすべて削除しますか？')) {
                clearProblemLog();
                setMsg({ kind: 'ok', text: '問題ログを削除しました。' });
              }
            }}
          >
            問題ログを削除
          </button>
        </div>
      </div>
    </div>
  );
}
