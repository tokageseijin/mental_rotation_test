import { useMemo, useRef, useState } from 'react';
import type { ModelEntry } from '../types';
import { useAllModels, useLibrary } from '../store/libraryStore';
import { useProfile } from '../store/profileStore';
import { useModelConfig, type ModelConfigPatch } from '../store/modelConfigStore';
import { useThumbnails } from '../store/thumbnailStore';
import { ModelViewer } from '../components/ModelViewer';
import { ModelThumbnail } from '../components/ModelThumbnail';
import { LocalAxisReference } from '../components/LocalAxisReference';
import { RankBadge } from '../components/RankBadge';
import { useResolvedModel } from '../hooks/useResolvedModel';
import { deleteUserModel, isFsaSupported, pickAndStoreModel, storeFileBytes } from '../three/modelLoader';

// The library is now an authoring screen: pick an object on the left, configure
// its canonical orientation / offset / symmetry on the right. Those settings are
// persisted per model and read by the quiz generator. No quiz is started here.
export function Home() {
  const models = useAllModels();
  const { addUserModel, removeUserModel } = useLibrary();
  const modes = useProfile((s) => s.modes);
  const configs = useModelConfig((s) => s.configs);
  const getConfig = useModelConfig((s) => s.getConfig);
  const setConfig = useModelConfig((s) => s.setConfig);
  const refreshThumb = useThumbnails((s) => s.refresh);

  const [editingId, setEditingId] = useState<string>('teapot');
  const [addError, setAddError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editing = models.find((m) => m.id === editingId) ?? models[0] ?? null;
  const preview = useResolvedModel(editing);
  const config = useMemo(
    () => (editing ? getConfig(editing.id) : undefined),
    // re-derive on model switch or when the stored configs change (entry is a
    // fresh object each render, so key on its id string instead of the ref)
    [getConfig, editing?.id, configs],
  );

  async function handleAdd() {
    setAddError(null);
    try {
      if (isFsaSupported()) {
        const { entry } = await pickAndStoreModel();
        addUserModel(entry);
        setEditingId(entry.id);
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
      setEditingId(entry.id);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRemove(entry: ModelEntry) {
    await deleteUserModel(entry.id);
    removeUserModel(entry.id);
    refreshThumb(entry.id); // drop its cached thumbnail
    if (editingId === entry.id) setEditingId('teapot');
  }

  const patch = (p: ModelConfigPatch) => editing && setConfig(editing.id, p);

  return (
    <div>
      <h1 className="page-title">ライブラリ</h1>
      <p className="page-sub">
        課題にする3Dモデルを選び、向き・オフセット・対称性を設定します。ここでの設定はクイズの出題に反映されます。
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
                className={`model-card${editing?.id === m.id ? ' selected' : ''}`}
                onClick={() => setEditingId(m.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setEditingId(m.id)}
              >
                <div className="thumb">
                  <ModelThumbnail entry={m} />
                  <button
                    className="thumb-refresh"
                    title="サムネイルを更新"
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshThumb(m.id);
                    }}
                  >
                    ⟳
                  </button>
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

        {/* right: config panel for the selected object */}
        <section>
          <div className="card">
            <div className="row" style={{ marginBottom: 12 }}>
              <strong>{editing?.name ?? 'モデル未選択'}</strong>
            </div>
            <ModelViewer object={preview.object} config={config} />
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
            <p className="muted" style={{ marginTop: 8 }}>
              表示欄はカメラ操作のみ。位置や向きは下の数値入力で調整します。
            </p>

            {config && editing && (
              <>
                <div style={{ marginTop: 16 }}>
                  <label className="field">向き（度）</label>
                  <Vec3Field
                    value={config.orientation}
                    step={15}
                    onChange={(axis, v) => patch({ orientation: { [axis]: v } })}
                  />
                </div>

                <div style={{ marginTop: 16 }}>
                  <label className="field">オフセット</label>
                  <Vec3Field
                    value={config.offset}
                    step={0.001}
                    onChange={(axis, v) => patch({ offset: { [axis]: v } })}
                  />
                </div>

                <div style={{ marginTop: 16 }}>
                  <label className="field">対称性（オフセット適用後の原点まわり）</label>
                  <div className="muted" style={{ marginBottom: 6 }}>
                    面対称
                  </div>
                  <div className="check-row">
                    <SymCheck
                      label="XY面"
                      checked={config.symmetry.planes.xy}
                      onChange={(v) => patch({ symmetry: { planes: { xy: v } } })}
                    />
                    <SymCheck
                      label="YZ面"
                      checked={config.symmetry.planes.yz}
                      onChange={(v) => patch({ symmetry: { planes: { yz: v } } })}
                    />
                    <SymCheck
                      label="XZ面"
                      checked={config.symmetry.planes.xz}
                      onChange={(v) => patch({ symmetry: { planes: { xz: v } } })}
                    />
                  </div>
                  <div className="muted" style={{ margin: '10px 0 6px' }}>
                    軸対称
                  </div>
                  <div className="check-row">
                    <SymCheck
                      label="X軸"
                      checked={config.symmetry.axes.x}
                      onChange={(v) => patch({ symmetry: { axes: { x: v } } })}
                    />
                    <SymCheck
                      label="Y軸"
                      checked={config.symmetry.axes.y}
                      onChange={(v) => patch({ symmetry: { axes: { y: v } } })}
                    />
                    <SymCheck
                      label="Z軸"
                      checked={config.symmetry.axes.z}
                      onChange={(v) => patch({ symmetry: { axes: { z: v } } })}
                    />
                  </div>
                  <p className="muted" style={{ marginTop: 8 }}>
                    いずれかの面対称にチェックすると鏡像の選択肢は出題されません。
                  </p>
                </div>

                <div style={{ marginTop: 16 }}>
                  <LocalAxisReference object={preview.object} config={config} label="設定状態（軸つき）" />
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

type Axis3 = 'x' | 'y' | 'z';

function Vec3Field({
  value,
  step,
  onChange,
}: {
  value: { x: number; y: number; z: number };
  step: number;
  onChange: (axis: Axis3, v: number) => void;
}) {
  return (
    <div className="vec3">
      {(['x', 'y', 'z'] as Axis3[]).map((axis) => (
        <label key={axis} className="vec3-cell">
          <span className={`axis-tag axis-${axis}`}>{axis.toUpperCase()}</span>
          <input
            type="number"
            step={step}
            value={value[axis]}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onChange(axis, Number.isFinite(v) ? v : 0);
            }}
          />
        </label>
      ))}
    </div>
  );
}

function SymCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

