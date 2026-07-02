import * as THREE from 'three';
import { TeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry.js';
import type { ModelCategory } from '../types';

// Procedurally generated preset models. No external assets => small bundle and
// no licensing concerns.
//
// NOTE: the earlier abstract-block and mug/chair/arrow presets were removed for
// now (low polish); they live in git history and can be restored later.

export interface PresetDef {
  id: string;
  name: string;
  category: ModelCategory;
  build: () => THREE.Object3D;
}

const NEUTRAL = 0xb9c0cc;
const BROWN = 0x7a4a2b;

/** Smooth, ceramic-like glossy material (low roughness -> visible highlight). */
function glossy(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.05 });
}

function teapot(): THREE.Group {
  const g = new THREE.Group();

  // Utah teapot, split into parts so the lid can be a different colour.
  // NOTE: the built-in teapot fuses body + spout + handle, so the handle can't
  // be coloured separately; only the lid (+ its knob) is separable.
  const bodyGeo = new TeapotGeometry(0.6, 12, true, false, true, true, true); // body + spout + handle + bottom
  const lidGeo = new TeapotGeometry(0.6, 12, false, true, false, true, true); // lid + knob
  g.add(new THREE.Mesh(bodyGeo, glossy(NEUTRAL)));
  g.add(new THREE.Mesh(lidGeo, glossy(BROWN)));

  // thin brown line around the lower side of the body
  bodyGeo.computeBoundingBox();
  const bb = bodyGeo.boundingBox!;
  const height = bb.max.y - bb.min.y;
  const bodyR = Math.abs(bb.max.z); // depth isn't stretched by the spout/handle
  const line = new THREE.Mesh(
    new THREE.TorusGeometry(bodyR * 0.86, bodyR * 0.03, 12, 64),
    glossy(BROWN),
  );
  line.rotation.x = Math.PI / 2;
  line.position.y = bb.min.y + height * 0.3;
  g.add(line);

  return g;
}

export const PRESETS: PresetDef[] = [
  { id: 'teapot', name: 'ティーポット', category: 'concrete', build: teapot },
];

const PRESET_MAP = new Map(PRESETS.map((p) => [p.id, p]));

export function getPreset(id: string): PresetDef | undefined {
  return PRESET_MAP.get(id);
}
