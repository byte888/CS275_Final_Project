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
  // Optional: if present, this scene object contributes multiple collision spheres
  // instead of a single sphere at `position` with `collisionRadius`. Each sphere's
  // offset is in WORLD-axis units relative to `position` (no rotation applied).
  // Use for elongated clusters where one big sphere over-blocks.
  collisionSpheres?: Array<{
    offsetX: number;
    offsetZ: number;
    radius: number;
    height: number;
  }>;
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
    position: new Vector3(-8, GROUND_Y, 3.0),
    rotationY: Math.PI * 0.88,
    scale: 1.2,
    collisionRadius: 1.85,
    collisionHeight: 2.3,
  },
  {
    id: "squidward-house",
    modelPath: "/models/downloaded/squidwards_house.glb",
    position: new Vector3(8.8, GROUND_Y, 5.0),
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
    // Visible footprint 5.7x5.0, diagonal half-extent ~3.8 -> 4.0 with buffer
    collisionRadius: 3,
    collisionHeight: 4.5,
  },
  // Downtown cluster: split into 22 parts (was downtown_fullset.glb) for per-part collision radii
  {
    id: "downtown-part-2", // anchor
    modelPath: "/models/downloaded/downtown_parts/Object_2.glb",
    position: new Vector3(-3.1672, GROUND_Y, -4.3125),
    rotationY: Math.PI * 1.1,
    scale: 0.043,
    collisionRadius: 2.8,
    collisionHeight: 6,
  },
  {
    id: "downtown-part-3", // anchor shadow
    modelPath: "/models/downloaded/downtown_parts/Object_3.glb",
    position: new Vector3(-3.1666, GROUND_Y, -4.3107),
    rotationY: Math.PI * 1.1,
    scale: 0.043,
    collisionRadius: 0,
    collisionHeight: 0,
  },
  {
    id: "downtown-part-4",
    modelPath: "/models/downloaded/downtown_parts/Object_4.glb",
    position: new Vector3(-0.13, GROUND_Y, -3.5594),
    rotationY: Math.PI * 1.1,
    scale: 0.043,
    collisionRadius: 1.43,
    collisionHeight: 1.84,
  },
  {
    id: "downtown-part-5",
    modelPath: "/models/downloaded/downtown_parts/Object_5.glb",
    position: new Vector3(-0.18, GROUND_Y, -4.7352),
    rotationY: Math.PI * 1.1,
    scale: 0.043,
    collisionRadius: 3,
    collisionHeight: 1.844,
  },
  {
    id: "downtown-part-6",
    modelPath: "/models/downloaded/downtown_parts/Object_6.glb",
    position: new Vector3(3, GROUND_Y, -4.8694),
    rotationY: Math.PI * 1.1,
    scale: 0.043,
    collisionRadius: 1.186,
    collisionHeight: 2.243,
  },
  {
    id: "downtown-part-17",
    modelPath: "/models/downloaded/downtown_parts/Object_17.glb",
    position: new Vector3(0.1982, GROUND_Y, -3.9),
    rotationY: Math.PI * 1.1,
    scale: 0.043,
    collisionRadius: 1.514,
    collisionHeight: 2.97,
  },
  {
    id: "downtown-part-18",
    modelPath: "/models/downloaded/downtown_parts/Object_18.glb",
    position: new Vector3(2.8109, GROUND_Y, -7.584),
    rotationY: Math.PI * 1.1,
    scale: 0.043,
    collisionRadius: 1.753,
    collisionHeight: 2.927,
  },
  {
    id: "downtown-part-19",
    modelPath: "/models/downloaded/downtown_parts/Object_19.glb",
    position: new Vector3(0.2902, GROUND_Y, -6.4793),
    rotationY: Math.PI * 1.1,
    scale: 0.043,
    collisionRadius: 1.539,
    collisionHeight: 4,
  },
  {
    id: "downtown-part-20",
    modelPath: "/models/downloaded/downtown_parts/Object_20.glb",
    position: new Vector3(-0.1185, GROUND_Y, -8.7272),
    rotationY: Math.PI * 1.1,
    scale: 0.048,
    collisionRadius: 3,
    collisionHeight: 4,
  },
  {
    id: "downtown-part-21",
    modelPath: "/models/downloaded/downtown_parts/Object_21.glb",
    position: new Vector3(0.1, GROUND_Y, -3.1),
    rotationY: Math.PI * 1.1,
    scale: 0.043,
    collisionRadius: 2.635,
    collisionHeight: 1.588,
  },
  {
    id: "downtown-part-22",
    modelPath: "/models/downloaded/downtown_parts/Object_22.glb",
    position: new Vector3(0.785, GROUND_Y, -7.4202),
    rotationY: Math.PI * 1.1,
    scale: 0.043,
    collisionRadius: 4,
    collisionHeight: 3.753,
  },
  {
    id: "downtown-part-23",
    modelPath: "/models/downloaded/downtown_parts/Object_23.glb",
    position: new Vector3(-1.5082, GROUND_Y, -4.0616),
    rotationY: Math.PI * 1.1,
    scale: 0.043,
    collisionRadius: 0.865,
    collisionHeight: 3.189,
  },
  {
    id: "downtown-cluster-main",
    modelPath: "/models/downloaded/downtown_buildings.glb",
    position: new Vector3(-9.0, GROUND_Y, -5.15),
    rotationY: -Math.PI * 0.5,
    scale: 0.038,
    // Visible footprint 3.63x4.8, diagonal half-extent ~3.0 -> 3.2 with buffer
    collisionRadius: 2.5,
    collisionHeight: 4.5,
  },
];

export const STATIC_SCENE_OBJECTS: StaticSceneObject[] = [...FIXED_BUILDINGS];

export const STATIC_GROUND_OBSTACLES: GroundObstacle[] = STATIC_SCENE_OBJECTS.flatMap(
  ({ id, position, collisionRadius, collisionHeight, collisionSpheres }) => {
    // When an object provides `collisionSpheres`, replace its single
    // circumscribed circle with several smaller cylinders that follow the
    // real footprint. The offsets are interpreted in WORLD-axis units (no
    // rotation applied) relative to the object's `position`.
    if (collisionSpheres && collisionSpheres.length > 0) {
      return collisionSpheres.map((sphere, index) => ({
        id: `${id}#${index}`,
        position: new Vector3(
          position.x + sphere.offsetX,
          position.y,
          position.z + sphere.offsetZ,
        ),
        radius: sphere.radius,
        height: sphere.height,
      }));
    }
    return [
      {
        id,
        position,
        radius: collisionRadius,
        height: collisionHeight,
      },
    ];
  },
);
