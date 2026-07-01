import { useEffect, useRef, useState } from 'react';
import { normalizePointer } from '../input/pointer';

// A memo sketch surface driven by Pointer Events, with its own toolbar.
//  - pen pressure -> line width (mouse/touch use a fixed mid pressure)
//  - palm rejection: touches ignored while a pen is (or was just) active
//  - undo/redo via ImageData snapshots; pen/eraser toggle; 5 pen sizes
//  - touch-action: none so the pen/finger draws instead of scrolling

const PEN_LOCKOUT_MS = 700; // ignore touch shortly after a pen stroke
const SIZE_LEVELS = [2, 4, 7, 11, 16]; // base stroke widths (CSS px)
const MAX_HISTORY = 25;

type Tool = 'pen' | 'eraser';

export function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const penActive = useRef(false);
  const lastPenAt = useRef(0);

  // undo/redo history (device-pixel snapshots)
  const history = useRef<ImageData[]>([]);
  const historyIndex = useRef(-1);

  const [tool, setTool] = useState<Tool>('pen');
  const [sizeLevel, setSizeLevel] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // latest tool/size for use inside pointer handlers
  const toolRef = useRef(tool);
  const sizeRef = useRef(sizeLevel);
  toolRef.current = tool;
  sizeRef.current = sizeLevel;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr); // draw in CSS pixels
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;
    history.current = [];
    historyIndex.current = -1;
    pushHistory(); // record the blank starting state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshUndoRedo() {
    setCanUndo(historyIndex.current > 0);
    setCanRedo(historyIndex.current < history.current.length - 1);
  }

  function pushHistory() {
    const c = canvasRef.current;
    const ctx = ctxRef.current;
    if (!c || !ctx) return;
    const snap = ctx.getImageData(0, 0, c.width, c.height);
    history.current = history.current.slice(0, historyIndex.current + 1);
    history.current.push(snap);
    if (history.current.length > MAX_HISTORY) history.current.shift();
    historyIndex.current = history.current.length - 1;
    refreshUndoRedo();
  }

  function restore() {
    const ctx = ctxRef.current;
    const snap = history.current[historyIndex.current];
    if (ctx && snap) ctx.putImageData(snap, 0, 0);
  }

  function undo() {
    if (historyIndex.current <= 0) return;
    historyIndex.current -= 1;
    restore();
    refreshUndoRedo();
  }

  function redo() {
    if (historyIndex.current >= history.current.length - 1) return;
    historyIndex.current += 1;
    restore();
    refreshUndoRedo();
  }

  function clearAll() {
    const c = canvasRef.current;
    const ctx = ctxRef.current;
    if (!c || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    pushHistory();
  }

  function shouldIgnoreTouch(kind: string): boolean {
    return kind === 'touch' && (penActive.current || performance.now() - lastPenAt.current < PEN_LOCKOUT_MS);
  }

  function stroke(from: { x: number; y: number }, to: { x: number; y: number }, pressure: number) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const base = SIZE_LEVELS[sizeRef.current];
    const eraser = toolRef.current === 'eraser';
    ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = '#1f2430';
    ctx.lineWidth = base * (eraser ? 1.8 : 1) * (0.6 + pressure * 0.8);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (shouldIgnoreTouch(e.pointerType)) return;
    if (e.pointerType === 'pen') penActive.current = true;
    const p = normalizePointer(e.nativeEvent, e.currentTarget);
    drawing.current = true;
    last.current = { x: p.x, y: p.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    stroke(last.current, last.current, p.pressure); // dot for a tap
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || shouldIgnoreTouch(e.pointerType)) return;
    const p = normalizePointer(e.nativeEvent, e.currentTarget);
    if (last.current) stroke(last.current, p, p.pressure);
    last.current = { x: p.x, y: p.y };
  }

  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (e.pointerType === 'pen') {
      penActive.current = false;
      lastPenAt.current = performance.now();
    }
    pushHistory(); // one undo step per completed stroke
  }

  return (
    <div className="draw-wrap">
      <div className="draw-toolbar" role="toolbar" aria-label="描画ツール">
        <button className="tb-btn" onClick={undo} disabled={!canUndo} title="元に戻す" aria-label="元に戻す">
          ↶
        </button>
        <button className="tb-btn" onClick={redo} disabled={!canRedo} title="やり直し" aria-label="やり直し">
          ↷
        </button>
        <span className="tb-sep" />
        <button
          className="tb-btn wide"
          onClick={() => setTool((t) => (t === 'pen' ? 'eraser' : 'pen'))}
          title="ペン / 消しゴム切り替え"
        >
          {tool === 'pen' ? '✎ ペン' : '⌫ 消しゴム'}
        </button>
        <span className="tb-sep" />
        {SIZE_LEVELS.map((s, i) => (
          <button
            key={i}
            className={`tb-btn size-btn${sizeLevel === i ? ' active' : ''}`}
            onClick={() => setSizeLevel(i)}
            title={`太さ ${i + 1}`}
            aria-label={`太さ ${i + 1}`}
          >
            <span className="dot" style={{ width: Math.min(16, s + 2), height: Math.min(16, s + 2) }} />
          </button>
        ))}
        <span className="tb-sep" />
        <button className="tb-btn" onClick={clearAll} title="全消し">
          全消し
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="draw-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
      />
    </div>
  );
}
