import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RotationStep } from '../types';
import type { ModelConfig } from '../store/modelConfigStore';
import { composeRotation } from '../three/rotation';
import { BASE_FOV, quizCameraDistance } from '../three/renderCamera';

// Looping animation of the model rotating from the base pose through each step
// to the correct answer, then holding briefly and repeating. Same camera as the
// snapshot renderer so it matches the option images. Play / stop below.

const SEG_MS = 850; // per rotation step
const HOLD_MS = 750; // pause on the answer before looping

interface Props {
  object: THREE.Object3D | null;
  steps: RotationStep[];
  baseQ: THREE.Quaternion;
  config?: ModelConfig;
  fov?: number;
}

/** Centre + normalise + apply config exactly like the snapshot framing. */
function frameObject(object: THREE.Object3D, config?: ModelConfig): THREE.Group {
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
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  model.position.sub(center);
  const holder = new THREE.Group();
  holder.add(model);
  holder.scale.setScalar(1.7 / maxDim);
  if (config) holder.position.set(config.offset.x, config.offset.y, config.offset.z);
  return holder;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function Scene({
  object,
  steps,
  baseQ,
  playing,
  config,
}: {
  object: THREE.Object3D;
  steps: RotationStep[];
  baseQ: THREE.Quaternion;
  playing: boolean;
  config?: ModelConfig;
}) {
  const pivot = useRef<THREE.Group>(null);
  const holder = useMemo(() => frameObject(object, config), [object, config]);

  // orientation at the start of each step, ending on the correct answer
  const orientations = useMemo(() => {
    const arr = [baseQ.clone()];
    for (let i = 1; i <= steps.length; i++) arr.push(composeRotation(steps.slice(0, i), baseQ));
    return arr;
  }, [steps, baseQ]);

  const elapsed = useRef(0);
  const scratch = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, delta) => {
    if (playing) elapsed.current += delta * 1000;
    const total = steps.length * SEG_MS + HOLD_MS;
    const t = elapsed.current % total;
    const segTime = steps.length * SEG_MS;

    let q: THREE.Quaternion;
    if (t >= segTime) {
      q = orientations[orientations.length - 1];
    } else {
      const seg = Math.min(steps.length - 1, Math.floor(t / SEG_MS));
      const local = (t - seg * SEG_MS) / SEG_MS;
      q = scratch.slerpQuaternions(orientations[seg], orientations[seg + 1], easeInOut(local));
    }
    pivot.current?.quaternion.copy(q);
  });

  return (
    <>
      <hemisphereLight args={[0xffffff, 0x707784, 1.15]} />
      <directionalLight position={[2.5, 3.5, 4]} intensity={1.4} />
      <directionalLight position={[-3, -1, -2]} intensity={0.5} />
      <group ref={pivot}>
        {/* dispose={null}: the clone shares geometry with the model reused for
            question generation, so R3F must not dispose it on unmount. */}
        <primitive object={holder} dispose={null} />
      </group>
    </>
  );
}

export function RotationReplay({ object, steps, baseQ, config, fov = BASE_FOV }: Props) {
  const [playing, setPlaying] = useState(true);
  if (!object) return null;
  return (
    <div>
      <div className="replay-canvas">
        <Canvas camera={{ position: [0, 0, quizCameraDistance(fov)], fov }} dpr={[1, 2]} frameloop="always">
          <Scene object={object} steps={steps} baseQ={baseQ} playing={playing} config={config} />
        </Canvas>
      </div>
      <div className="row" style={{ marginTop: 8, justifyContent: 'center' }}>
        <button className="btn" onClick={() => setPlaying(true)} disabled={playing}>
          ▶ 再生
        </button>
        <button className="btn" onClick={() => setPlaying(false)} disabled={!playing}>
          ⏸ 停止
        </button>
      </div>
    </div>
  );
}
