import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { TextureLoader } from "three";
import * as THREE from "three";
import { getCardArtSources } from "../../lib/cardArt";

// A single 3D card: a thin rounded slab with the card art on its face. Cheap
// (one textured plane + one box) so a full board stays mobile-friendly.
function Card3D({ slug, position, rotationY = 0, hovered = false }: {
  slug: string;
  position: [number, number, number];
  rotationY?: number;
  hovered?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const art = getCardArtSources(slug).primary;
  const texture = useLoader(TextureLoader, art);

  // Gentle idle float so the board feels alive.
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 1.2 + position[0]) * 0.04 + (hovered ? 0.25 : 0);
  });

  return (
    <group ref={ref} position={position} rotation={[0, rotationY, 0]}>
      {/* card body / border */}
      <mesh castShadow>
        <boxGeometry args={[1, 1.4, 0.05]} />
        <meshStandardMaterial color="#0a0e1a" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* art face */}
      <mesh position={[0, 0, 0.031]}>
        <planeGeometry args={[0.9, 1.3]} />
        <meshStandardMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Arena({ enemySlugs, mySlugs }: { enemySlugs: string[]; mySlugs: string[] }) {
  const layout = (slugs: string[], z: number, rotationY: number) => {
    const span = 1.25;
    const start = -((slugs.length - 1) * span) / 2;
    return slugs.map((slug, i) => ({
      slug,
      position: [start + i * span, 0.1, z] as [number, number, number],
      rotationY
    }));
  };
  const enemies = useMemo(() => layout(enemySlugs, -1.4, 0), [enemySlugs]);
  const mine = useMemo(() => layout(mySlugs, 1.4, 0), [mySlugs]);

  return (
    <group>
      {/* The battle table */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color="#0a1320" metalness={0.4} roughness={0.7} />
      </mesh>
      {/* Glowing rift ring at center */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <ringGeometry args={[0.6, 0.75, 48]} />
        <meshBasicMaterial color="#35f3b1" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {enemies.map((c, i) => <Card3D key={`e${i}`} {...c} />)}
      {mine.map((c, i) => <Card3D key={`m${i}`} {...c} />)}
    </group>
  );
}

export type Battlefield3DProps = {
  enemySlugs?: string[];
  mySlugs?: string[];
};

const SAMPLE_ENEMY = ["abyss-revenant-c01", "void-ranger-c01", "chronomancer-c01", "ember-arcanist-c01"];
const SAMPLE_MINE = ["riftforged-sentinel-c01", "ironbound-beastmaster-c01", "ember-arcanist-c02", "void-ranger-c02"];

export default function Battlefield3D({ enemySlugs, mySlugs }: Battlefield3DProps) {
  const enemy = enemySlugs?.length ? enemySlugs : SAMPLE_ENEMY;
  const mine = mySlugs?.length ? mySlugs : SAMPLE_MINE;

  return (
    <Canvas
      shadows
      // Clamp pixel ratio so high-DPI phones don't melt rendering 3x.
      dpr={[1, 1.8]}
      camera={{ position: [0, 4.2, 5.2], fov: 45 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#060d18"]} />
      <fog attach="fog" args={["#060d18", 8, 16]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 6, 4]} intensity={1.1} color="#ffd9a0" castShadow />
      <pointLight position={[0, 2, 0]} intensity={1.4} color="#35a8ff" distance={10} />
      <Suspense fallback={null}>
        <Arena enemySlugs={enemy} mySlugs={mine} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={9}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
