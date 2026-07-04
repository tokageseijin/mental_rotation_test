import { useEffect, useMemo } from 'react';
import type { ModelEntry } from '../types';
import { useModelConfig } from '../store/modelConfigStore';
import { useThumbnails, thumbSignature } from '../store/thumbnailStore';
import { useResolvedModel } from '../hooks/useResolvedModel';
import { renderThumbnail } from '../three/snapshotRenderer';

// A model-list card thumbnail: a quarter-view render of the object with its
// configured orientation/offset applied. The image is cached (persisted) and
// only regenerated when the config signature changes or the user forces a
// refresh — a cache hit doesn't even resolve the model's geometry.
export function ModelThumbnail({ entry }: { entry: ModelEntry }) {
  const configs = useModelConfig((s) => s.configs);
  const getConfig = useModelConfig((s) => s.getConfig);
  const config = useMemo(() => getConfig(entry.id), [getConfig, entry.id, configs]);
  const sig = useMemo(() => thumbSignature(config), [config]);

  const cached = useThumbnails((s) => s.thumbs[entry.id]);
  const setThumb = useThumbnails((s) => s.set);
  const fresh = !!cached && cached.sig === sig;

  // Only resolve (load geometry) when we actually need to (re)render.
  const { object } = useResolvedModel(entry, { enabled: !fresh });

  useEffect(() => {
    if (fresh || !object) return;
    const url = renderThumbnail(object, config);
    setThumb(entry.id, url, sig);
  }, [fresh, object, sig, config, entry.id, setThumb]);

  // Show the cached image (possibly stale while a fresh one renders); glyph if none.
  const url = cached?.url ?? null;
  if (!url) return <CubeGlyph />;
  return <img className="thumb-img" src={url} alt="" />;
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
