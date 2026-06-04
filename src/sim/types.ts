import type { Vector3 } from "three";

export type BehaviorWeights = {
  food: number;
  hazard: number;
  separation: number;
  alignment: number;
  cohesion: number;
  boundary: number;
};

export type SimulationConfig = {
  agentCount: number;
  perceptionRadius: number;
  separationRadius: number;
  maxSpeed: number;
  maxForce: number;
  bounds: Vector3;
  weights: BehaviorWeights;
  showStatusDots: boolean;
};

export type FishSpecies =
  | "reef"
  | "blue"
  | "puffer"
  | "long"
  | "spongebob"
  | "patrick"
  | "squidward";

export type FishAgent = {
  id: number;
  position: Vector3;
  velocity: Vector3;
  color: string;
  species: FishSpecies;
  groupId: number;
  groundWalk: boolean;
  hunger: number;
};

export type FoodSource = {
  position: Vector3;
  radius: number;
};

export type Hazard = {
  position: Vector3;
  radius: number;
  phase: number;
  leaderPosition: Vector3;
  leaderVelocity: Vector3;
  targetPosition: Vector3;
  nextBaitVisitTime: number;
  baitTargetActive: boolean;
  members: HazardMember[];
};

export type FishSchoolBehaviorState = {
  groupId: number;
  wanderTarget: Vector3;
  nextWanderTargetTime: number;
  targetMode: "explore" | "avoid-food" | "food-loiter";
};

export type HazardMember = {
  id: number;
  position: Vector3;
  velocity: Vector3;
  offset: Vector3;
  phaseOffset: number;
  isLeader: boolean;
};

export type SimulationState = {
  agents: FishAgent[];
  food: FoodSource;
  hazard: Hazard;
  schoolBehavior: FishSchoolBehaviorState[];
  time: number;
};

export type NeighborSample = {
  agent: FishAgent;
  distance: number;
};
