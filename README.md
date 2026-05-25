# Bikini Bottom Artificial Life

A browser-based 3D artificial life simulation inspired by Bikini Bottom. Fish residents move through a stylized underwater environment using local perception and simple steering rules. The goal is to show how schooling, clustering, attraction, and avoidance can emerge from local perception-action loops.

## Features

- Autonomous fish agents with position, velocity, and limited perception radius.
- Four fish species with distinct GLB models and visual silhouettes.
- Stable fish groups that start in different parts of the environment and prefer to school with their own species.
- Articulated fish movement with animated tails, fins, and subtle body sway.
- Krabby Patty food source that attracts nearby fish.
- Moving jellyfish swarm that fish avoid as an environmental hazard.
- Jellyfish animation with pulsing bells, bobbing bodies, and waving tentacles.
- Local `.glb` models for fish variants, jellyfish, and the Krabby Patty attractor.
- Schooling behavior from separation, alignment, and cohesion rules.
- Interactive controls for population size, perception radius, and behavior weights.
- 3D underwater scene built with React, Vite, Three.js, and React Three Fiber.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Simulation Model

At each animation frame, every fish agent senses only nearby information:

- Other fish within its perception radius.
- The Krabby Patty attractor.
- The jellyfish swarm hazard.
- The soft boundary of the simulation volume.

The agent combines weighted steering vectors:

- Food attraction pulls fish toward the Krabby Patty only after it enters local perception range.
- Hazard avoidance pushes fish away from the jellyfish swarm.
- Separation prevents crowding and overlap.
- Alignment nudges fish toward nearby neighbors' headings.
- Cohesion nudges fish toward the local group center, with stronger weighting for same-group fish.
- Same-group fish align and cluster more strongly, while different groups still separate to avoid collisions.
- Boundary steering keeps fish inside the underwater volume.
- Tail beat frequency increases with agent speed, so faster fish visibly swim harder.

These local rules are intentionally simple, but their combination produces emergent group movement and collective response to changing environmental features.

## Project Structure

```text
public/
  models/
    fish-reef.glb          Orange reef fish group
    fish-blue.glb          Blue slender fish group
    fish-puffer.glb        Rounded puffer fish group
    fish-long.glb          Long silver fish group
    jellyfish.glb          Low-poly jellyfish hazard model
    krabby-patty.glb       Low-poly food attractor model
src/
  components/
    ControlsPanel.tsx      Interactive behavior controls
    SimulationScene.tsx    3D rendering and animation loop
  sim/
    simulation.ts          Agent initialization, perception, and steering
    types.ts               Shared simulation data types
  App.tsx                  Application shell
  main.tsx                 React entry point
```

## Replacing Models

The current models are lightweight project-owned GLB files generated for the demo. To replace them with downloaded assets, keep the same filenames in `public/models/`, or update the paths in `src/components/SimulationScene.tsx`.

Recommended sources for permissively licensed models:

- [Poly Pizza](https://poly.pizza/) for low-poly GLTF/GLB-style assets.
- [Quaternius](https://quaternius.com/) for free game-ready packs.
- [Kenney](https://kenney.nl/assets) for consistent game asset sets.
- [Sketchfab](https://sketchfab.com/) if you filter for downloadable CC0 or CC-BY models.