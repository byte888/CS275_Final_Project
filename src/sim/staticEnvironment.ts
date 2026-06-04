import { Vector3 } from "three";

export type GroundObstacle = {
  id: string;
  position: Vector3;
  radius: number;
  height: number;
};

export type StaticSceneObject = {
  id: string;
  modelPath: string;
  position: Vector3;
  rotationY: number;
  scale: number;
  collisionRadius: number;
  collisionHeight: number;
};

export const GROUND_Y = -5;
export const KRABBY_PATTY_POSITION = new Vector3(5.15, -4.0, 1.0);
export const KRABBY_PATTY_COLLISION_RADIUS = 2.75;
export const KRABBY_PATTY_COLLISION_HEIGHT = 2.5;

const FIXED_BUILDINGS: StaticSceneObject[] = [
  {
    id: "spongebob-pineapple-house",
    modelPath: "/models/downloaded/spongebobs_house.glb",
    position: new Vector3(0.0, GROUND_Y, 4.0),
    rotationY: Math.PI * 0.0,
    scale: 0.82,
    collisionRadius: 2.1,
    collisionHeight: 4.6,
  },
  {
    id: "patrick-house",
    modelPath: "/models/downloaded/patricks_house.glb",
    position: new Vector3(-8.8, GROUND_Y, 4.0),
    rotationY: Math.PI * 0.88,
    scale: 1.2,
    collisionRadius: 1.85,
    collisionHeight: 2.3,
  },
  {
    id: "squidward-house",
    modelPath: "/models/downloaded/squidwards_house.glb",
    position: new Vector3(8.8, GROUND_Y, 4.0),
    rotationY: -Math.PI * 0.04,
    scale: 0.62,
    collisionRadius: 1.5,
    collisionHeight: 4.5,
  },
  {
    id: "krusty-krab",
    modelPath: "/models/downloaded/krusty_krab.glb",
    position: new Vector3(9.0, GROUND_Y, -5.15),
    rotationY: -Math.PI * 0.15,
    scale: 1.3,
    collisionRadius: 2.85,
    collisionHeight: 4.6,
  },
  {
    id: "downtown-cluster-tscp",
    modelPath: "/models/downloaded/downtown_fullset.glb",
    position: new Vector3(-1.75, GROUND_Y, -3.5),
    rotationY: Math.PI * 1.1,
    scale: 0.043,
    collisionRadius: 2.4,
    collisionHeight: 5.1,
  },
  {
    id: "downtown-cluster-main",
    modelPath: "/models/downloaded/downtown_buildings.glb",
    position: new Vector3(-9.0, GROUND_Y, -5.15),
    rotationY: -Math.PI * 0.5,
    scale: 0.05,
    collisionRadius: 2,
    collisionHeight: 4.68,
  },
];

export const STATIC_SCENE_OBJECTS: StaticSceneObject[] = [...FIXED_BUILDINGS];

export const STATIC_GROUND_OBSTACLES: GroundObstacle[] = STATIC_SCENE_OBJECTS.map(
  ({ id, position, collisionRadius, collisionHeight }) => ({
    id,
    position,
    radius: collisionRadius,
    height: collisionHeight,
  }),
);
