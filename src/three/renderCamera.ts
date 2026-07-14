// Shared camera parameters for the quiz renders (the 見本 / options snapshot and
// the rotation replay). The FOV is user-configurable; to keep the object framed
// the same apparent size across FOV values, the camera distance is adjusted so
// that only the *perspective* (how "tight"/distorted it looks) changes, not zoom.

/** Default vertical FOV in degrees (the historic value). */
export const BASE_FOV = 35;
/** Camera distance that framed the object at BASE_FOV (straight-on view). */
const BASE_DIST = 3.6;

const tanHalf = (deg: number) => Math.tan((deg / 2) * (Math.PI / 180));
const FRAMING_K = BASE_DIST * tanHalf(BASE_FOV);

export const FOV_MIN = 15;
export const FOV_MAX = 60;

/** Fraction of the max fit radius to actually use (leaves a little breathing room). */
export const FIT_MARGIN = 0.9;

export function clampFov(fov: number): number {
  if (!Number.isFinite(fov)) return BASE_FOV;
  return Math.max(FOV_MIN, Math.min(FOV_MAX, fov));
}

/** Camera distance that keeps the framing constant for a given FOV. */
export function quizCameraDistance(fovDeg: number): number {
  return FRAMING_K / tanHalf(clampFov(fovDeg));
}

/**
 * Radius (in the normalised render space) of the largest sphere, centred on the
 * pivot at the origin, that stays fully inside the camera frustum. A model whose
 * bounding sphere is within this radius never clips at *any* rotation.
 */
export function maxFitRadius(fovDeg: number): number {
  const f = clampFov(fovDeg);
  return quizCameraDistance(f) * Math.sin((f / 2) * (Math.PI / 180));
}
