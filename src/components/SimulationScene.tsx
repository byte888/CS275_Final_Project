import { Clone, Environment, Float, OrbitControls, Text, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
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
  swimAmplitude: number;
  modelPath: string;
  modelScale: number;
};

const FISH_STYLES: Record<FishSpecies, FishStyle> = {
  reef: {
    swimAmplitude: 0.2,
    modelPath: "/models/downloaded/Fish.glb",
    modelScale: 0.08,
  },
  blue: {
    swimAmplitude: 0.48,
    modelPath: "/models/downloaded/Fish%20(1).glb",
    modelScale: 0.08,
  },
  puffer: {
    swimAmplitude: 0.24,
    modelPath: "/models/downloaded/Blowfish.glb",
    modelScale: 0.05,
  },
  long: {
    swimAmplitude: 0.56,
    modelPath: "/models/downloaded/Fish%20(2).glb",
    modelScale: 0.2,
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
  const modelRef = useRef<Group>(null);
  const species = useMemo(
    () => stateRef.current.agents.find((agent) => agent.id === agentId)?.species ?? "reef",
    [agentId, stateRef],
  );
  const style = FISH_STYLES[species];
  const fishModel = useGLTF(style.modelPath);
  const { actions } = useAnimations(fishModel.animations, modelRef);
  const phaseOffset = useMemo(() => agentId * 1.913, [agentId]);

  useEffect(() => {
    for (const action of Object.values(actions)) {
      action?.reset().fadeIn(0.2).play();
    }

    return () => {
      for (const action of Object.values(actions)) {
        action?.fadeOut(0.2);
      }
    };
  }, [actions]);

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
    const phase = clock.elapsedTime * (0.55 + speed * 0.18) + phaseOffset;
    const sway = Math.sin(phase);
    const secondarySway = Math.sin(phase + Math.PI / 2);

    if (modelRef.current) {
      modelRef.current.rotation.y = sway * style.swimAmplitude * 0.12;
      modelRef.current.rotation.z = secondarySway * 0.018;
      modelRef.current.scale.setScalar(style.modelScale * (1 + secondarySway * 0.015));
    }
  });

  return (
    <group ref={ref}>
      <group ref={modelRef} scale={style.modelScale}>
        <Clone object={fishModel.scene} castShadow />
      </group>
    </group>
  );
}

function FoodMesh({ position }: { position: Vector3 }) {
  const pattyModel = useGLTF("/models/downloaded/Burger.glb");

  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.25}>
      <group position={position}>
        <Clone object={pattyModel.scene} scale={1.7} castShadow />
        <Text position={[0, 2.0, 0]} fontSize={0.3} color="#fff7ed" anchorX="center">
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

useGLTF.preload("/models/downloaded/Fish.glb");
useGLTF.preload("/models/downloaded/Fish%20(1).glb");
useGLTF.preload("/models/downloaded/Fish%20(2).glb");
useGLTF.preload("/models/downloaded/Blowfish.glb");
useGLTF.preload("/models/downloaded/Burger.glb");

export { defaultConfig };
