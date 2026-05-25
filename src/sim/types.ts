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
};

export type FishSpecies = "reef" | "blue" | "puffer" | "long";

export type FishAgent = {
  id: number;
  position: Vector3;
  velocity: Vector3;
  color: string;
  species: FishSpecies;
  groupId: number;
};

export type FoodSource = {
  position: Vector3;
  radius: number;
};

export type Hazard = {
  position: Vector3;
  radius: number;
  phase: number;
};

export type SimulationState = {
  agents: FishAgent[];
  food: FoodSource;
  hazard: Hazard;
  time: number;
};

export type NeighborSample = {
  agent: FishAgent;
  distance: number;
};
