import { useRef, useState } from 'react';
import { useSettings } from '../store/settingsStore';
import { useProfile } from '../store/profileStore';
import { downloadExport, importFromFile } from '../store/persistence';

export function Settings() {
  const { defaultMode, maxDifficulty, setDefaultMode, setMaxDifficulty } = useSettings();
  const resetProfile = useProfile((s) => s.reset);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

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
        <p className="muted" style={{ marginTop: 4 }}>ランクと回答履歴をすべて消去します（元に戻せません）。</p>
        <button
          className="btn"
          style={{ marginTop: 8, borderColor: 'var(--bad)', color: 'var(--bad)' }}
          onClick={() => {
            if (confirm('成績とランクをすべてリセットしますか？')) {
              resetProfile();
              setMsg({ kind: 'ok', text: '成績をリセットしました。' });
            }
          }}
        >
          成績をリセット
        </button>
      </div>
    </div>
  );
}
