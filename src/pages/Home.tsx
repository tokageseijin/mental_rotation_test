import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ModelEntry, QuizMode } from '../types';
import { useAllModels, useLibrary } from '../store/libraryStore';
import { useSession } from '../store/sessionStore';
import { useProfile } from '../store/profileStore';
import { ModelViewer } from '../components/ModelViewer';
import { RankBadge } from '../components/RankBadge';
import { useResolvedModel } from '../hooks/useResolvedModel';
import { deleteUserModel, isFsaSupported, pickAndStoreModel, storeFileBytes } from '../three/modelLoader';

export function Home() {
  const navigate = useNavigate();
  const models = useAllModels();
  const { addUserModel, removeUserModel } = useLibrary();
  const { selectedModelId, setSelectedModel, mode, setMode } = useSession();
  const modes = useProfile((s) => s.modes);

  const [addError, setAddError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = models.find((m) => m.id === selectedModelId) ?? models[0] ?? null;
  const preview = useResolvedModel(selected);

  async function handleAdd() {
    setAddError(null);
    try {
      if (isFsaSupported()) {
        const { entry } = await pickAndStoreModel();
        addUserModel(entry);
        setSelectedModel(entry.id);
      } else {
        fileInputRef.current?.click();
      }
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return; // user cancelled
      setAddError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleFileFallback(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { entry } = await storeFileBytes(file);
      addUserModel(entry);
      setSelectedModel(entry.id);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRemove(entry: ModelEntry) {
    await deleteUserModel(entry.id);
    removeUserModel(entry.id);
    if (selectedModelId === entry.id) setSelectedModel('teapot');
  }

  return (
    <div>
      <h1 className="page-title">ライブラリ</h1>
      <p className="page-sub">
        課題にする3Dモデルを選び、モードを決めてクイズを開始します。プリセットに加え、自分のGLB/glTFモデルも追加できます。
      </p>

      <div className="row" style={{ marginBottom: 24, gap: 24 }}>
        <div>
          <div className="muted" style={{ marginBottom: 4 }}>
            4択モード
          </div>
          <RankBadge rating={modes.choice.rating} />
        </div>
        <div>
          <div className="muted" style={{ marginBottom: 4 }}>
            ドローイングモード
          </div>
          <RankBadge rating={modes.drawing.rating} />
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        {/* left: model list */}
        <section>
          <div className="row" style={{ marginBottom: 12 }}>
            <strong>モデル一覧</strong>
            <span className="spacer" />
            <button className="btn" onClick={handleAdd}>
              + モデルを追加
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
              hidden
              onChange={handleFileFallback}
            />
          </div>
          {addError && <p className="error-text">{addError}</p>}
          {!isFsaSupported() && (
            <p className="muted">
              このブラウザはFile System Access APIに未対応のため、ファイル内容を保存する方式で読み込みます。
            </p>
          )}
          <div className="grid models">
            {models.map((m) => (
              <div
                key={m.id}
                className={`model-card${selected?.id === m.id ? ' selected' : ''}`}
                onClick={() => setSelectedModel(m.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedModel(m.id)}
              >
                <div className="thumb">
                  <CubeGlyph />
                </div>
                <div className="meta">
                  <div className="name">{m.name}</div>
                  <div className="tag">
                    {m.source === 'preset' ? (m.category === 'abstract' ? '抽象' : '具象') : 'ユーザー'}
                    {m.source === 'user' && (
                      <button
                        className="btn"
                        style={{ float: 'right', padding: '2px 6px', fontSize: 12 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRemove(m);
                        }}
                      >
                        削除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* right: preview + start */}
        <section>
          <div className="card">
            <div className="row" style={{ marginBottom: 12 }}>
              <strong>{selected?.name ?? 'モデル未選択'}</strong>
            </div>
            <ModelViewer object={preview.object} />
            {preview.loading && <p className="muted">読み込み中…</p>}
            {preview.needsPermission && (
              <div className="callout warn" style={{ marginTop: 12 }}>
                このモデルファイルへのアクセス許可が必要です。
                <button className="btn" style={{ marginLeft: 8 }} onClick={preview.reload}>
                  アクセスを許可
                </button>
              </div>
            )}
            {preview.error && <p className="error-text">{preview.error}</p>}

            <div style={{ marginTop: 16 }}>
              <label className="field" htmlFor="mode">
                回答モード
              </label>
              <ModeToggle mode={mode} onChange={setMode} />
            </div>

            <button
              className="btn primary lg block"
              style={{ marginTop: 16 }}
              disabled={!selected}
              onClick={() => navigate('/quiz')}
            >
              クイズを開始
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: QuizMode; onChange: (m: QuizMode) => void }) {
  return (
    <div className="row">
      <button
        className={`btn${mode === 'choice' ? ' primary' : ''}`}
        onClick={() => onChange('choice')}
      >
        4択で答える
      </button>
      <button
        className={`btn${mode === 'drawing' ? ' primary' : ''}`}
        onClick={() => onChange('drawing')}
      >
        ドローイングで答える
      </button>
    </div>
  );
}

function CubeGlyph() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2 21 7v10l-9 5-9-5V7l9-5Z"
        stroke="#9aa2ad"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 2v20M3 7l9 5 9-5" stroke="#c2c8d0" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
