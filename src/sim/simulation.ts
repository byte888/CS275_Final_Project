import { Vector3 } from "three";
import type {
  FishAgent,
  FishSpecies,
  Hazard,
  NeighborSample,
  SimulationConfig,
  SimulationState,
} from "./types";

type FishGroupProfile = {
  species: FishSpecies;
  color: string;
  origin: Vector3;
};

const FISH_GROUPS: FishGroupProfile[] = [
  { species: "reef", color: "#f97316", origin: new Vector3(-7.4, -0.4, -4.4) },
  { species: "blue", color: "#38bdf8", origin: new Vector3(-7.0, 1.0, 4.3) },
  { species: "puffer", color: "#eab308", origin: new Vector3(1.8, -1.6, 4.1) },
  { species: "long", color: "#94a3b8", origin: new Vector3(3.4, 1.2, -4.2) },
];

const FLOOR_CLEARANCE = 1.05;

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
      position: new Vector3(5.5, -1.1, -1.6),
      radius: 2.4,
    },
    hazard: {
      position: new Vector3(-4, 1.2, 1.8),
      radius: 2.8,
      phase: 0,
    },
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
  const hazard = updateHazard(state.hazard, state.time + dt);
  const agents = state.agents.map((agent) => {
    const neighbors = senseNeighbors(agent, state.agents, config.perceptionRadius);
    const force = new Vector3();

    force.addScaledVector(attractFood(agent, state.food.position, config), config.weights.food);
    force.addScaledVector(avoidHazard(agent, hazard, config), config.weights.hazard);
    force.addScaledVector(separate(agent, neighbors, config), config.weights.separation);
    force.addScaledVector(align(agent, neighbors, config), config.weights.alignment);
    force.addScaledVector(cohere(agent, neighbors, config), config.weights.cohesion);
    force.addScaledVector(steerWithinBounds(agent, config), config.weights.boundary);
    clampLength(force, config.maxForce);

    const velocity = agent.velocity.clone().addScaledVector(force, dt);
    clampLength(velocity, config.maxSpeed);
    const position = agent.position.clone().addScaledVector(velocity, dt);
    constrainPosition(position, velocity, config);

    return {
      ...agent,
      position,
      velocity,
    };
  });

  return {
    ...state,
    agents,
    hazard,
    time: state.time + dt,
  };
}

function createAgents(count: number, bounds: Vector3, startId = 0, totalCount = count): FishAgent[] {
  return Array.from({ length: count }, (_, index) => {
    const id = startId + index;
    const groupSize = Math.max(1, Math.ceil(totalCount / FISH_GROUPS.length));
    const groupId = Math.min(FISH_GROUPS.length - 1, Math.floor(id / groupSize));
    const group = FISH_GROUPS[groupId];
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
    const velocity = new Vector3(
      randomBetween(-1, 1),
      randomBetween(-0.25, 0.25),
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
    };
  });
}

function updateHazard(hazard: Hazard, time: number): Hazard {
  return {
    ...hazard,
    position: new Vector3(
      Math.sin(time * 0.36) * 6.2,
      1.2 + Math.sin(time * 0.72) * 1.1,
      Math.cos(time * 0.28) * 3.4,
    ),
    phase: time,
  };
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

function attractFood(agent: FishAgent, foodPosition: Vector3, config: SimulationConfig): Vector3 {
  const distance = agent.position.distanceTo(foodPosition);
  const attractionRange = config.perceptionRadius + 1.4;

  if (distance > attractionRange) {
    return new Vector3();
  }

  const strength = 1 - distance / attractionRange;
  return steerToward(agent, foodPosition, config.maxSpeed).multiplyScalar(0.35 + strength);
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
