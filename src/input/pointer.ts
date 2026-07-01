// Pointer utilities shared across the app.
//
// We standardise on Pointer Events so mouse, pen and touch all flow through one
// path. `pointerType` and `pressure` let the drawing canvas react to a tablet
// pen, while normal taps/clicks keep working everywhere else.

export type PointerKind = 'mouse' | 'pen' | 'touch';

export interface NormalizedPointer {
  x: number;
  y: number;
  kind: PointerKind;
  /** 0..1; pens report real pressure, mouse/touch fall back to 0.5 */
  pressure: number;
  pointerId: number;
}

/** Convert a PointerEvent to canvas-local coordinates + a sane pressure value. */
export function normalizePointer(
  e: PointerEvent,
  target: HTMLElement,
): NormalizedPointer {
  const rect = target.getBoundingClientRect();
  const kind = (e.pointerType || 'mouse') as PointerKind;
  // Mouse events report pressure 0 while the button is down on some browsers;
  // treat non-pen inputs as a fixed mid pressure so line width is stable.
  const pressure = kind === 'pen' ? clamp01(e.pressure || 0.5) : 0.5;
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    kind,
    pressure,
    pointerId: e.pointerId,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
