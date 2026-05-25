import { Clone, Environment, Float, OrbitControls, Text, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { BoxGeometry, Group, Vector3 } from "three";
import {
  createInitialState,
  defaultConfig,
  resizePopulation,
  stepSimulation,
} from "../sim/simulation";
import type { FishSpecies, SimulationConfig, SimulationState } from "../sim/types";

type SimulationSceneProps = {
  config: SimulationConfig;
};

type FishStyle = {
  body: string;
  belly: string;
  fin: string;
  stripe: string;
  bodyScale: [number, number, number];
  tailZ: number;
  tailScale: number;
  finScale: number;
  swimAmplitude: number;
};

const FISH_STYLES: Record<FishSpecies, FishStyle> = {
  reef: {
    body: "#f97316",
    belly: "#fed7aa",
    fin: "#c2410c",
    stripe: "#f8fafc",
    bodyScale: [0.82, 0.5, 1.45],
    tailZ: 0.62,
    tailScale: 0.86,
    finScale: 0.9,
    swimAmplitude: 0.2,
  },
  blue: {
    body: "#2563eb",
    belly: "#dbeafe",
    fin: "#facc15",
    stripe: "#bfdbfe",
    bodyScale: [0.68, 0.38, 1.85],
    tailZ: 0.76,
    tailScale: 0.75,
    finScale: 0.72,
    swimAmplitude: 0.48,
  },
  puffer: {
    body: "#ca8a04",
    belly: "#fef3c7",
    fin: "#854d0e",
    stripe: "#fef08a",
    bodyScale: [0.95, 0.78, 1.03],
    tailZ: 0.48,
    tailScale: 0.58,
    finScale: 0.65,
    swimAmplitude: 0.24,
  },
  long: {
    body: "#64748b",
    belly: "#cbd5e1",
    fin: "#334155",
    stripe: "#e2e8f0",
    bodyScale: [0.55, 0.32, 2.35],
    tailZ: 0.92,
    tailScale: 0.78,
    finScale: 0.62,
    swimAmplitude: 0.56,
  },
};

export function SimulationScene({ config }: SimulationSceneProps) {
  return (
    <Canvas camera={{ position: [0, 7, 16], fov: 50 }} shadows>
      <color attach="background" args={["#082f49"]} />
      <fog attach="fog" args={["#0f5f82", 10, 34]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 9, 6]} intensity={1.4} castShadow />
      <pointLight position={[0, 3, -4]} color="#7dd3fc" intensity={12} distance={20} />
      <SimulationWorld config={config} />
      <OrbitControls enablePan={false} maxDistance={26} minDistance={8} />
      <Environment preset="sunset" />
    </Canvas>
  );
}

function SimulationWorld({ config }: SimulationSceneProps) {
  const stateRef = useRef<SimulationState>(createInitialState(config));
  const [agentIds, setAgentIds] = useState(() => stateRef.current.agents.map((agent) => agent.id));

  useFrame((_, delta) => {
    stateRef.current = resizePopulation(stateRef.current, config);
    stateRef.current = stepSimulation(stateRef.current, config, delta);
    const nextAgentIds = stateRef.current.agents.map((agent) => agent.id);

    if (
      nextAgentIds.length !== agentIds.length ||
      nextAgentIds.some((agentId, index) => agentId !== agentIds[index])
    ) {
      setAgentIds(nextAgentIds);
    }
  });

  return (
    <>
      <Seafloor />
      <BoundaryBox bounds={config.bounds} />
      <FoodMesh position={stateRef.current.food.position} />
      <HazardSwarm stateRef={stateRef} />
      <FishSchool stateRef={stateRef} agentIds={agentIds} />
      <Bubbles />
    </>
  );
}

function FishSchool({
  stateRef,
  agentIds,
}: {
  stateRef: MutableRefObject<SimulationState>;
  agentIds: number[];
}) {
  return (
    <>
      {agentIds.map((agentId) => (
        <FishMesh key={agentId} agentId={agentId} stateRef={stateRef} />
      ))}
    </>
  );
}

function FishMesh({
  agentId,
  stateRef,
}: {
  agentId: number;
  stateRef: MutableRefObject<SimulationState>;
}) {
  const ref = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const tailRef = useRef<Group>(null);
  const leftFinRef = useRef<Group>(null);
  const rightFinRef = useRef<Group>(null);
  const dorsalRef = useRef<Group>(null);
  const species = useMemo(
    () => stateRef.current.agents.find((agent) => agent.id === agentId)?.species ?? "reef",
    [agentId, stateRef],
  );
  const style = FISH_STYLES[species];
  const phaseOffset = useMemo(() => agentId * 1.913, [agentId]);

  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }

    const agent = stateRef.current.agents.find((candidate) => candidate.id === agentId);
    if (!agent) {
      ref.current.visible = false;
      return;
    }

    ref.current.visible = true;
    ref.current.position.copy(agent.position);
    const heading = Math.atan2(agent.velocity.x, agent.velocity.z);
    ref.current.rotation.set(0, heading, 0);

    const speed = agent.velocity.length();
    const phase = clock.elapsedTime * (1.8 + speed * 0.75) + phaseOffset;
    const sway = Math.sin(phase);
    const secondarySway = Math.sin(phase + Math.PI / 2);

    if (bodyRef.current) {
      bodyRef.current.rotation.y = sway * style.swimAmplitude * 0.08;
      bodyRef.current.rotation.z = secondarySway * 0.015;
    }

    if (tailRef.current) {
      tailRef.current.rotation.y = -sway * style.swimAmplitude;
    }

    if (leftFinRef.current) {
      leftFinRef.current.rotation.z = Math.PI / 2 + secondarySway * 0.22;
      leftFinRef.current.rotation.x = 0.12 + sway * 0.06;
    }

    if (rightFinRef.current) {
      rightFinRef.current.rotation.z = -Math.PI / 2 - secondarySway * 0.22;
      rightFinRef.current.rotation.x = 0.12 - sway * 0.06;
    }

    if (dorsalRef.current) {
      dorsalRef.current.rotation.y = sway * 0.12;
    }
  });

  return (
    <group ref={ref}>
      <group ref={bodyRef} scale={0.78}>
        <FishBody species={species} style={style} />
        <group ref={tailRef} position={[0, 0, style.tailZ]}>
          <FishTail style={style} />
        </group>
        <group ref={leftFinRef} position={[-0.28 * style.finScale, -0.02, -0.04]}>
          <FishSideFin style={style} />
        </group>
        <group ref={rightFinRef} position={[0.28 * style.finScale, -0.02, -0.04]}>
          <FishSideFin style={style} />
        </group>
        <group ref={dorsalRef} position={[0, 0.28 * style.finScale, -0.04]}>
          <FishDorsalFin style={style} />
        </group>
      </group>
    </group>
  );
}

function FishBody({ species, style }: { species: FishSpecies; style: FishStyle }) {
  const eyeZ = species === "long" ? -0.62 : species === "blue" ? -0.5 : -0.36;
  const eyeY = species === "puffer" ? 0.13 : 0.1;
  const eyeX = species === "long" ? 0.08 : 0.12;

  return (
    <>
      <mesh position={[0, -0.1, -0.02]} scale={[style.bodyScale[0] * 0.75, 0.24, style.bodyScale[2] * 0.78]} castShadow>
        <sphereGeometry args={[0.34, 18, 10]} />
        <meshStandardMaterial color={style.belly} roughness={0.76} />
      </mesh>
      <group scale={style.bodyScale}>
        <mesh castShadow>
          <sphereGeometry args={[0.34, 28, 16]} />
          <meshStandardMaterial color={style.body} roughness={0.68} metalness={0.03} />
        </mesh>
      </group>
      {species !== "puffer" && [-0.24, 0.08, 0.36].map((z) => <FishStripe key={z} color={style.stripe} z={z} />)}
      {species === "puffer" && <PufferSpikes color={style.stripe} />}
      <FishEyes z={eyeZ} y={eyeY} x={eyeX} />
    </>
  );
}

function FishStripe({ color, z }: { color: string; z: number }) {
  return (
    <mesh position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.56, 1]}>
      <torusGeometry args={[0.28, 0.012, 8, 24]} />
      <meshStandardMaterial color={color} roughness={0.82} />
    </mesh>
  );
}

function FishEyes({ z, y, x }: { z: number; y: number; x: number }) {
  return (
    <>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * x, y, z]} castShadow>
          <sphereGeometry args={[0.026, 8, 6]} />
          <meshStandardMaterial color="#111827" roughness={0.35} />
        </mesh>
      ))}
    </>
  );
}

function FishTail({ style }: { style: FishStyle }) {
  return (
    <>
      <mesh position={[0, 0.14 * style.tailScale, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} castShadow>
        <coneGeometry args={[0.16 * style.tailScale, 0.55 * style.tailScale, 3]} />
        <meshStandardMaterial color={style.fin} roughness={0.74} />
      </mesh>
      <mesh position={[0, -0.14 * style.tailScale, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} castShadow>
        <coneGeometry args={[0.16 * style.tailScale, 0.55 * style.tailScale, 3]} />
        <meshStandardMaterial color={style.fin} roughness={0.74} />
      </mesh>
    </>
  );
}

function FishSideFin({ style }: { style: FishStyle }) {
  return (
    <mesh castShadow>
      <coneGeometry args={[0.09 * style.finScale, 0.38 * style.finScale, 3]} />
      <meshStandardMaterial color={style.fin} roughness={0.78} />
    </mesh>
  );
}

function FishDorsalFin({ style }: { style: FishStyle }) {
  return (
    <mesh rotation={[0, 0, Math.PI]} castShadow>
      <coneGeometry args={[0.11 * style.finScale, 0.42 * style.finScale, 3]} />
      <meshStandardMaterial color={style.fin} roughness={0.78} />
    </mesh>
  );
}

function PufferSpikes({ color }: { color: string }) {
  return (
    <>
      {Array.from({ length: 14 }, (_, index) => {
        const angle = (index / 14) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 0.32, Math.sin(angle) * 0.22, Math.sin(index * 1.7) * 0.22]}
            rotation={[0, 0, -angle + Math.PI / 2]}
            castShadow
          >
            <coneGeometry args={[0.018, 0.13, 7]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
        );
      })}
    </>
  );
}

function FoodMesh({ position }: { position: Vector3 }) {
  const pattyModel = useGLTF("/models/krabby-patty.glb");

  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.25}>
      <group position={position}>
        <Clone object={pattyModel.scene} scale={1.05} castShadow />
        <Text position={[0, 0.9, 0]} fontSize={0.28} color="#fff7ed" anchorX="center">
          Krabby Patty
        </Text>
      </group>
    </Float>
  );
}

function HazardSwarm({ stateRef }: { stateRef: MutableRefObject<SimulationState> }) {
  const ref = useRef<Group>(null);
  const offsets = useMemo(
    () =>
      Array.from({ length: 9 }, (_, index) => {
        const angle = (index / 9) * Math.PI * 2;
        return new Vector3(Math.cos(angle) * 0.85, Math.sin(index) * 0.35, Math.sin(angle) * 0.85);
      }),
    [],
  );

  useFrame(() => {
    if (!ref.current) {
      return;
    }

    const hazard = stateRef.current.hazard;
    ref.current.position.copy(hazard.position);
  });

  return (
    <group ref={ref}>
      {offsets.map((offset, index) => (
        <AnimatedJellyfish key={index} offset={offset} index={index} />
      ))}
      <Text position={[0, 1.2, 0]} fontSize={0.3} color="#f5d0fe" anchorX="center">
        Jellyfish Hazard
      </Text>
    </group>
  );
}

function AnimatedJellyfish({ offset, index }: { offset: Vector3; index: number }) {
  const groupRef = useRef<Group>(null);
  const bellRef = useRef<Group>(null);
  const tentacleRefs = useRef<Array<Group | null>>([]);
  const phaseOffset = useMemo(() => index * 0.73, [index]);

  useFrame(({ clock }) => {
    const phase = clock.elapsedTime * 1.35 + phaseOffset;
    const pulse = Math.sin(phase);

    if (groupRef.current) {
      groupRef.current.position.set(
        offset.x,
        offset.y + Math.sin(phase * 0.8) * 0.12,
        offset.z,
      );
      groupRef.current.rotation.y = Math.sin(phase * 0.35) * 0.18;
    }

    if (bellRef.current) {
      bellRef.current.scale.set(1 + pulse * 0.08, 0.82 - pulse * 0.08, 1 + pulse * 0.08);
    }

    tentacleRefs.current.forEach((tentacle, tentacleIndex) => {
      if (!tentacle) {
        return;
      }

      const tentaclePhase = phase - tentacleIndex * 0.35;
      tentacle.rotation.x = Math.sin(tentaclePhase) * 0.16;
      tentacle.rotation.z = Math.cos(tentaclePhase * 0.9) * 0.18;
      tentacle.position.y = -0.36 - pulse * 0.04;
    });
  });

  return (
    <group ref={groupRef} position={offset} scale={0.58}>
      <group ref={bellRef}>
        <mesh castShadow>
          <sphereGeometry args={[0.48, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial
            color="#d8b4fe"
            emissive="#7c3aed"
            emissiveIntensity={0.32}
            roughness={0.42}
            transparent
            opacity={0.86}
          />
        </mesh>
        <mesh position={[0, -0.08, 0]}>
          <torusGeometry args={[0.33, 0.025, 8, 28]} />
          <meshStandardMaterial
            color="#c4b5fd"
            emissive="#6d28d9"
            emissiveIntensity={0.22}
            transparent
            opacity={0.78}
          />
        </mesh>
      </group>
      {Array.from({ length: 10 }, (_, tentacleIndex) => {
        const angle = (tentacleIndex / 10) * Math.PI * 2;
        const radius = tentacleIndex % 2 === 0 ? 0.19 : 0.28;

        return (
          <group
            key={tentacleIndex}
            ref={(node) => {
              tentacleRefs.current[tentacleIndex] = node;
            }}
            position={[Math.cos(angle) * radius, -0.36, Math.sin(angle) * radius]}
          >
            <mesh position={[0, -0.28, 0]}>
              <cylinderGeometry args={[0.012, 0.006, 0.58, 7]} />
              <meshStandardMaterial
                color="#c084fc"
                emissive="#7e22ce"
                emissiveIntensity={0.24}
                transparent
                opacity={0.78}
              />
            </mesh>
            <mesh position={[0, -0.68, 0]}>
              <cylinderGeometry args={[0.007, 0.003, 0.44, 6]} />
              <meshStandardMaterial
                color="#e9d5ff"
                emissive="#a855f7"
                emissiveIntensity={0.2}
                transparent
                opacity={0.62}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Seafloor() {
  return (
    <mesh position={[0, -5.1, 0]} receiveShadow>
      <boxGeometry args={[30, 0.25, 22]} />
      <meshStandardMaterial color="#c2a36b" roughness={0.9} />
    </mesh>
  );
}

function BoundaryBox({ bounds }: { bounds: Vector3 }) {
  const geometry = useMemo(() => new BoxGeometry(bounds.x * 2, bounds.y * 2, bounds.z * 2), [bounds]);

  return (
    <lineSegments>
      <edgesGeometry args={[geometry]} />
      <meshBasicMaterial color="#bae6fd" transparent opacity={0.25} />
    </lineSegments>
  );
}

function Bubbles() {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 26 }, (_, index) => ({
        position: new Vector3(
          Math.sin(index * 4.2) * 10,
          -4 + (index % 9),
          Math.cos(index * 2.8) * 7,
        ),
        scale: 0.05 + (index % 4) * 0.025,
      })),
    [],
  );

  return (
    <>
      {bubbles.map((bubble, index) => (
        <Float key={index} speed={0.7 + index * 0.01} floatIntensity={1.6}>
          <mesh position={bubble.position}>
            <sphereGeometry args={[bubble.scale, 10, 8]} />
            <meshStandardMaterial color="#e0f2fe" transparent opacity={0.38} />
          </mesh>
        </Float>
      ))}
    </>
  );
}

useGLTF.preload("/models/krabby-patty.glb");

export { defaultConfig };
