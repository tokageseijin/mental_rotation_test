import * as THREE from 'three';
import type { ModelConfig } from '../store/modelConfigStore';
import { BASE_FOV, quizCameraDistance } from './renderCamera';

// Off-screen rasteriser used to turn a model at a given orientation into an
// image. A single WebGLRenderer is reused across all snapshots for speed; each
// question builds one SnapshotScene and renders it at 4 orientations.

/**
 * Bake a model's authoring config into a centred+normalised holder.
 * - orientation: applied as a global Euler rotation *before* centring, so it
 *   changes which face reads as "front" (centring only translates, so it holds).
 * - offset: applied *after* scaling, shifting the object off the pivot centre so
 *   rotations orbit the origin (a deliberate framing/authoring choice).
 * Returns the holder to add under the rotating pivot (snapshot) or scene (axes).
 */
export function buildConfiguredHolder(object: THREE.Object3D, config?: ModelConfig): THREE.Group {
  const model = object.clone(true);
  if (config) {
    const o = config.orientation;
    model.rotation.set(
      THREE.MathUtils.degToRad(o.x),
      THREE.MathUtils.degToRad(o.y),
      THREE.MathUtils.degToRad(o.z),
    );
    model.updateMatrixWorld(true);
  }
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const sizeVec = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;

  model.position.sub(center); // re-centre
  const holder = new THREE.Group();
  holder.add(model);
  holder.scale.setScalar(1.7 / maxDim); // normalise size in view
  if (config) holder.position.set(config.offset.x, config.offset.y, config.offset.z);
  return holder;
}

let renderer: THREE.WebGLRenderer | null = null;

function getRenderer(size: number): THREE.WebGLRenderer {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true, // required for toDataURL on an off-DOM canvas
    });
    renderer.setClearColor(0xffffff, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(size, size, false);
  return renderer;
}

export interface SnapshotScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** apply the target orientation to this node */
  pivot: THREE.Group;
  dispose: () => void;
}

/**
 * Build a scene that frames `object`: it is centred at the origin and scaled to
 * a unit size so different models are framed consistently.
 */
export function createSnapshotScene(
  object: THREE.Object3D,
  config?: ModelConfig,
  fov: number = BASE_FOV,
): SnapshotScene {
  const scene = new THREE.Scene();
  const pivot = new THREE.Group();

  pivot.add(buildConfiguredHolder(object, config));
  scene.add(pivot);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x707784, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2.5, 3.5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-3, -1, -2);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(0, 0, quizCameraDistance(fov));
  camera.lookAt(0, 0, 0);

  return {
    scene,
    camera,
    pivot,
    dispose: () => {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const material = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((x) => x.dispose());
        else material?.dispose();
      });
    },
  };
}

export interface RenderOptions {
  size?: number;
  /**
   * Mirror the final image horizontally. Used to render an enantiomer
   * ("mirror confusion") distractor cheaply and robustly in 2D, avoiding the
   * inverted-normal artefacts of negatively scaling the 3D model.
   */
  flipX?: boolean;
}

/** Render the scene at the given orientation and return a PNG data URL. */
export function renderOrientation(
  snap: SnapshotScene,
  quaternion: THREE.Quaternion,
  options: RenderOptions = {},
): string {
  const size = options.size ?? 320;
  const r = getRenderer(size);
  snap.pivot.quaternion.copy(quaternion);
  r.render(snap.scene, snap.camera);

  if (!options.flipX) return r.domElement.toDataURL('image/png');

  const out = document.createElement('canvas');
  out.width = r.domElement.width;
  out.height = r.domElement.height;
  const ctx = out.getContext('2d')!;
  ctx.translate(out.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(r.domElement, 0, 0);
  return out.toDataURL('image/png');
}

// --- axis legend ------------------------------------------------------------

const AXIS_COLORS = { x: 0xd9534f, y: 0x3fa957, z: 0x3f7fd6 } as const;
let legendCache: string | null = null;

const AXIS_DIR: Record<'x' | 'y' | 'z', THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

/**
 * Curved +rotation arrow around `axis` (right-hand rule), a half turn whose
 * endpoints sit on the axis plane: X-curl endpoints at Z=0, Y-curl at X=0,
 * Z-curl at Y=0. `radius` sizes it and `along` shifts its centre up the axis
 * (used to place it near the axis tip on the local-coordinate reference).
 */
function makeRotationCurl(axis: 'x' | 'y' | 'z', color: number, radius = 0.5, along = 0): THREE.Group {
  const group = new THREE.Group();
  const start = 0;
  const end = Math.PI;

  // right-hand rule: +X takes Y->Z, +Y takes Z->X, +Z takes X->Y
  const u = new THREE.Vector3();
  const w = new THREE.Vector3();
  if (axis === 'x') {
    u.set(0, 1, 0);
    w.set(0, 0, 1);
  } else if (axis === 'y') {
    u.set(0, 0, 1);
    w.set(1, 0, 0);
  } else {
    u.set(1, 0, 0);
    w.set(0, 1, 0);
  }
  const offset = AXIS_DIR[axis].clone().multiplyScalar(along);

  const N = 48;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = start + ((end - start) * i) / N;
    pts.push(
      u
        .clone()
        .multiplyScalar(Math.cos(t) * radius)
        .add(w.clone().multiplyScalar(Math.sin(t) * radius))
        .add(offset),
    );
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.017, 8, false), material));

  // arrowhead at the arc end, pointing along the tangent (rotation direction)
  const tangent = u
    .clone()
    .multiplyScalar(-Math.sin(end))
    .add(w.clone().multiplyScalar(Math.cos(end)))
    .normalize();
  const endPos = u
    .clone()
    .multiplyScalar(Math.cos(end) * radius)
    .add(w.clone().multiplyScalar(Math.sin(end) * radius))
    .add(offset);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 12), material);
  cone.position.copy(endPos);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  group.add(cone);
  return group;
}

/** Coloured axis line (−neg .. +pos along the axis) with a + arrowhead. */
function makeAxisLine(axis: 'x' | 'y' | 'z', color: number, negExt: number, posExt: number): THREE.Group {
  const g = new THREE.Group();
  const dir = AXIS_DIR[axis];
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    dir.clone().multiplyScalar(-negExt),
    dir.clone().multiplyScalar(posExt),
  ]);
  g.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color })));
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.16, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
  );
  cone.position.copy(dir.clone().multiplyScalar(posExt));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.add(cone);
  return g;
}

/**
 * Render a 3D axis gizmo (X/Y/Z lines + a curved arrow per axis marking the
 * positive rotation direction). Cached — the legend never changes.
 */
export function renderAxisLegend(size = 260): string {
  if (legendCache) return legendCache;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(2, 3, 4);
  scene.add(key);

  const L = 1.05;
  (['x', 'y', 'z'] as const).forEach((ax) => {
    const color = AXIS_COLORS[ax];
    scene.add(makeAxisLine(ax, color, L, L)); // full axis through the origin
    scene.add(makeRotationCurl(ax, color, 0.5, 0));
  });

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  // near the quiz camera (straight-on, +X right / +Y up) but nudged so Z reads
  camera.position.set(1.5, 1.05, 3.0);
  camera.lookAt(0, 0, 0);

  const r = getRenderer(size);
  r.render(scene, camera);
  const url = r.domElement.toDataURL('image/png');

  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const material = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((x) => x.dispose());
    else material?.dispose();
  });

  legendCache = url;
  return url;
}

// --- library thumbnail ------------------------------------------------------

/**
 * Render a small quarter-view thumbnail of the object with its config applied
 * (orientation baked, offset shifting it off the centre) — no axes. Used for the
 * model-list cards so each card shows the actual configured pose. We deliberately
 * do NOT dispose here: the clone shares geometry with the live model object, so
 * disposing would needlessly drop/re-upload GPU buffers the preview still uses.
 */
export function renderThumbnail(object: THREE.Object3D, config?: ModelConfig, size = 176): string {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x707784, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(2.5, 3.5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-3, -1, -2);
  scene.add(fill);

  scene.add(buildConfiguredHolder(object, config));

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(2.7, 2.2, 3.0); // quarter view (matches the axis reference)
  camera.lookAt(0, 0, 0);

  const r = getRenderer(size);
  r.render(scene, camera);
  return r.domElement.toDataURL('image/png');
}

// --- local axis reference ---------------------------------------------------

/**
 * Render the object at identity in a quarter view with its local +X/+Y/+Z axes
 * drawn as coloured arrows. Axes share the scene (and depth buffer) with the
 * object, so the front/back occlusion between axes and object is preserved.
 */
export function renderLocalAxes(object: THREE.Object3D, config?: ModelConfig, size = 320): string {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x707784, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(2.5, 3.5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-3, -1, -2);
  scene.add(fill);

  // centre + normalise + apply config exactly like the snapshot framing
  scene.add(buildConfiguredHolder(object, config));

  // local axes at the object origin (same normalised space); same line style as
  // the global legend, plus a +rotation curl near each axis tip.
  const axisLen = 1.15;
  (['x', 'y', 'z'] as const).forEach((ax) => {
    const color = AXIS_COLORS[ax];
    scene.add(makeAxisLine(ax, color, 0, axisLen));
    scene.add(makeRotationCurl(ax, color, 0.26, 0.82)); // near the tip
  });

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(2.7, 2.2, 3.0); // quarter view
  camera.lookAt(0, 0, 0);

  const r = getRenderer(size);
  r.render(scene, camera);
  const url = r.domElement.toDataURL('image/png');

  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const material = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((x) => x.dispose());
    else material?.dispose();
  });

  return url;
}
