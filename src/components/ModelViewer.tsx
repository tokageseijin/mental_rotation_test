import { useEffect, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { ModelConfig } from '../store/modelConfigStore';
import { buildConfiguredHolder } from '../three/snapshotRenderer';

// Interactive 3D preview for the Library authoring panel. The object is framed
// exactly like the quiz snapshots (centred, normalised, then orientation baked
// and offset applied) so what you configure here is what the quiz shows. The
// origin — the rotation centre — can be marked with a centre dot and XYZ axes to
// check that the orientation/offset are correct. Camera orbits; the 6 view
// buttons snap it to look from a principal direction.

const AXIS_COLORS = { x: 0xd9534f, y: 0x3fa957, z: 0x3f7fd6 } as const;
const D = 3.6; // camera distance for the preset views

interface ViewDef {
  label: string;
  pos: [number, number, number];
  up: [number, number, number];
}
const VIEWS: ViewDef[] = [
  { label: '前', pos: [0, 0, D], up: [0, 1, 0] },
  { label: '後', pos: [0, 0, -D], up: [0, 1, 0] },
  { label: '右', pos: [D, 0, 0], up: [0, 1, 0] },
  { label: '左', pos: [-D, 0, 0], up: [0, 1, 0] },
  { label: '上', pos: [0, D, 0], up: [0, 0, -1] },
  { label: '下', pos: [0, -D, 0], up: [0, 0, 1] },
];

export function ModelViewer({ object, config }: { object: THREE.Object3D | null; config?: ModelConfig }) {
  const [showCenter, setShowCenter] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [view, setView] = useState<{ def: ViewDef; n: number } | null>(null);

  const holder = useMemo(() => (object ? buildConfiguredHolder(object, config) : null), [object, config]);
  const axesObj = useMemo(() => buildAxes(), []);
  const centerObj = useMemo(() => buildCenterDot(), []);

  return (
    <div>
      <div className="viewer">
        <Canvas camera={{ position: [2.6, 2, 3.2], fov: 35 }} dpr={[1, 2]}>
          <hemisphereLight args={[0xffffff, 0x707784, 1.15]} />
          <directionalLight position={[3, 4, 5]} intensity={1.3} />
          <directionalLight position={[-3, -1, -2]} intensity={0.45} />
          {holder && <primitive object={holder} dispose={null} />}
          {showAxes && <primitive object={axesObj} dispose={null} />}
          {showCenter && <primitive object={centerObj} dispose={null} />}
          <OrbitControls makeDefault enablePan={false} />
          <ViewRig view={view} />
        </Canvas>
      </div>
      <div className="viewer-toolbar">
        {VIEWS.map((v) => (
          <button
            key={v.label}
            className="tb-btn"
            title={`${v.label}から見る`}
            onClick={() => setView((prev) => ({ def: v, n: (prev?.n ?? 0) + 1 }))}
          >
            {v.label}
          </button>
        ))}
        <span className="tb-sep" />
        <button
          className={`tb-btn wide${showAxes ? ' active' : ''}`}
          onClick={() => setShowAxes((s) => !s)}
        >
          軸
        </button>
        <button
          className={`tb-btn wide${showCenter ? ' active' : ''}`}
          onClick={() => setShowCenter((s) => !s)}
        >
          中心点
        </button>
      </div>
    </div>
  );
}

/** Move the camera to a preset view when the button is clicked (n changes). */
function ViewRig({ view }: { view: { def: ViewDef; n: number } | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null;

  useEffect(() => {
    if (!view) return;
    camera.up.set(...view.def.up);
    camera.position.set(...view.def.pos);
    camera.lookAt(0, 0, 0);
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.n]);

  return null;
}

/** Coloured XYZ lines through the origin (both directions), matching axis colours. */
function buildAxes(): THREE.Group {
  const g = new THREE.Group();
  const L = 1.15;
  const dirs: Array<[THREE.Vector3, number]> = [
    [new THREE.Vector3(1, 0, 0), AXIS_COLORS.x],
    [new THREE.Vector3(0, 1, 0), AXIS_COLORS.y],
    [new THREE.Vector3(0, 0, 1), AXIS_COLORS.z],
  ];
  for (const [dir, color] of dirs) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      dir.clone().multiplyScalar(-L),
      dir.clone().multiplyScalar(L),
    ]);
    g.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })));
  }
  return g;
}

/** A small dot at the origin (the rotation centre), drawn on top of the object. */
function buildCenterDot(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x111318, depthTest: false }),
  );
  mesh.renderOrder = 999;
  return mesh;
}
