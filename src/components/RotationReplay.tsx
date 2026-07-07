import { memo, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RotationStep } from '../types';
import type { ModelConfig } from '../store/modelConfigStore';
import { composeRotation } from '../three/rotation';
import { BASE_FOV, quizCameraDistance } from '../three/renderCamera';

// Looping animation of the model rotating from the base pose through each step to
// the correct answer, holding briefly on the answer, then repeating. Same camera
// as the snapshot renderer so it matches the option images. Transport controls
// below: first / step-back / play-pause / step-forward / last.
//
// The animation is driven entirely through refs (position, hold timer, play
// flag), so nothing in the 3D scene re-renders while it plays — only the small
// play/pause icon updates. Keyframes are the base pose + the pose after each
// step; "position" is a continuous value in [0, N] (N = number of steps).

const SEG_MS = 850; // time to animate one step during playback
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

interface SceneRefs {
  pos: React.MutableRefObject<number>;
  hold: React.MutableRefObject<number>;
  playing: React.MutableRefObject<boolean>;
}

// memo + all-stable props (object, orientations, refs, config) => this never
// re-renders after mount, even as play/pause and stepping happen via the refs.
const Scene = memo(function Scene({
  object,
  orientations,
  refs,
  config,
}: {
  object: THREE.Object3D;
  orientations: THREE.Quaternion[];
  refs: SceneRefs;
  config?: ModelConfig;
}) {
  const pivot = useRef<THREE.Group>(null);
  const holder = useMemo(() => frameObject(object, config), [object, config]);
  const scratch = useMemo(() => new THREE.Quaternion(), []);
  const N = orientations.length - 1;

  useFrame((_, delta) => {
    const dtMs = delta * 1000;
    if (refs.playing.current && N > 0) {
      if (refs.hold.current > 0) {
        refs.hold.current -= dtMs;
        if (refs.hold.current <= 0) {
          refs.hold.current = 0;
          refs.pos.current = 0; // loop back to the start
        }
      } else {
        refs.pos.current += dtMs / SEG_MS;
        if (refs.pos.current >= N) {
          refs.pos.current = N;
          refs.hold.current = HOLD_MS; // hold on the answer, then loop
        }
      }
    }

    const pos = Math.max(0, Math.min(N, refs.pos.current));
    let q: THREE.Quaternion;
    if (N === 0) {
      q = orientations[0];
    } else {
      const seg = Math.min(N - 1, Math.floor(pos));
      q = scratch.slerpQuaternions(orientations[seg], orientations[seg + 1], easeInOut(pos - seg));
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
});

export function RotationReplay({ object, steps, baseQ, config, fov = BASE_FOV }: Props) {
  const orientations = useMemo(() => {
    const arr = [baseQ.clone()];
    for (let i = 1; i <= steps.length; i++) arr.push(composeRotation(steps.slice(0, i), baseQ));
    return arr;
  }, [steps, baseQ]);
  const N = orientations.length - 1;

  // Refs drive the animation (read every frame); the two states below only feed
  // the controls' icon + disabled state and update on user actions, never per-frame.
  const posRef = useRef(0);
  const holdRef = useRef(0);
  const playingRef = useRef(true); // autoplay when the answer is revealed
  const refs = useRef<SceneRefs>({ pos: posRef, hold: holdRef, playing: playingRef }).current;

  const [playing, setPlaying] = useState(true);
  const [pos, setPos] = useState(0);

  if (!object) return null;

  const seek = (value: number) => {
    const v = Math.max(0, Math.min(N, value));
    posRef.current = v;
    holdRef.current = 0;
    playingRef.current = false;
    setPos(v);
    setPlaying(false);
  };
  const toFirst = () => seek(0);
  const stepBack = () => seek(Math.ceil(posRef.current) - 1);
  const stepFwd = () => seek(Math.floor(posRef.current) + 1);
  const toLast = () => seek(N);

  const togglePlay = () => {
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      setPos(posRef.current); // sync for disabled state
    } else {
      playingRef.current = true;
      setPlaying(true);
    }
  };

  // Disabled state only matters while paused (during play the position moves).
  const atStart = !playing && pos <= 0;
  const atEnd = !playing && pos >= N;

  return (
    <div>
      <div className="replay-canvas">
        <Canvas camera={{ position: [0, 0, quizCameraDistance(fov)], fov }} dpr={[1, 2]} frameloop="always">
          <Scene object={object} orientations={orientations} refs={refs} config={config} />
        </Canvas>
      </div>
      <div className="replay-controls">
        <button className="tb-btn" onClick={toFirst} disabled={atStart} title="最初に戻る" aria-label="最初に戻る">
          <IconFirst />
        </button>
        <button className="tb-btn" onClick={stepBack} disabled={atStart} title="1ステップ戻る" aria-label="1ステップ戻る">
          <IconStepBack />
        </button>
        <button
          className="tb-btn play-btn"
          onClick={togglePlay}
          title={playing ? '一時停止' : '再生'}
          aria-label={playing ? '一時停止' : '再生'}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button className="tb-btn" onClick={stepFwd} disabled={atEnd} title="1ステップ進む" aria-label="1ステップ進む">
          <IconStepFwd />
        </button>
        <button className="tb-btn" onClick={toLast} disabled={atEnd} title="最後まで" aria-label="最後まで">
          <IconLast />
        </button>
      </div>
    </div>
  );
}

// --- transport icons (16x16, currentColor) ----------------------------------

function IconPlay() {
  return (
    <svg className="tb-svg" viewBox="0 0 16 16" aria-hidden>
      <path d="M4 3 L13 8 L4 13 Z" fill="currentColor" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg className="tb-svg" viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <rect x="4" y="3" width="3" height="10" rx="0.5" />
      <rect x="9" y="3" width="3" height="10" rx="0.5" />
    </svg>
  );
}
function IconStepBack() {
  return (
    <svg className="tb-svg" viewBox="0 0 16 16" aria-hidden>
      <path d="M11.5 3 L5 8 L11.5 13 Z" fill="currentColor" />
    </svg>
  );
}
function IconStepFwd() {
  return (
    <svg className="tb-svg" viewBox="0 0 16 16" aria-hidden>
      <path d="M4.5 3 L11 8 L4.5 13 Z" fill="currentColor" />
    </svg>
  );
}
function IconFirst() {
  return (
    <svg className="tb-svg" viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <rect x="3" y="3" width="2" height="10" rx="0.5" />
      <path d="M13 3 L6.5 8 L13 13 Z" />
    </svg>
  );
}
function IconLast() {
  return (
    <svg className="tb-svg" viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <path d="M3 3 L9.5 8 L3 13 Z" />
      <rect x="11" y="3" width="2" height="10" rx="0.5" />
    </svg>
  );
}
