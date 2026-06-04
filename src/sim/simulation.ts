import { Vector3 } from "three";
import type {
  FishAgent,
  FishSpecies,
  FoodSource,
  Hazard,
  HazardMember,
  NeighborSample,
  SimulationConfig,
  SimulationState,
} from "./types";

type FishGroupProfile = {
  species: FishSpecies;
  color: string;
  origin: Vector3;
  solo?: boolean;
  groundWalk?: boolean;
};

const FISH_SCHOOLS: FishGroupProfile[] = [
  { species: "reef", color: "#f97316", origin: new Vector3(-7.4, -0.4, -4.4) },
  { species: "blue", color: "#38bdf8", origin: new Vector3(-7.0, 1.0, 4.3) },
  { species: "puffer", color: "#eab308", origin: new Vector3(1.8, -1.6, 4.1) },
  { species: "long", color: "#94a3b8", origin: new Vector3(3.4, 1.2, -4.2) },
];

const CHARACTERS: FishGroupProfile[] = [
  { species: "spongebob", color: "#facc15", origin: new Vector3(4.5, 0, -1.0), solo: true, groundWalk: true },
  { species: "patrick", color: "#fb7185", origin: new Vector3(-2.0, 0, 2.5), solo: true, groundWalk: true },
  { species: "squidward", color: "#5eead4", origin: new Vector3(6.0, 0, 3.5), solo: true, groundWalk: true },
];

const FISH_GROUPS: FishGroupProfile[] = [...FISH_SCHOOLS, ...CHARACTERS];

const FLOOR_CLEARANCE = 1.05;
const GROUND_WALK_Y = -5;
const MIN_GROUND_SPEED = 1.2;
const FOOD_COLLISION_RADIUS = 3.0;
const CHARACTER_COLLISION_RADIUS = 0.5;
export const HAZARD_SWARM_SIZE = 10;
const HAZARD_LEADER_SPEED = 1.65;
const HAZARD_LEADER_MAX_FORCE = 1.4;
const HAZARD_FOLLOWER_MAX_SPEED = 2.2;
const HAZARD_FOLLOW_STIFFNESS = 2.0;
const HAZARD_TARGET_REACHED_RADIUS = 1.3;
const UP_AXIS = new Vector3(0, 1, 0);

export const defaultConfig: SimulationConfig = {
  agentCount: 48,
  perceptionRadius: 4.2,
  separationRadius: 1.1,
  maxSpeed: 3.2,
  maxForce: 3.6,
  bounds: new Vector3(12, 5, 8),
  weights: {
    food: 1.15,
    hazard: 2.8,
    separation: 1.8,
    alignment: 0.9,
    cohesion: 0.65,
    boundary: 1.25,
  },
};

export function createInitialState(config: SimulationConfig = defaultConfig): SimulationState {
  return {
    agents: createAgents(config.agentCount, config.bounds, 0, config.agentCount),
    food: {
      position: new Vector3(5.5, -4.0, -1.6),
      radius: 1.5,
    },
    hazard: createHazard(config.bounds),
    time: 0,
  };
}

export function resizePopulation(state: SimulationState, config: SimulationConfig): SimulationState {
  if (state.agents.length === config.agentCount) {
    return state;
  }

  const agents =
    state.agents.length > config.agentCount
      ? state.agents.slice(0, config.agentCount)
      : [
          ...state.agents,
          ...createAgents(
            config.agentCount - state.agents.length,
            config.bounds,
            state.agents.length,
            config.agentCount,
          ),
        ];

  return { ...state, agents };
}

export function stepSimulation(
  state: SimulationState,
  config: SimulationConfig,
  deltaSeconds: number,
): SimulationState {
  const dt = Math.min(deltaSeconds, 0.04);
  const hazard = updateHazard(state.hazard, config, dt, state.time + dt);
  const agents = state.agents.map((agent) => {
    const neighbors = senseNeighbors(agent, state.agents, config.perceptionRadius);
    const force = new Vector3();

    force.addScaledVector(attractFood(agent, state.food, config), config.weights.food);
    force.addScaledVector(avoidHazard(agent, hazard, config), config.weights.hazard);
    force.addScaledVector(separate(agent, neighbors, config), config.weights.separation);
    if (!agent.groundWalk) {
      force.addScaledVector(align(agent, neighbors, config), config.weights.alignment);
      force.addScaledVector(cohere(agent, neighbors, config), config.weights.cohesion);
    }
    force.addScaledVector(steerWithinBounds(agent, config), config.weights.boundary);

    if (agent.groundWalk) {
      force.y = 0;
    }

    clampLength(force, config.maxForce);

    const velocity = agent.velocity.clone().addScaledVector(force, dt);
    if (agent.groundWalk) {
      velocity.y = 0;
      enforceMinHorizSpeed(velocity, MIN_GROUND_SPEED);
    }
    clampLength(velocity, config.maxSpeed);
    const position = agent.position.clone().addScaledVector(velocity, dt);
    constrainPosition(position, velocity, config);
    keepOutOfFood(position, velocity, state.food.position);
    if (agent.groundWalk) {
      position.y = GROUND_WALK_Y;
    }

    return {
      ...agent,
      position,
      velocity,
    };
  });

  resolveCharacterCollisions(agents);

  return {
    ...state,
    agents,
    hazard,
    time: state.time + dt,
  };
}

function resolveCharacterCollisions(agents: FishAgent[]) {
  const minDist = CHARACTER_COLLISION_RADIUS * 2;
  const minDistSq = minDist * minDist;
  for (let i = 0; i < agents.length; i++) {
    if (!agents[i].groundWalk) continue;
    for (let j = i + 1; j < agents.length; j++) {
      if (!agents[j].groundWalk) continue;
      const a = agents[i];
      const b = agents[j];
      const dx = b.position.x - a.position.x;
      const dz = b.position.z - a.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq >= minDistSq) continue;
      const dist = Math.sqrt(distSq);
      let nx: number;
      let nz: number;
      if (dist < 1e-4) {
        nx = 1;
        nz = 0;
      } else {
        nx = dx / dist;
        nz = dz / dist;
      }
      const overlap = minDist - dist;
      const half = overlap / 2;
      a.position.x -= nx * half;
      a.position.z -= nz * half;
      b.position.x += nx * half;
      b.position.z += nz * half;
      const aInto = a.velocity.x * nx + a.velocity.z * nz;
      if (aInto > 0) {
        a.velocity.x -= nx * aInto;
        a.velocity.z -= nz * aInto;
      }
      const bInto = b.velocity.x * nx + b.velocity.z * nz;
      if (bInto < 0) {
        b.velocity.x -= nx * bInto;
        b.velocity.z -= nz * bInto;
      }
    }
  }
}

function pickGroupForId(id: number, totalCount: number): { group: FishGroupProfile; groupId: number } {
  const characterCount = CHARACTERS.length;

  if (id < characterCount) {
    const groupId = FISH_SCHOOLS.length + id;
    return { group: FISH_GROUPS[groupId], groupId };
  }

  const fishIndex = id - characterCount;
  const fishCount = Math.max(1, totalCount - characterCount);
  const groupSize = Math.max(1, Math.ceil(fishCount / FISH_SCHOOLS.length));
  const groupId = Math.min(FISH_SCHOOLS.length - 1, Math.floor(fishIndex / groupSize));
  return { group: FISH_GROUPS[groupId], groupId };
}

function createAgents(count: number, bounds: Vector3, startId = 0, totalCount = count): FishAgent[] {
  return Array.from({ length: count }, (_, index) => {
    const id = startId + index;
    const { group, groupId } = pickGroupForId(id, totalCount);
    const position = group.origin
      .clone()
      .add(
        new Vector3(
          randomBetween(-1.4, 1.4),
          randomBetween(-0.9, 0.9),
          randomBetween(-1.4, 1.4),
        ),
      )
      .clamp(
        new Vector3(-bounds.x * 0.85, -bounds.y + FLOOR_CLEARANCE, -bounds.z * 0.85),
        bounds.clone().multiplyScalar(0.85),
      );

    if (group.groundWalk) {
      position.y = GROUND_WALK_Y;
    }

    const velocity = new Vector3(
      randomBetween(-1, 1),
      group.groundWalk ? 0 : randomBetween(-0.25, 0.25),
      randomBetween(-1, 1),
    );

    if (velocity.lengthSq() === 0) {
      velocity.set(1, 0, 0);
    }

    return {
      id,
      position,
      velocity: velocity.normalize().multiplyScalar(randomBetween(1.2, 2.4)),
      color: group.color,
      species: group.species,
      groupId,
      groundWalk: group.groundWalk ?? false,
    };
  });
}

function createHazard(bounds: Vector3): Hazard {
  const leaderPosition = new Vector3(-2.2, 1.2, 1.8).clamp(
    hazardMinBounds(bounds),
    hazardMaxBounds(bounds),
  );
  const leaderVelocity = new Vector3(1.2, 0.2, -0.8)
    .normalize()
    .multiplyScalar(HAZARD_LEADER_SPEED);

  return {
    position: leaderPosition.clone(),
    radius: 3.2,
    phase: 0,
    leaderPosition,
    leaderVelocity,
    targetPosition: pickHazardTarget(bounds, leaderPosition),
    members: createHazardMembers(leaderPosition),
  };
}

function updateHazard(
  hazard: Hazard,
  config: SimulationConfig,
  dt: number,
  time: number,
): Hazard {
  const leaderPosition = (hazard.leaderPosition ?? hazard.position).clone();
  const leaderVelocity = (hazard.leaderVelocity ?? randomDirection().multiplyScalar(HAZARD_LEADER_SPEED)).clone();
  let targetPosition = (hazard.targetPosition ?? pickHazardTarget(config.bounds, leaderPosition)).clone();

  if (leaderPosition.distanceTo(targetPosition) < HAZARD_TARGET_REACHED_RADIUS) {
    targetPosition = pickHazardTarget(config.bounds, leaderPosition);
  }

  const toTarget = targetPosition.clone().sub(leaderPosition);
  const desiredVelocity =
    toTarget.lengthSq() > 0.0001
      ? toTarget.normalize().multiplyScalar(HAZARD_LEADER_SPEED)
      : new Vector3();
  const wanderingCurrent = new Vector3(
    Math.sin(time * 1.7 + hazard.phase * 0.13),
    Math.sin(time * 1.1 + 1.8) * 0.45,
    Math.cos(time * 1.45 - 0.6),
  ).multiplyScalar(0.55);
  const steering = desiredVelocity.add(wanderingCurrent).sub(leaderVelocity);
  clampLength(steering, HAZARD_LEADER_MAX_FORCE);

  leaderVelocity.addScaledVector(steering, dt);
  clampLength(leaderVelocity, HAZARD_LEADER_SPEED);
  if (leaderVelocity.lengthSq() < 0.36) {
    leaderVelocity.copy(toTarget.lengthSq() > 0.0001 ? toTarget.normalize() : randomDirection());
    leaderVelocity.multiplyScalar(0.6);
  }

  leaderPosition.addScaledVector(leaderVelocity, dt);
  constrainHazardPosition(leaderPosition, leaderVelocity, config.bounds);

  if (leaderPosition.distanceTo(targetPosition) < HAZARD_TARGET_REACHED_RADIUS) {
    targetPosition = pickHazardTarget(config.bounds, leaderPosition);
  }

  const members = updateHazardMembers(
    hazard.members?.length === HAZARD_SWARM_SIZE
      ? hazard.members
      : createHazardMembers(hazard.position),
    leaderPosition,
    leaderVelocity,
    config.bounds,
    time,
    dt,
  );

  return {
    ...hazard,
    position: averageHazardPosition(members),
    leaderPosition,
    leaderVelocity,
    targetPosition,
    members,
    phase: time,
  };
}

function createHazardMembers(center: Vector3): HazardMember[] {
  return Array.from({ length: HAZARD_SWARM_SIZE }, (_, index) => {
    const isLeader = index === 0;
    const angle = ((index - 1) / Math.max(1, HAZARD_SWARM_SIZE - 1)) * Math.PI * 2;
    const radius = isLeader ? 0 : randomBetween(0.85, 1.9);
    const offset = isLeader
      ? new Vector3()
      : new Vector3(
          Math.cos(angle) * radius,
          randomBetween(-0.75, 0.55),
          Math.sin(angle) * radius,
        );

    return {
      id: index,
      position: center.clone().add(offset),
      velocity: new Vector3(),
      offset,
      phaseOffset: randomBetween(0, Math.PI * 2),
      isLeader,
    };
  });
}

function updateHazardMembers(
  members: HazardMember[],
  leaderPosition: Vector3,
  leaderVelocity: Vector3,
  bounds: Vector3,
  time: number,
  dt: number,
): HazardMember[] {
  const formationYaw = Math.sin(time * 0.17) * 0.55 + time * 0.08;

  return members.map((member, index) => {
    if (index === 0 || member.isLeader) {
      return {
        ...member,
        position: leaderPosition.clone(),
        velocity: leaderVelocity.clone(),
        offset: new Vector3(),
        isLeader: true,
      };
    }

    const targetPosition = leaderPosition
      .clone()
      .add(member.offset.clone().applyAxisAngle(UP_AXIS, formationYaw + member.phaseOffset * 0.05));
    targetPosition.y += Math.sin(time * 0.9 + member.phaseOffset) * 0.24;
    targetPosition.clamp(hazardMinBounds(bounds), hazardMaxBounds(bounds));

    const position = member.position.clone();
    const velocity = member.velocity.clone();
    const followForce = targetPosition
      .sub(position)
      .multiplyScalar(HAZARD_FOLLOW_STIFFNESS)
      .addScaledVector(leaderVelocity, 0.55)
      .addScaledVector(velocity, -0.45);

    velocity.addScaledVector(followForce, dt);
    clampLength(velocity, HAZARD_FOLLOWER_MAX_SPEED);
    position.addScaledVector(velocity, dt);
    constrainHazardPosition(position, velocity, bounds);

    return {
      ...member,
      position,
      velocity,
    };
  });
}

function averageHazardPosition(members: HazardMember[]): Vector3 {
  if (members.length === 0) {
    return new Vector3();
  }

  return members
    .reduce((center, member) => center.add(member.position), new Vector3())
    .divideScalar(members.length);
}

function pickHazardTarget(bounds: Vector3, currentPosition?: Vector3): Vector3 {
  const min = hazardMinBounds(bounds);
  const max = hazardMaxBounds(bounds);
  const minDistance = bounds.length() * 0.42;

  for (let attempt = 0; attempt < 8; attempt++) {
    const target = new Vector3(
      randomBetween(min.x, max.x),
      randomBetween(min.y, max.y),
      randomBetween(min.z, max.z),
    );

    if (!currentPosition || target.distanceTo(currentPosition) >= minDistance) {
      return target;
    }
  }

  return new Vector3(
    randomBetween(min.x, max.x),
    randomBetween(min.y, max.y),
    randomBetween(min.z, max.z),
  );
}

function constrainHazardPosition(position: Vector3, velocity: Vector3, bounds: Vector3) {
  const min = hazardMinBounds(bounds);
  const max = hazardMaxBounds(bounds);

  for (const axis of ["x", "y", "z"] as const) {
    if (position[axis] < min[axis]) {
      position[axis] = min[axis];
      velocity[axis] = Math.abs(velocity[axis]) * 0.45;
    } else if (position[axis] > max[axis]) {
      position[axis] = max[axis];
      velocity[axis] = -Math.abs(velocity[axis]) * 0.45;
    }
  }
}

function hazardMinBounds(bounds: Vector3): Vector3 {
  return new Vector3(-bounds.x * 0.92, -bounds.y * 0.55, -bounds.z * 0.92);
}

function hazardMaxBounds(bounds: Vector3): Vector3 {
  return new Vector3(bounds.x * 0.92, bounds.y * 0.86, bounds.z * 0.92);
}

function senseNeighbors(
  agent: FishAgent,
  agents: FishAgent[],
  perceptionRadius: number,
): NeighborSample[] {
  return agents
    .filter((candidate) => candidate.id !== agent.id)
    .map((candidate) => ({
      agent: candidate,
      distance: candidate.position.distanceTo(agent.position),
    }))
    .filter((sample) => sample.distance <= perceptionRadius);
}

function steerToward(agent: FishAgent, target: Vector3, maxSpeed: number): Vector3 {
  const desired = target.clone().sub(agent.position);

  if (desired.lengthSq() === 0) {
    return new Vector3();
  }

  return desired.normalize().multiplyScalar(maxSpeed).sub(agent.velocity);
}

function attractFood(agent: FishAgent, food: FoodSource, config: SimulationConfig): Vector3 {
  const distance = agent.position.distanceTo(food.position);

  if (distance < food.radius) {
    if (distance === 0) return new Vector3();
    const urgency = 1 - distance / food.radius;
    const away = agent.position.clone().sub(food.position).normalize();
    return away.multiplyScalar(config.maxSpeed * (1 + urgency * 2)).sub(agent.velocity);
  }

  const attractionRange = config.perceptionRadius + 1.4;
  if (distance > attractionRange) {
    return new Vector3();
  }

  const strength = 1 - distance / attractionRange;
  return steerToward(agent, food.position, config.maxSpeed).multiplyScalar(0.35 + strength);
}

function avoidHazard(agent: FishAgent, hazard: Hazard, config: SimulationConfig): Vector3 {
  const away = agent.position.clone().sub(hazard.position);
  const distance = away.length();
  const alertRange = hazard.radius + config.perceptionRadius;

  if (distance === 0 || distance > alertRange) {
    return new Vector3();
  }

  const urgency = 1 - distance / alertRange;
  return away.normalize().multiplyScalar(config.maxSpeed * (1 + urgency * 2)).sub(agent.velocity);
}

function separate(
  agent: FishAgent,
  neighbors: NeighborSample[],
  config: SimulationConfig,
): Vector3 {
  const steer = new Vector3();
  let count = 0;

  for (const { agent: neighbor, distance } of neighbors) {
    if (distance > 0 && distance < config.separationRadius) {
      const groupBuffer = neighbor.groupId === agent.groupId ? 0.72 : 1.35;
      steer.add(
        agent.position
          .clone()
          .sub(neighbor.position)
          .normalize()
          .divideScalar(distance)
          .multiplyScalar(groupBuffer),
      );
      count += 1;
    }
  }

  if (count === 0) {
    return steer;
  }

  steer.divideScalar(count).normalize().multiplyScalar(config.maxSpeed).sub(agent.velocity);
  return steer;
}

function align(
  agent: FishAgent,
  neighbors: NeighborSample[],
  config: SimulationConfig,
): Vector3 {
  const weightedNeighbors = weightedGroupNeighbors(agent, neighbors);

  if (weightedNeighbors.totalWeight === 0) {
    return new Vector3();
  }

  const averageVelocity = weightedNeighbors.samples
    .reduce(
      (sum, sample) => sum.addScaledVector(sample.agent.velocity, sample.weight),
      new Vector3(),
    )
    .divideScalar(weightedNeighbors.totalWeight);

  return averageVelocity.normalize().multiplyScalar(config.maxSpeed).sub(agent.velocity);
}

function cohere(
  agent: FishAgent,
  neighbors: NeighborSample[],
  config: SimulationConfig,
): Vector3 {
  const weightedNeighbors = weightedGroupNeighbors(agent, neighbors);

  if (weightedNeighbors.totalWeight === 0) {
    return new Vector3();
  }

  const center = weightedNeighbors.samples
    .reduce(
      (sum, sample) => sum.addScaledVector(sample.agent.position, sample.weight),
      new Vector3(),
    )
    .divideScalar(weightedNeighbors.totalWeight);

  return steerToward(agent, center, config.maxSpeed);
}

function weightedGroupNeighbors(agent: FishAgent, neighbors: NeighborSample[]) {
  const samples = neighbors.map((sample) => ({
    ...sample,
    weight: sample.agent.groupId === agent.groupId ? 2.4 : 0.35,
  }));
  const totalWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);

  return { samples, totalWeight };
}

function steerWithinBounds(agent: FishAgent, config: SimulationConfig): Vector3 {
  const force = new Vector3();
  const margin = 1.8;

  for (const axis of ["x", "y", "z"] as const) {
    const limit = config.bounds[axis];
    const value = agent.position[axis];

    if (value > limit - margin) {
      force[axis] -= (value - (limit - margin)) / margin;
    } else if (value < -limit + margin) {
      force[axis] += (-limit + margin - value) / margin;
    }
  }

  if (force.lengthSq() === 0) {
    return force;
  }

  return force.normalize().multiplyScalar(config.maxSpeed).sub(agent.velocity);
}

function constrainPosition(position: Vector3, velocity: Vector3, config: SimulationConfig) {
  const min = new Vector3(-config.bounds.x, -config.bounds.y + FLOOR_CLEARANCE, -config.bounds.z);
  const max = config.bounds;

  for (const axis of ["x", "y", "z"] as const) {
    if (position[axis] < min[axis]) {
      position[axis] = min[axis];
      velocity[axis] = Math.max(0, velocity[axis]) * 0.35;
    } else if (position[axis] > max[axis]) {
      position[axis] = max[axis];
      velocity[axis] = Math.min(0, velocity[axis]) * 0.35;
    }
  }
}

function keepOutOfFood(position: Vector3, velocity: Vector3, foodCenter: Vector3) {
  const radial = position.clone().sub(foodCenter);
  const distSq = radial.lengthSq();
  if (distSq >= FOOD_COLLISION_RADIUS * FOOD_COLLISION_RADIUS) {
    return;
  }
  const dist = Math.sqrt(distSq);
  if (dist < 1e-4) {
    radial.set(1, 0, 0);
  } else {
    radial.divideScalar(dist);
  }
  position.copy(foodCenter).addScaledVector(radial, FOOD_COLLISION_RADIUS);
  const awayComp = velocity.dot(radial);
  if (awayComp < 0) {
    velocity.addScaledVector(radial, -awayComp);
  }
}

function enforceMinHorizSpeed(velocity: Vector3, minSpeed: number) {
  const horizLen = Math.hypot(velocity.x, velocity.z);
  if (horizLen >= minSpeed) {
    return;
  }
  if (horizLen < 1e-4) {
    const angle = Math.random() * Math.PI * 2;
    velocity.x = Math.cos(angle) * minSpeed;
    velocity.z = Math.sin(angle) * minSpeed;
    return;
  }
  const scale = minSpeed / horizLen;
  velocity.x *= scale;
  velocity.z *= scale;
}

function clampLength(vector: Vector3, maxLength: number): Vector3 {
  const length = vector.length();

  if (length > maxLength) {
    vector.multiplyScalar(maxLength / length);
  }

  return vector;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomDirection(): Vector3 {
  return new Vector3(randomBetween(-1, 1), randomBetween(-0.25, 0.25), randomBetween(-1, 1))
    .normalize();
}
