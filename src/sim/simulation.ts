import { Vector3 } from "three";
import type {
  FishAgent,
  FishSchoolBehaviorState,
  FishSpecies,
  FoodSource,
  Hazard,
  HazardMember,
  NeighborSample,
  SimulationConfig,
  SimulationState,
} from "./types";
import {
  GROUND_Y,
  KRABBY_PATTY_COLLISION_HEIGHT,
  KRABBY_PATTY_COLLISION_RADIUS,
  KRABBY_PATTY_POSITION,
  STATIC_GROUND_OBSTACLES,
  type GroundObstacle,
} from "./staticEnvironment";

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
const GROUND_WALK_Y = GROUND_Y;
const MIN_GROUND_SPEED = 1.2;
const CHARACTER_COLLISION_RADIUS = 0.5;
// Proactive obstacle avoidance: agents look this far ahead along their
// velocity and steer LATERALLY (perpendicular to motion) when a cylinder is
// in their predicted path. Lateral steering is what makes them slip through
// gaps between obstacles instead of stalling head-on against one.
const OBSTACLE_AVOID_LOOKAHEAD = 2.8;
const OBSTACLE_AVOID_BUFFER = 0.55;
const OBSTACLE_AVOID_WEIGHT = 1.0;

export const HAZARD_SWARM_SIZE = 10;
const HAZARD_LEADER_SPEED = 2.5;
const HAZARD_LEADER_MAX_FORCE = 1.4;
const HAZARD_FOLLOWER_MAX_SPEED = 2.8;
const HAZARD_FOLLOW_STIFFNESS = 2.0;
const HAZARD_TARGET_REACHED_RADIUS = 1.3;
const HAZARD_BAIT_REACHED_RADIUS = 1.65;
const HAZARD_BAIT_HEIGHT_OFFSET = 1.8;
const HAZARD_BAIT_MIN_INTERVAL = 30;
const HAZARD_BAIT_MAX_INTERVAL = 45;
const CROSS_SPECIES_SEPARATION_RADIUS_MULTIPLIER = 2.55;
const CROSS_SPECIES_SEPARATION_SPEED_SCALE = 1.35;
const FISH_WANDER_MIN_INTERVAL = 8;
const FISH_WANDER_MAX_INTERVAL = 18;
const FISH_WANDER_REACHED_RADIUS = 1.7;
const FISH_WANDER_WEIGHT = 0.42;
const FISH_FEEDING_RADIUS = KRABBY_PATTY_COLLISION_RADIUS + 1.1;
const FISH_INITIAL_HUNGER_MIN = 0.62;
const FISH_INITIAL_HUNGER_MAX = 1;
const FISH_HUNGER_RECOVERY_PER_SECOND = 0.034;
const FISH_FEED_HUNGER_DROP_PER_SECOND = 0.16;
const FISH_LOW_HUNGER_WANDER_BOOST = 0.85;
const FISH_FULL_HUNGER_THRESHOLD = 0;
const FISH_FULL_FOOD_DESIRE = 0.5;
const FISH_FOOD_LOITER_WEIGHT_THRESHOLD = 2.0;
const FISH_FOOD_LOITER_RADIUS_MIN = KRABBY_PATTY_COLLISION_RADIUS + 0.45;
const FISH_FOOD_LOITER_RADIUS_MAX = FISH_FEEDING_RADIUS - 0.2;
const FISH_FOOD_AVOID_TARGET_RADIUS = FISH_FEEDING_RADIUS * 1.8;
const UP_AXIS = new Vector3(0, 1, 0);

export const defaultConfig: SimulationConfig = {
  agentCount: 48,
  showStatusDots: true,
  perceptionRadius: 4.2,
  separationRadius: 1.1,
  maxSpeed: 3.2,
  maxForce: 3.6,
  bounds: new Vector3(15, 5, 11),
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
      position: KRABBY_PATTY_POSITION.clone(),
      radius: 1.5,
    },
    hazard: createHazard(config.bounds),
    schoolBehavior: createSchoolBehaviorStates(config.bounds, 0),
    time: 0,
  };
}

export function resizePopulation(state: SimulationState, config: SimulationConfig): SimulationState {
  if (state.agents.length === config.agentCount) {
    return state;
  }

  let agents: FishAgent[];

  if (state.agents.length > config.agentCount) {
    // Remove agents randomly from fish only (preserve characters)
    const characters = state.agents.filter((a) => a.groundWalk);
    const fish = state.agents.filter((a) => !a.groundWalk);
    const targetFishCount = Math.max(0, config.agentCount - characters.length);
    // Fisher-Yates shuffle then take first targetFishCount
    const shuffled = [...fish];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    agents = [...characters, ...shuffled.slice(0, targetFishCount)];
  } else {
    // Add agents with randomly chosen species from FISH_SCHOOLS
    const newCount = config.agentCount - state.agents.length;
    const nextId = state.agents.length;
    const newAgents: FishAgent[] = Array.from({ length: newCount }, (_, index) => {
      const id = nextId + index;
      const groupId = Math.floor(Math.random() * FISH_SCHOOLS.length);
      const group = FISH_SCHOOLS[groupId];
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
          new Vector3(-config.bounds.x * 0.85, -config.bounds.y + FLOOR_CLEARANCE, -config.bounds.z * 0.85),
          config.bounds.clone().multiplyScalar(0.85),
        );
      const velocity = new Vector3(randomBetween(-1, 1), randomBetween(-0.25, 0.25), randomBetween(-1, 1));
      if (velocity.lengthSq() === 0) velocity.set(1, 0, 0);
      return {
        id,
        position,
        velocity: velocity.normalize().multiplyScalar(randomBetween(1.2, 2.4)),
        color: group.color,
        species: group.species,
        groupId,
        groundWalk: false,
        hunger: randomBetween(FISH_INITIAL_HUNGER_MIN, FISH_INITIAL_HUNGER_MAX),
      };
    });
    agents = [...state.agents, ...newAgents];
  }

  return { ...state, agents };
}

export function stepSimulation(
  state: SimulationState,
  config: SimulationConfig,
  deltaSeconds: number,
): SimulationState {
  const dt = Math.min(deltaSeconds, 0.04);
  const time = state.time + dt;
  const groundObstacles = createGroundObstacles(state.food);
  const hazard = updateHazard(state.hazard, config, dt, time, state.food.position, groundObstacles);
  const schoolBehavior = updateSchoolBehaviorStates(
    state.schoolBehavior,
    state.agents,
    state.food,
    config,
    time,
  );
  const schoolBehaviorByGroup = new Map(schoolBehavior.map((school) => [school.groupId, school]));
  const agents = state.agents.map((agent) => {
    const neighbors = senseNeighbors(agent, state.agents, config.perceptionRadius);
    const school = schoolBehaviorByGroup.get(agent.groupId);
    const force = new Vector3();

    force.addScaledVector(attractFood(agent, state.food, config), config.weights.food * foodDesire(agent));
    force.addScaledVector(avoidHazard(agent, hazard, config), config.weights.hazard);
    force.addScaledVector(separate(agent, neighbors, config), config.weights.separation);
    force.addScaledVector(avoidGroundObstacles(agent, groundObstacles, config), OBSTACLE_AVOID_WEIGHT);
    if (!agent.groundWalk) {
      force.addScaledVector(wander(agent, school, config), wanderWeight(agent));
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
    keepOutOfGroundObstacles(position, velocity, groundObstacles, agent.groundWalk);
    if (agent.groundWalk) {
      position.y = GROUND_WALK_Y;
      // If the snap-out chain plus collisions drained almost all horizontal
      // motion, give a small lateral nudge so wide characters don't stall in
      // a building corner. `MIN_GROUND_SPEED` is re-enforced next tick.
      const speedSq = velocity.x * velocity.x + velocity.z * velocity.z;
      if (speedSq < MIN_GROUND_SPEED * MIN_GROUND_SPEED * 0.25) {
        const angle = Math.random() * Math.PI * 2;
        velocity.x += Math.cos(angle) * MIN_GROUND_SPEED * 0.8;
        velocity.z += Math.sin(angle) * MIN_GROUND_SPEED * 0.8;
      }
    } else {
      keepOutOfFood(position, velocity, state.food.position);
    }
    const hunger = updateHunger(agent.hunger, position, state.food, dt);

    return {
      ...agent,
      position,
      velocity,
      hunger,
    };
  });

  resolveCharacterCollisions(agents);

  return {
    ...state,
    agents,
    hazard,
    schoolBehavior,
    time,
  };
}

function createGroundObstacles(food: FoodSource): GroundObstacle[] {
  return [
    {
      id: "krabby-patty",
      position: new Vector3(food.position.x, GROUND_Y, food.position.z),
      radius: KRABBY_PATTY_COLLISION_RADIUS,
      height: KRABBY_PATTY_COLLISION_HEIGHT,
    },
    ...STATIC_GROUND_OBSTACLES,
  ];
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
      hunger: randomBetween(FISH_INITIAL_HUNGER_MIN, FISH_INITIAL_HUNGER_MAX),
    };
  });
}

function createSchoolBehaviorStates(bounds: Vector3, time: number): FishSchoolBehaviorState[] {
  return FISH_SCHOOLS.map((group, groupId) => ({
    groupId,
    wanderTarget: pickFishWanderTarget(bounds, group.origin),
    nextWanderTargetTime: time + randomFishWanderInterval(),
    targetMode: "explore",
  }));
}

function updateSchoolBehaviorStates(
  schoolBehavior: FishSchoolBehaviorState[] | undefined,
  agents: FishAgent[],
  food: FoodSource,
  config: SimulationConfig,
  time: number,
): FishSchoolBehaviorState[] {
  const existingByGroup = new Map((schoolBehavior ?? []).map((school) => [school.groupId, school]));

  return FISH_SCHOOLS.map((group, groupId) => {
    const center = schoolCenter(agents, groupId) ?? group.origin;
    const existing = existingByGroup.get(groupId);
    const state: FishSchoolBehaviorState = existing
      ? {
          ...existing,
          wanderTarget: existing.wanderTarget.clone(),
        }
      : {
          groupId,
          wanderTarget: pickFishWanderTarget(config.bounds, center),
          nextWanderTargetTime: time + randomFishWanderInterval(),
          targetMode: "explore",
        };

    const fullSchoolNearFood =
      schoolIsFull(agents, groupId) &&
      center.distanceTo(food.position) <= FISH_FEEDING_RADIUS;
    const targetReached = center.distanceTo(state.wanderTarget) <= FISH_WANDER_REACHED_RADIUS;
    const targetExpired = time >= state.nextWanderTargetTime || targetReached;
    const targetTooCloseToFood =
      state.wanderTarget.distanceTo(food.position) < FISH_FOOD_AVOID_TARGET_RADIUS;
    const shouldLoiterNearFood =
      fullSchoolNearFood && config.weights.food >= FISH_FOOD_LOITER_WEIGHT_THRESHOLD;
    const shouldAvoidFood = fullSchoolNearFood && !shouldLoiterNearFood;

    if (shouldLoiterNearFood && (state.targetMode !== "food-loiter" || targetExpired)) {
      state.wanderTarget = pickFishFoodLoiterTarget(food.position, config.bounds);
      state.nextWanderTargetTime = time + randomFishWanderInterval();
      state.targetMode = "food-loiter";
    } else if (
      shouldAvoidFood &&
      (state.targetMode !== "avoid-food" || targetExpired || targetTooCloseToFood)
    ) {
      state.wanderTarget = pickFishWanderTarget(config.bounds, center, food.position);
      state.nextWanderTargetTime = time + randomFishWanderInterval();
      state.targetMode = "avoid-food";
    } else if (!fullSchoolNearFood && targetExpired) {
      state.wanderTarget = pickFishWanderTarget(config.bounds, center);
      state.nextWanderTargetTime = time + randomFishWanderInterval();
      state.targetMode = "explore";
    }

    return state;
  });
}

function schoolCenter(agents: FishAgent[], groupId: number): Vector3 | null {
  const members = agents.filter((agent) => agent.groupId === groupId && !agent.groundWalk);
  if (members.length === 0) {
    return null;
  }

  return members
    .reduce((center, agent) => center.add(agent.position), new Vector3())
    .divideScalar(members.length);
}

function schoolIsFull(agents: FishAgent[], groupId: number): boolean {
  const members = agents.filter((agent) => agent.groupId === groupId && !agent.groundWalk);
  if (members.length === 0) {
    return false;
  }

  return members.every((agent) => normalizedHunger(agent) <= FISH_FULL_HUNGER_THRESHOLD);
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
    nextBaitVisitTime: randomHazardBaitInterval(),
    baitTargetActive: false,
    members: createHazardMembers(leaderPosition),
  };
}

function updateHazard(
  hazard: Hazard,
  config: SimulationConfig,
  dt: number,
  time: number,
  foodPosition: Vector3,
  groundObstacles: GroundObstacle[],
): Hazard {
  const leaderPosition = (hazard.leaderPosition ?? hazard.position).clone();
  const leaderVelocity = (hazard.leaderVelocity ?? randomDirection().multiplyScalar(HAZARD_LEADER_SPEED)).clone();
  let targetPosition = (hazard.targetPosition ?? pickHazardTarget(config.bounds, leaderPosition)).clone();
  let nextBaitVisitTime = hazard.nextBaitVisitTime ?? time + randomHazardBaitInterval();
  let baitTargetActive = hazard.baitTargetActive ?? false;
  const baitPosition = pickHazardBaitTarget(foodPosition, config.bounds);

  if (baitTargetActive || time >= nextBaitVisitTime) {
    baitTargetActive = true;
    targetPosition = baitPosition;
  } else if (leaderPosition.distanceTo(targetPosition) < HAZARD_TARGET_REACHED_RADIUS) {
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
  keepOutOfGroundObstacles(leaderPosition, leaderVelocity, groundObstacles, false);

  const reachedRadius = baitTargetActive ? HAZARD_BAIT_REACHED_RADIUS : HAZARD_TARGET_REACHED_RADIUS;
  if (leaderPosition.distanceTo(targetPosition) < reachedRadius) {
    if (baitTargetActive) {
      baitTargetActive = false;
      nextBaitVisitTime = time + randomHazardBaitInterval();
    }
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
    groundObstacles,
  );

  return {
    ...hazard,
    position: averageHazardPosition(members),
    leaderPosition,
    leaderVelocity,
    targetPosition,
    nextBaitVisitTime,
    baitTargetActive,
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
  groundObstacles: GroundObstacle[],
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
    keepOutOfGroundObstacles(position, velocity, groundObstacles, false);

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

function pickHazardBaitTarget(foodPosition: Vector3, bounds: Vector3): Vector3 {
  const min = hazardMinBounds(bounds);
  const max = hazardMaxBounds(bounds);

  return new Vector3(
    clampNumber(foodPosition.x, min.x, max.x),
    clampNumber(foodPosition.y + HAZARD_BAIT_HEIGHT_OFFSET, min.y, max.y),
    clampNumber(foodPosition.z, min.z, max.z),
  );
}

function randomHazardBaitInterval(): number {
  return randomBetween(HAZARD_BAIT_MIN_INTERVAL, HAZARD_BAIT_MAX_INTERVAL);
}

function pickFishWanderTarget(bounds: Vector3, currentPosition: Vector3, avoidPosition?: Vector3): Vector3 {
  const min = fishMinBounds(bounds);
  const max = fishMaxBounds(bounds);
  const minTravelDistance = bounds.length() * 0.28;
  const avoidDistance = FISH_FEEDING_RADIUS * 1.8;

  for (let attempt = 0; attempt < 12; attempt++) {
    const target = new Vector3(
      randomBetween(min.x, max.x),
      randomBetween(min.y, max.y),
      randomBetween(min.z, max.z),
    );
    const farEnough = target.distanceTo(currentPosition) >= minTravelDistance;
    const avoidsFood = !avoidPosition || target.distanceTo(avoidPosition) >= avoidDistance;

    if (farEnough && avoidsFood) {
      return target;
    }
  }

  return new Vector3(
    randomBetween(min.x, max.x),
    randomBetween(min.y, max.y),
    randomBetween(min.z, max.z),
  );
}

function pickFishFoodLoiterTarget(foodPosition: Vector3, bounds: Vector3): Vector3 {
  const min = fishMinBounds(bounds);
  const max = fishMaxBounds(bounds);
  const angle = Math.random() * Math.PI * 2;
  const radius = randomBetween(FISH_FOOD_LOITER_RADIUS_MIN, FISH_FOOD_LOITER_RADIUS_MAX);

  return new Vector3(
    clampNumber(foodPosition.x + Math.cos(angle) * radius, min.x, max.x),
    clampNumber(foodPosition.y + randomBetween(-0.65, 0.95), min.y, max.y),
    clampNumber(foodPosition.z + Math.sin(angle) * radius, min.z, max.z),
  );
}

function fishMinBounds(bounds: Vector3): Vector3 {
  return new Vector3(-bounds.x * 0.86, -bounds.y + FLOOR_CLEARANCE, -bounds.z * 0.86);
}

function fishMaxBounds(bounds: Vector3): Vector3 {
  return new Vector3(bounds.x * 0.86, bounds.y * 0.82, bounds.z * 0.86);
}

function randomFishWanderInterval(): number {
  return randomBetween(FISH_WANDER_MIN_INTERVAL, FISH_WANDER_MAX_INTERVAL);
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

function wander(
  agent: FishAgent,
  school: FishSchoolBehaviorState | undefined,
  config: SimulationConfig,
): Vector3 {
  if (!school) {
    return new Vector3();
  }

  return steerToward(agent, school.wanderTarget, config.maxSpeed * 0.72);
}

function wanderWeight(agent: FishAgent): number {
  return FISH_WANDER_WEIGHT + (1 - normalizedHunger(agent)) * FISH_LOW_HUNGER_WANDER_BOOST;
}

function foodDesire(agent: FishAgent): number {
  return FISH_FULL_FOOD_DESIRE + (1 - FISH_FULL_FOOD_DESIRE) * normalizedHunger(agent);
}

function updateHunger(
  currentHunger: number | undefined,
  position: Vector3,
  food: FoodSource,
  dt: number,
): number {
  const hunger = currentHunger ?? randomBetween(FISH_INITIAL_HUNGER_MIN, FISH_INITIAL_HUNGER_MAX);
  const nearFood = position.distanceTo(food.position) <= FISH_FEEDING_RADIUS;
  const delta = nearFood
    ? -FISH_FEED_HUNGER_DROP_PER_SECOND * dt
    : FISH_HUNGER_RECOVERY_PER_SECOND * dt;

  return clampNumber(hunger + delta, 0, 1);
}

function normalizedHunger(agent: FishAgent): number {
  return clampNumber(agent.hunger ?? FISH_INITIAL_HUNGER_MAX, 0, 1);
}

function attractFood(agent: FishAgent, food: FoodSource, config: SimulationConfig): Vector3 {
  const distance = agent.position.distanceTo(food.position);
  // Ground walkers (spongebob/patrick/squidward) have no wander force, so the
  // burger must be able to pull them across the whole play area. Fish use the
  // tighter perception-based range and rely on `wander` for exploration.
  const attractionRange = agent.groundWalk
    ? Math.hypot(config.bounds.x, config.bounds.z) * 2
    : config.perceptionRadius + 1.4;

  if (distance < food.radius) {
    if (distance === 0) return new Vector3();
    const urgency = 1 - distance / food.radius;
    const away = agent.position.clone().sub(food.position).normalize();
    return away.multiplyScalar(config.maxSpeed * (1 + urgency * 2)).sub(agent.velocity);
  }

  if (distance > attractionRange) {
    return new Vector3();
  }

  const strength = 1 - distance / attractionRange;
  // Stronger constant floor for ground walkers so the pull doesn't fade to
  // near-zero at the far edges of the expanded boundary.
  const baseline = agent.groundWalk ? 0.85 : 0.35;
  return steerToward(agent, food.position, config.maxSpeed).multiplyScalar(baseline + strength);
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
  let hasDifferentSpeciesNeighbor = false;

  for (const { agent: neighbor, distance } of neighbors) {
    const sameGroup = neighbor.groupId === agent.groupId;
    const separationRadius = sameGroup
      ? config.separationRadius
      : Math.min(config.perceptionRadius, config.separationRadius * CROSS_SPECIES_SEPARATION_RADIUS_MULTIPLIER);

    if (distance > 0 && distance < separationRadius) {
      const urgency = 1 - distance / separationRadius;
      const groupBuffer = sameGroup ? 0.72 : 2.1 + urgency * 1.4;
      steer.add(
        agent.position
          .clone()
          .sub(neighbor.position)
          .normalize()
          .divideScalar(Math.max(distance, 0.25))
          .multiplyScalar(groupBuffer),
      );
      count += 1;
      hasDifferentSpeciesNeighbor ||= !sameGroup;
    }
  }

  if (count === 0) {
    return steer;
  }

  const targetSpeed = hasDifferentSpeciesNeighbor
    ? config.maxSpeed * CROSS_SPECIES_SEPARATION_SPEED_SCALE
    : config.maxSpeed;
  steer.divideScalar(count).normalize().multiplyScalar(targetSpeed).sub(agent.velocity);
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
  const samples = neighbors
    .filter((sample) => sample.agent.groupId === agent.groupId)
    .map((sample) => ({
      ...sample,
      weight: 1,
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
  if (distSq >= KRABBY_PATTY_COLLISION_RADIUS * KRABBY_PATTY_COLLISION_RADIUS) {
    return;
  }
  const dist = Math.sqrt(distSq);
  if (dist < 1e-4) {
    radial.set(1, 0, 0);
  } else {
    radial.divideScalar(dist);
  }
  position.copy(foodCenter).addScaledVector(radial, KRABBY_PATTY_COLLISION_RADIUS);
  const awayComp = velocity.dot(radial);
  if (awayComp < 0) {
    velocity.addScaledVector(radial, -awayComp);
  }
}

// Proactive steering: look ahead along the agent's horizontal velocity and
// push it sideways around any cylinder in its predicted path. Returns a
// steering force (desired velocity minus current), already restricted to the
// XZ plane. Agents above/below an obstacle's height band are unaffected, so
// fish flying over short buildings don't get spurious swerves.
function avoidGroundObstacles(
  agent: FishAgent,
  obstacles: GroundObstacle[],
  config: SimulationConfig,
): Vector3 {
  const steer = new Vector3();
  const vx = agent.velocity.x;
  const vz = agent.velocity.z;
  const horizSpeed = Math.hypot(vx, vz);
  if (horizSpeed < 0.05) {
    return steer;
  }

  const fx = vx / horizSpeed;
  const fz = vz / horizSpeed;
  // Look further ahead when moving faster, so high-speed agents start their
  // swerve earlier and don't crash into static cylinders.
  const lookAhead = OBSTACLE_AVOID_LOOKAHEAD * (0.6 + horizSpeed / config.maxSpeed);

  let accumX = 0;
  let accumZ = 0;

  for (const obstacle of obstacles) {
    if (!isInsideObstacleHeight(agent.position, obstacle)) {
      continue;
    }

    const dx = obstacle.position.x - agent.position.x;
    const dz = obstacle.position.z - agent.position.z;

    // Forward component (signed distance along velocity to obstacle center)
    const forwardDot = dx * fx + dz * fz;
    const reach = lookAhead + obstacle.radius;
    if (forwardDot <= 0 || forwardDot > reach) {
      continue; // behind us or too far ahead
    }

    // Lateral offset of obstacle center from our forward ray
    const lateralX = dx - forwardDot * fx;
    const lateralZ = dz - forwardDot * fz;
    const lateralDist = Math.hypot(lateralX, lateralZ);
    const clearance = obstacle.radius + OBSTACLE_AVOID_BUFFER;
    if (lateralDist > clearance) {
      continue; // already clears it on one side
    }

    // Unit vector pointing AWAY from the obstacle, perpendicular to velocity.
    let perpX: number;
    let perpZ: number;
    if (lateralDist < 1e-4) {
      // Dead-on: pick the side that's closer to "right" of the velocity
      perpX = -fz;
      perpZ = fx;
    } else {
      perpX = -lateralX / lateralDist;
      perpZ = -lateralZ / lateralDist;
    }

    // Stronger when obstacle is closer ahead AND closer to the path centerline
    const proximityAhead = 1 - forwardDot / reach;
    const proximityLateral = 1 - lateralDist / clearance;
    const strength = proximityAhead * proximityLateral;
    accumX += perpX * strength;
    accumZ += perpZ * strength;
  }

  if (accumX === 0 && accumZ === 0) {
    return steer;
  }

  // Keep magnitude PROPORTIONAL to accumulated threat (don't normalize and
  // re-saturate to maxSpeed). A single marginal threat with strength ~0.1
  // should contribute a small push; only a head-on imminent obstacle (or
  // multiple converging ones) should produce a maxSpeed-scale steer. This is
  // what lets food/hazard forces still register when the agent merely passes
  // near a building instead of running straight at one.
  const desiredLen = Math.hypot(accumX, accumZ);
  const desiredMag = Math.min(desiredLen, 1) * config.maxSpeed;
  const inv = desiredMag / desiredLen;
  steer.x = accumX * inv - vx * (desiredMag / config.maxSpeed);
  steer.z = accumZ * inv - vz * (desiredMag / config.maxSpeed);
  return steer;
}

function keepOutOfGroundObstacles(
  position: Vector3,
  velocity: Vector3,
  obstacles: GroundObstacle[],
  groundLocked: boolean,
) {
  for (let pass = 0; pass < 2; pass += 1) {
    for (const obstacle of obstacles) {
      keepOutOfGroundObstacle(position, velocity, obstacle, groundLocked);
    }
  }
}

function keepOutOfGroundObstacle(
  position: Vector3,
  velocity: Vector3,
  obstacle: GroundObstacle,
  groundLocked: boolean,
) {
  if (!groundLocked && !isInsideObstacleHeight(position, obstacle)) {
    return;
  }

  const radial = new Vector3(
    position.x - obstacle.position.x,
    0,
    position.z - obstacle.position.z,
  );
  const distSq = radial.x * radial.x + radial.z * radial.z;

  if (distSq >= obstacle.radius * obstacle.radius) {
    return;
  }

  const distance = Math.sqrt(distSq);
  if (distance < 1e-4) {
    radial.set(1, 0, 0);
  } else {
    radial.divideScalar(distance);
  }

  position.x = obstacle.position.x + radial.x * obstacle.radius;
  position.z = obstacle.position.z + radial.z * obstacle.radius;

  const inwardSpeed = velocity.x * radial.x + velocity.z * radial.z;
  if (inwardSpeed < 0) {
    velocity.x -= radial.x * inwardSpeed;
    velocity.z -= radial.z * inwardSpeed;
  }
}

function isInsideObstacleHeight(position: Vector3, obstacle: GroundObstacle): boolean {
  return position.y >= obstacle.position.y && position.y <= obstacle.position.y + obstacle.height;
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

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomDirection(): Vector3 {
  return new Vector3(randomBetween(-1, 1), randomBetween(-0.25, 0.25), randomBetween(-1, 1))
    .normalize();
}
