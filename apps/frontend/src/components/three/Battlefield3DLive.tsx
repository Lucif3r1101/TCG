import { useRef, useState } from "react";
import { Canvas, useFrame, useLoader, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { TextureLoader } from "three";
import * as THREE from "three";
import type { RoomCard, RoomPlayer } from "../../types/game";
import { getCardArtSources } from "../../lib/cardArt";

const CARD_W = 1;
const CARD_H = 1.4;
const SPAN = 1.2;

type LiveCardProps = {
  card: RoomCard;
  position: [number, number, number];
  defense?: boolean;
  selected?: boolean;
  targetable?: boolean;
  selectable?: boolean;
  faceUpStats?: boolean; // show ATK/DEF (always for own; for enemy too — bluff is only attack/def mode)
  onClick?: () => void;
};

function LiveCard({ card, position, defense, selected, targetable, selectable, faceUpStats, onClick }: LiveCardProps) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const texture = useLoader(TextureLoader, getCardArtSources(card.slug).primary);

  useFrame((state) => {
    if (!ref.current) return;
    const lift = (hovered && (selectable || targetable)) ? 0.22 : 0;
    ref.current.position.y = position[1] + lift;
  });

  const rim = selected ? "#35f3b1" : targetable && hovered ? "#ff5d3a" : "#000000";
  const rimOn = selected || (targetable && hovered);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick?.();
  };
  const cursor = (selectable || targetable) ? "pointer" : "default";

  return (
    <group
      ref={ref}
      position={position}
      rotation={[defense ? -Math.PI / 2.1 : 0, 0, defense ? 0.15 : 0]}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = cursor; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
    >
      <mesh>
        <boxGeometry args={[CARD_W, CARD_H, 0.06]} />
        <meshStandardMaterial color="#0a0e1a" emissive={rim} emissiveIntensity={rimOn ? 0.9 : 0} metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[CARD_W * 0.9, CARD_H * 0.92]} />
        <meshStandardMaterial map={texture} toneMapped={false} />
      </mesh>
      {faceUpStats ? (
        <>
          <Text position={[-CARD_W * 0.32, -CARD_H * 0.36, 0.05]} fontSize={0.16} color="#ffd166" anchorX="center" anchorY="middle">
            {String(card.attack)}
          </Text>
          <Text position={[CARD_W * 0.32, -CARD_H * 0.36, 0.05]} fontSize={0.16} color="#6bc6ff" anchorX="center" anchorY="middle">
            {String(card.health)}
          </Text>
        </>
      ) : null}
    </group>
  );
}

function Pedestal({ player, targetable, onClick, position }: {
  player: RoomPlayer;
  targetable: boolean;
  onClick: () => void;
  position: [number, number, number];
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={position}
      onClick={(e) => { e.stopPropagation(); if (targetable) onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); if (targetable) document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 0.25, 32]} />
        <meshStandardMaterial color="#12203a" emissive={targetable && hovered ? "#ff5d3a" : "#1b3a6b"} emissiveIntensity={targetable ? (hovered ? 0.9 : 0.4) : 0.15} metalness={0.5} roughness={0.5} />
      </mesh>
      <Text position={[0, 0.18, 0]} fontSize={0.2} color="#ff8da3" anchorX="center" anchorY="middle">
        {`HP ${player.health}`}
      </Text>
      <Text position={[0, -0.5, 0]} fontSize={0.16} color="#cfe3ff" anchorX="center" anchorY="middle" maxWidth={2}>
        {player.username}
      </Text>
    </group>
  );
}

function Scene(props: Battlefield3DLiveProps) {
  const { myUnits, enemyUnits, opponents, selectedId, attacking, isMyTurn, onSelectMine, onStrikeUnit, onStrikePlayer } = props;

  const row = (count: number, z: number) => {
    const start = -((count - 1) * SPAN) / 2;
    return (i: number) => [start + i * SPAN, 0.1, z] as [number, number, number];
  };
  const enemyPos = row(Math.max(enemyUnits.length, 1), -1.5);
  const myPos = row(Math.max(myUnits.length, 1), 1.5);

  return (
    <group>
      {/* table */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color="#0a1320" metalness={0.4} roughness={0.75} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <ringGeometry args={[0.5, 0.62, 48]} />
        <meshBasicMaterial color="#35f3b1" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* enemy units (face-up; attack/defense mode hidden — same bluff as 2D) */}
      {enemyUnits.map(({ owner, unit }, i) => (
        <LiveCard
          key={unit.instanceId}
          card={unit}
          position={enemyPos(i)}
          faceUpStats
          targetable={attacking}
          onClick={() => attacking && onStrikeUnit(owner.userId, unit.instanceId)}
        />
      ))}

      {/* my units */}
      {myUnits.map((unit, i) => {
        const inDef = unit.position === "defense";
        const canAct = isMyTurn && unit.canAttack && !inDef;
        return (
          <LiveCard
            key={unit.instanceId}
            card={unit}
            position={myPos(i)}
            defense={inDef}
            faceUpStats
            selected={unit.instanceId === selectedId}
            selectable={canAct}
            onClick={() => canAct && onSelectMine(unit.instanceId)}
          />
        );
      })}

      {/* direct-attack pedestals (only matter when an opponent has no units) */}
      {opponents.map((p, i) => (
        <Pedestal
          key={p.userId}
          player={p}
          position={[(i - (opponents.length - 1) / 2) * 1.8, 0.1, -3.1]}
          targetable={attacking && p.health > 0}
          onClick={() => onStrikePlayer(p.userId, p.health)}
        />
      ))}
    </group>
  );
}

export type Battlefield3DLiveProps = {
  myUnits: RoomCard[];
  enemyUnits: { owner: RoomPlayer; unit: RoomCard }[];
  opponents: RoomPlayer[];
  selectedId: string | null;
  attacking: boolean;
  isMyTurn: boolean;
  onSelectMine: (unitId: string) => void;
  onStrikeUnit: (ownerId: string, unitId: string) => void;
  onStrikePlayer: (ownerId: string, health: number) => void;
};

export default function Battlefield3DLive(props: Battlefield3DLiveProps) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 4.4, 5.4], fov: 46 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => { /* clicking empty space deselects nothing here */ }}
    >
      <color attach="background" args={["#060d18"]} />
      <fog attach="fog" args={["#060d18", 9, 18]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 6, 4]} intensity={1.0} color="#ffd9a0" />
      <pointLight position={[0, 2.5, 0]} intensity={1.3} color="#35a8ff" distance={12} />
      <Scene {...props} />
      <OrbitControls enablePan={false} minDistance={4.5} maxDistance={9} minPolarAngle={0.25} maxPolarAngle={Math.PI / 2.3} target={[0, 0, 0]} />
    </Canvas>
  );
}
