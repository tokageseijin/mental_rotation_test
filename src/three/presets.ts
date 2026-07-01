import * as THREE from 'three';
import { TeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry.js';
import type { ModelCategory } from '../types';

// Procedurally generated preset models. No external assets => small bundle,
// no licensing concerns, and every shape is deliberately asymmetric/chiral so
// mirrored distractors are actually distinguishable.

export interface PresetDef {
  id: string;
  name: string;
  category: ModelCategory;
  build: () => THREE.Object3D;
}

const NEUTRAL = 0xb9c0cc;
const ACCENT = 0x6b8bd6;
const WARM = 0xcbb994;

function mat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
}

/** Build a Shepard–Metzler style figure from a list of unit-cube coordinates. */
function cubeFigure(coords: Array<[number, number, number]>, color = NEUTRAL): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const material = mat(color);
  // subtle bevel via edge lines to read the block joints clearly
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x8a92a0 });
  for (const [x, y, z] of coords) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
    edges.position.copy(mesh.position);
    group.add(mesh, edges);
  }
  return group;
}

function mug(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.55, 1.2, 32), mat(NEUTRAL));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 16, 32, Math.PI * 1.2), mat(ACCENT));
  handle.position.set(0.62, 0, 0);
  handle.rotation.z = Math.PI * 0.9;
  g.add(body, handle);
  return g;
}

function chair(): THREE.Group {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1), mat(WARM));
  seat.position.y = 0;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.12), mat(WARM));
  back.position.set(0, 0.55, -0.44);
  g.add(seat, back);
  const legGeo = new THREE.BoxGeometry(0.12, 0.9, 0.12);
  const legMat = mat(NEUTRAL);
  const offs: Array<[number, number]> = [
    [0.4, 0.4],
    [-0.4, 0.4],
    [0.4, -0.4],
    [-0.4, -0.4],
  ];
  for (const [x, z] of offs) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, -0.5, z);
    g.add(leg);
  }
  return g;
}

function arrow(): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.4), mat(NEUTRAL));
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 24), mat(ACCENT));
  head.position.z = 1.05;
  head.rotation.x = Math.PI / 2;
  // an off-centre fin removes any residual symmetry so mirror ≠ original
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.3), mat(WARM));
  fin.position.set(0.19, 0.3, -0.5);
  g.add(shaft, head, fin);
  return g;
}

function teapot(): THREE.Object3D {
  const geo = new TeapotGeometry(0.6, 8);
  return new THREE.Mesh(geo, mat(NEUTRAL));
}

export const PRESETS: PresetDef[] = [
  {
    id: 'sm-l',
    name: 'ブロックL（抽象）',
    category: 'abstract',
    build: () => cubeFigure([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [2, 1, 0],
    ]),
  },
  {
    id: 'sm-zigzag',
    name: 'ブロックZ（抽象）',
    category: 'abstract',
    build: () => cubeFigure([
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [1, 2, 0],
      [2, 2, 0],
    ], ACCENT),
  },
  {
    id: 'sm-3d',
    name: 'ブロック3D（抽象）',
    category: 'abstract',
    build: () => cubeFigure([
      [0, 0, 0],
      [0, 1, 0],
      [0, 2, 0],
      [0, 2, 1],
      [0, 2, 2],
      [1, 2, 2],
    ]),
  },
  { id: 'mug', name: 'マグカップ', category: 'concrete', build: mug },
  { id: 'chair', name: '椅子', category: 'concrete', build: chair },
  { id: 'arrow', name: '矢印', category: 'concrete', build: arrow },
  { id: 'teapot', name: 'ティーポット', category: 'concrete', build: teapot },
];

const PRESET_MAP = new Map(PRESETS.map((p) => [p.id, p]));

export function getPreset(id: string): PresetDef | undefined {
  return PRESET_MAP.get(id);
}
