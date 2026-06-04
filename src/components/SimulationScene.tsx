import { Clone, Environment, Float, OrbitControls, Text, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Box3, BoxGeometry, Group, Vector3 } from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  createInitialState,
  defaultConfig,
  HAZARD_SWARM_SIZE,
  resizePopulation,
  stepSimulation,
} from "../sim/simulation";
import { STATIC_SCENE_OBJECTS, type StaticSceneObject } from "../sim/staticEnvironment";
import type { FishSpecies, SimulationConfig, SimulationState } from "../sim/types";

type SimulationSceneProps = {
  config: SimulationConfig;
};

type FishStyle = {
  swimAmplitude: number;
  modelPath: string;
  modelScale: number;
  modelOffsetY?: number;
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
  spongebob: {
    swimAmplitude: 0.35,
    modelPath: "/models/downloaded/spongebob.glb",
    modelScale: 2.7,
  },
  patrick: {
    swimAmplitude: 0.18,
    modelPath: "/models/downloaded/patrick.glb",
    modelScale: 0.6,
  },
  squidward: {
    swimAmplitude: 0.25,
    modelPath: "/models/downloaded/squidward.glb",
    modelScale: 0.0035,
    modelOffsetY: 0.95,
  },
};

export function SimulationScene({ config }: SimulationSceneProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <Canvas camera={{ position: [0, 7, 16], fov: 50 }} shadows>
      <color attach="background" args={["#082f49"]} />
      <fog attach="fog" args={["#0f5f82", 10, 34]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 9, 6]} intensity={1.4} castShadow />
      <pointLight position={[0, 3, -4]} color="#7dd3fc" intensity={12} distance={20} />
      <SimulationWorld config={config} />
      <KeyboardCameraControls controlsRef={controlsRef} />
      <OrbitControls ref={controlsRef} enablePan={false} maxDistance={26} minDistance={8} />
      <Environment preset="sunset" />
    </Canvas>
  );
}

function KeyboardCameraControls({
  controlsRef,
}: {
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const pressedKeysRef = useRef(new Set<string>());
  const forwardRef = useRef(new Vector3());
  const rightRef = useRef(new Vector3());
  const movementRef = useRef(new Vector3());

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const tagName = target.tagName.toLowerCase();
      return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "w" || key === "a" || key === "s" || key === "d") {
        pressedKeysRef.current.add(key);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeysRef.current.delete(event.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    const pressedKeys = pressedKeysRef.current;
    if (pressedKeys.size === 0) {
      return;
    }

    const movement = movementRef.current.set(0, 0, 0);
    const forward = forwardRef.current;
    const right = rightRef.current;

    camera.getWorldDirection(forward);
    forward.y = 0;

    if (forward.lengthSq() === 0) {
      return;
    }

    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();

    if (pressedKeys.has("w")) {
      movement.add(forward);
    }

    if (pressedKeys.has("s")) {
      movement.sub(forward);
    }

    if (pressedKeys.has("a")) {
      movement.sub(right);
    }

    if (pressedKeys.has("d")) {
      movement.add(right);
    }

    if (movement.lengthSq() === 0) {
      return;
    }

    movement.normalize().multiplyScalar(9 * delta);
    camera.position.add(movement);

    if (controlsRef.current) {
      controlsRef.current.target.add(movement);
      controlsRef.current.update();
    }
  });

  return null;
}

function SimulationWorld({ config }: SimulationSceneProps) {
  const stateRef = useRef<SimulationState>(createInitialState(config));
  const agentMapRef = useRef(new Map(stateRef.current.agents.map((agent) => [agent.id, agent])));
  const initialAgentIds = useMemo(() => stateRef.current.agents.map((agent) => agent.id), []);
  const agentIdsRef = useRef(initialAgentIds);
  const [agentIds, setAgentIds] = useState(initialAgentIds);

  useFrame((_, delta) => {
    stateRef.current = resizePopulation(stateRef.current, config);
    stateRef.current = stepSimulation(stateRef.current, config, delta);
    agentMapRef.current = new Map(stateRef.current.agents.map((agent) => [agent.id, agent]));
    const nextAgentIds = stateRef.current.agents.map((agent) => agent.id);
    const currentAgentIds = agentIdsRef.current;

    if (
      nextAgentIds.length !== currentAgentIds.length ||
      nextAgentIds.some((agentId, index) => agentId !== currentAgentIds[index])
    ) {
      agentIdsRef.current = nextAgentIds;
      setAgentIds(nextAgentIds);
    }
  });

  return (
    <>
      <Seafloor />
      <BoundaryBox bounds={config.bounds} />
      <StaticGroundObjects />
      <FoodMesh position={stateRef.current.food.position} />
      <HazardSwarm stateRef={stateRef} />
      <FishSchool agentMapRef={agentMapRef} agentIds={agentIds} />
      <Bubbles />
    </>
  );
}

function FishSchool({
  agentMapRef,
  agentIds,
}: {
  agentMapRef: MutableRefObject<Map<number, SimulationState["agents"][number]>>;
  agentIds: number[];
}) {
  return (
    <>
      {agentIds.map((agentId) => (
        <FishMesh key={agentId} agentId={agentId} agentMapRef={agentMapRef} />
      ))}
    </>
  );
}

function FishMesh({
  agentId,
  agentMapRef,
}: {
  agentId: number;
  agentMapRef: MutableRefObject<Map<number, SimulationState["agents"][number]>>;
}) {
  const ref = useRef<Group>(null);
  const modelRef = useRef<Group>(null);
  const species = useMemo(() => agentMapRef.current.get(agentId)?.species ?? "reef", [agentId, agentMapRef]);
  const style = FISH_STYLES[species];
  const fishModel = useGLTF(style.modelPath);
  const clonedScene = useMemo(() => cloneSkeleton(fishModel.scene), [fishModel.scene]);
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

    const agent = agentMapRef.current.get(agentId);
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
      <group
        ref={modelRef}
        scale={style.modelScale}
        position={[0, style.modelOffsetY ?? 0, 0]}
      >
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

function StaticGroundObjects() {
  return (
    <>
      {STATIC_SCENE_OBJECTS.map((object) => (
        <StaticGroundObject key={object.id} object={object} />
      ))}
    </>
  );
}

function StaticGroundObject({ object }: { object: StaticSceneObject }) {
  const model = useGLTF(object.modelPath);
  const modelTransform = useMemo(() => {
    const box = new Box3().setFromObject(model.scene);
    const center = new Vector3();
    box.getCenter(center);

    return {
      offset: new Vector3(
        -center.x * object.scale,
        -box.min.y * object.scale,
        -center.z * object.scale,
      ),
    };
  }, [model.scene, object.scale]);

  return (
    <group position={object.position} rotation={[0, object.rotationY, 0]}>
      <Clone
        object={model.scene}
        scale={object.scale}
        position={modelTransform.offset}
        castShadow
        receiveShadow
      />
    </group>
  );
}

function FoodMesh({ position }: { position: Vector3 }) {
  const pattyModel = useGLTF("/models/downloaded/Burger.glb");

  return (
    <group position={position}>
      <Clone object={pattyModel.scene} scale={2.8} castShadow />
      <Text position={[0, 2.0, 0]} fontSize={0.3} color="#fff7ed" anchorX="center">
        Krabby Patty
      </Text>
    </group>
  );
}

function HazardSwarm({ stateRef }: { stateRef: MutableRefObject<SimulationState> }) {
  const ref = useRef<Group>(null);
  const memberIndexes = useMemo(
    () => Array.from({ length: HAZARD_SWARM_SIZE }, (_, index) => index),
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
      {memberIndexes.map((index) => (
        <AnimatedJellyfish
          key={index}
          stateRef={stateRef}
          index={index}
          isLeader={index === 0}
        />
      ))}
      <Text position={[0, 1.55, 0]} fontSize={0.3} color="#f5d0fe" anchorX="center">
        Jellyfish Hazard
      </Text>
    </group>
  );
}

function AnimatedJellyfish({
  stateRef,
  index,
  isLeader,
}: {
  stateRef: MutableRefObject<SimulationState>;
  index: number;
  isLeader: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const bellRef = useRef<Group>(null);
  const tentacleRefs = useRef<Array<Group | null>>([]);
  const phaseOffset = useMemo(() => index * 0.73, [index]);
  const scale = isLeader ? 0.74 : 0.56;
  const bellColor = isLeader ? "#f0abfc" : "#d8b4fe";
  const bellEmissive = isLeader ? "#db2777" : "#7c3aed";
  const tentacleColor = isLeader ? "#f9a8d4" : "#c084fc";
  const tentacleEmissive = isLeader ? "#be185d" : "#7e22ce";

  useFrame(({ clock }) => {
    const hazard = stateRef.current.hazard;
    const member = hazard.members[index];
    const phase = clock.elapsedTime * 1.35 + (member?.phaseOffset ?? phaseOffset);
    const pulse = Math.sin(phase);

    if (groupRef.current) {
      if (!member) {
        groupRef.current.visible = false;
        return;
      }

      groupRef.current.visible = true;
      groupRef.current.position.set(
        member.position.x - hazard.position.x,
        member.position.y - hazard.position.y + Math.sin(phase * 0.8) * 0.12,
        member.position.z - hazard.position.z,
      );
      const heading =
        member.velocity.lengthSq() > 0.0001
          ? Math.atan2(member.velocity.x, member.velocity.z)
          : 0;
      groupRef.current.rotation.y = heading + Math.sin(phase * 0.35) * 0.18;
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
    <group ref={groupRef} scale={scale}>
      <group ref={bellRef}>
        <mesh castShadow>
          <sphereGeometry args={[0.48, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial
            color={bellColor}
            emissive={bellEmissive}
            emissiveIntensity={isLeader ? 0.45 : 0.32}
            roughness={0.42}
            transparent
            opacity={isLeader ? 0.9 : 0.86}
          />
        </mesh>
        {isLeader && (
          <mesh position={[0, 0.28, 0]}>
            <sphereGeometry args={[0.08, 12, 8]} />
            <meshStandardMaterial color="#fde68a" emissive="#f59e0b" emissiveIntensity={0.55} />
          </mesh>
        )}
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
                color={tentacleColor}
                emissive={tentacleEmissive}
                emissiveIntensity={isLeader ? 0.32 : 0.24}
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
useGLTF.preload("/models/downloaded/spongebob.glb");
useGLTF.preload("/models/downloaded/patrick.glb");
useGLTF.preload("/models/downloaded/squidward.glb");
STATIC_SCENE_OBJECTS.forEach((object) => useGLTF.preload(object.modelPath));

export { defaultConfig };
