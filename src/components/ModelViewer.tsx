import { Canvas } from '@react-three/fiber';
import { OrbitControls, Bounds, Center } from '@react-three/drei';
import type * as THREE from 'three';

// Interactive 3D preview. OrbitControls owns pointer gestures inside the canvas
// (touch-action: none in CSS); the rest of the page keeps normal tap behaviour.
export function ModelViewer({ object }: { object: THREE.Object3D | null }) {
  return (
    <div className="viewer">
      <Canvas camera={{ position: [2.6, 2, 3.2], fov: 35 }} dpr={[1, 2]}>
        <hemisphereLight args={[0xffffff, 0x707784, 1.15]} />
        <directionalLight position={[3, 4, 5]} intensity={1.3} />
        <directionalLight position={[-3, -1, -2]} intensity={0.45} />
        {object && (
          <Bounds fit clip observe margin={1.2}>
            <Center>
              <primitive object={object} />
            </Center>
          </Bounds>
        )}
        <OrbitControls makeDefault enablePan={false} />
      </Canvas>
    </div>
  );
}
