import type { Axis } from '../types';

// Axis colours used by UI text (instruction letters, legend swatches).
// Same hues as the 3D legend axes but slightly darkened so they stay legible
// (AA for large text) on the calm, low-saturation instruction background.
export const AXIS_UI_COLOR: Record<Axis, string> = {
  x: '#c33b37', // red
  y: '#2f8a48', // green
  z: '#3563c0', // blue
};
