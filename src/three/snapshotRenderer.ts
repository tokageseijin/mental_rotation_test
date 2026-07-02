import * as THREE from 'three';

// Off-screen rasteriser used to turn a model at a given orientation into an
// image. A single WebGLRenderer is reused across all snapshots for speed; each
// question builds one SnapshotScene and renders it at 4 orientations.

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
export function createSnapshotScene(object: THREE.Object3D): SnapshotScene {
  const scene = new THREE.Scene();
  const pivot = new THREE.Group();

  const model = object.clone(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const sizeVec = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;

  model.position.sub(center); // re-centre
  const holder = new THREE.Group();
  holder.add(model);
  holder.scale.setScalar(1.7 / maxDim); // normalise size in view
  pivot.add(holder);
  scene.add(pivot);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x707784, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2.5, 3.5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-3, -1, -2);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 3.6);
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

/** A curved arrow around `axis` showing the positive (right-hand rule) direction. */
function makeRotationCurl(axis: 'x' | 'y' | 'z', color: number): THREE.Group {
  const group = new THREE.Group();
  const R = 0.5;
  // The Z arc lies in the screen plane, so keep its endpoints on the X axis
  // (start/end y ≈ 0). X/Y arcs are seen edge-on, so the offset there is fine.
  const [startDeg, endDeg] = axis === 'z' ? [0, 180] : [20, 200];
  const start = THREE.MathUtils.degToRad(startDeg);
  const end = THREE.MathUtils.degToRad(endDeg);

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

  const N = 48;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = start + ((end - start) * i) / N;
    pts.push(
      u.clone().multiplyScalar(Math.cos(t) * R).add(w.clone().multiplyScalar(Math.sin(t) * R)),
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
  const endPos = u.clone().multiplyScalar(Math.cos(end) * R).add(w.clone().multiplyScalar(Math.sin(end) * R));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.15, 12), material);
  cone.position.copy(endPos);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  group.add(cone);
  return group;
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
    const dir = new THREE.Vector3(ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0);
    const color = AXIS_COLORS[ax];
    const lineMat = new THREE.LineBasicMaterial({ color });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      dir.clone().multiplyScalar(-L),
      dir.clone().multiplyScalar(L),
    ]);
    scene.add(new THREE.Line(lineGeo, lineMat));

    // arrowhead marking the + end of the axis
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.16, 16),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
    );
    cone.position.copy(dir.clone().multiplyScalar(L));
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    scene.add(cone);

    scene.add(makeRotationCurl(ax, color));
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

// --- local axis reference ---------------------------------------------------

/** A solid arrow (shaft + head) from the origin along `dir`. */
function makeAxisArrow(dir: THREE.Vector3, color: number, length: number): THREE.Group {
  const g = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const headLen = 0.22;
  const shaftLen = Math.max(0.01, length - headLen);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, shaftLen, 14), material);
  shaft.position.y = shaftLen / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.075, headLen, 16), material);
  head.position.y = shaftLen + headLen / 2;
  g.add(shaft, head);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return g;
}

/**
 * Render the object at identity in a quarter view with its local +X/+Y/+Z axes
 * drawn as coloured arrows. Axes share the scene (and depth buffer) with the
 * object, so the front/back occlusion between axes and object is preserved.
 */
export function renderLocalAxes(object: THREE.Object3D, size = 320): string {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x707784, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(2.5, 3.5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-3, -1, -2);
  scene.add(fill);

  // centre + normalise the object exactly like the snapshot framing
  const model = object.clone(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const sizeVec = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;
  model.position.sub(center);
  const holder = new THREE.Group();
  holder.add(model);
  holder.scale.setScalar(1.7 / maxDim);
  scene.add(holder);

  // local axes at the object origin (same normalised space); length reaches
  // just past the object surface so the arrowheads read outside the silhouette.
  const axisLen = 1.15;
  scene.add(makeAxisArrow(new THREE.Vector3(1, 0, 0), AXIS_COLORS.x, axisLen));
  scene.add(makeAxisArrow(new THREE.Vector3(0, 1, 0), AXIS_COLORS.y, axisLen));
  scene.add(makeAxisArrow(new THREE.Vector3(0, 0, 1), AXIS_COLORS.z, axisLen));

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
