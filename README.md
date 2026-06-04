# Bikini Bottom Artificial Life

A browser-based 3D artificial life simulation inspired by Bikini Bottom. Fish residents move through a stylized underwater environment using local perception, internal hunger state, schooling forces, food attraction, and hazard avoidance. The project is designed to show how readable group behavior can emerge from simple perception-action loops.

## Project Goal

The core goal is to build an artificial-life scene where fish behavior is explainable from agent state and local environmental cues. Early versions made all fish converge into one mixed group around the Krabby Patty. The current version improves that behavior by:

- Keeping different fish species visually and behaviorally separated.
- Giving each fish an internal hunger level so food-seeking is not just a fixed force.
- Making food attraction visibly tunable through the controls panel.
- Making fully fed schools either loiter near food or wander away depending on food attraction strength.
- Adding status dots so hunger state can be inspected during the simulation.
- Making the jellyfish swarm periodically visit the Krabby Patty as a bait/hazard interaction.

These choices make the final behavior easier to justify in a report: each visible movement can be connected to local perception, hunger, school-level target mode, and user-controlled weights.

## Features

- Autonomous fish agents with position, velocity, hunger, and limited perception radius.
- Four fish species with distinct GLB models and visual silhouettes.
- Stable species schools that start in different regions and align/cohere only with their own group.
- Stronger cross-species separation so different species do not merge into one group after visiting food.
- Krabby Patty food source that attracts nearby fish.
- Food attraction scaled by hunger, with a minimum desire for food even when full.
- Fully fed schools that either loiter near the Krabby Patty or drift away depending on the Food attraction slider.
- Optional plain-color hunger indicators above fish: red means hungry, green means low hunger or recently fed.
- Moving jellyfish swarm that fish avoid as an environmental hazard.
- Jellyfish leader periodically visits the Krabby Patty bait on a randomized 30-45 second interval.
- Jellyfish animation with pulsing bells, bobbing bodies, and waving tentacles.
- Bikini Bottom landmarks placed in the simulation volume, with static obstacle footprints.
- Downloaded fish, Krabby Patty, character, and landmark `.glb` models, with the jellyfish swarm animated procedurally in Three.js.
- Interactive controls for population size, perception radius, behavior weights, and status dot display.
- Interactive camera navigation: mouse orbit/zoom plus WASD translation through the scene.
- 3D underwater scene built with React, Vite, Three.js, and React Three Fiber.

## Design Motivation

### Hunger as Internal State

Food-seeking is more convincing when agents have internal state. Each fish stores `hunger` in the range `[0, 1]`:

- `1` means very hungry.
- `0` means full.
- Hunger decreases while a fish remains near the Krabby Patty.
- Hunger gradually recovers when a fish is away from food.

This avoids a hard-coded "stay for N seconds after eating" rule. Fish stay longer because they are still hungry, not because of an arbitrary timer.

### Food Attraction as Environmental Strength

The Food attraction slider is treated as the strength of the food cue, similar to how noticeable or tempting the Krabby Patty is. Hunger still controls individual motivation, but even full fish keep some residual attraction to food.

The current food desire multiplier is:

```text
foodDesire = 0.5 + 0.5 * hunger
actualFoodForce = configuredFoodAttraction * foodDesire
```

This means:

- A full fish still receives 50 percent of the user-configured food attraction.
- A hungry fish receives 100 percent of the user-configured food attraction.
- Increasing Food attraction makes the before/after behavior visibly different.

This design preserves biological motivation while keeping the user-controlled parameter meaningful.

### School-Level Target Modes

Fish still move as schools, so wander target selection is tracked per school rather than per fish. Each school has a `targetMode`:

- `explore`: normal wandering through the environment.
- `avoid-food`: the school is full and low food attraction allows it to move away from food.
- `food-loiter`: the school is full but high food attraction keeps it around the Krabby Patty.

The mode prevents target thrashing. Without this mode, a full school under high food attraction could pick a new random loiter target every frame, producing unstable movement.

### Species Separation

Earlier behavior allowed different species to collapse into one cluster after touching the Krabby Patty. The current model addresses that in two ways:

- Alignment and cohesion only use same-group neighbors.
- Different-group neighbors trigger stronger and longer-range separation.

This keeps the food source shared while preserving recognizable species groups.

### Jellyfish Bait Behavior

The jellyfish swarm normally wanders, but its leader occasionally targets the Krabby Patty location. This creates a predator/bait dynamic:

- Fish are attracted to the Krabby Patty.
- Jellyfish periodically visit that same region.
- Fish avoid the jellyfish swarm when it comes into range.

The visit interval is randomized between 30 and 45 seconds so the hazard remains intermittent rather than constantly preventing feeding.

## Simulation Model

At each animation frame, every fish agent senses only nearby information:

- Other fish within its perception radius.
- The Krabby Patty attractor.
- The jellyfish hazard.
- The soft boundary of the simulation volume.
- Static landmark footprints when collision constraints apply.

Each agent combines steering vectors:

- `Food attraction`: pulls toward the Krabby Patty when inside perception range.
- `Hazard avoidance`: pushes away from the jellyfish swarm.
- `Separation`: prevents overlap and keeps different species apart.
- `Alignment`: nudges a fish toward same-school neighbors' headings.
- `Cohesion`: nudges a fish toward the same-school local center.
- `Wandering`: pulls fish toward a school-level exploration, food-avoidance, or food-loiter target.
- `Boundary steering`: keeps agents inside the underwater volume.

The combined force is clamped by `maxForce`, then velocity is clamped by `maxSpeed`.

## Important Parameters

These are the main behavior parameters currently encoded in `src/sim/simulation.ts`.

| Parameter | Current Value | Purpose |
| --- | ---: | --- |
| Default agent count | `48` | Number of simulated agents, including fish and character agents. |
| Perception radius | `4.2` | Local sensing range for neighbors and food attraction. |
| Food attraction range | `perceptionRadius + 1.4` | Fish only seek the Krabby Patty after it is locally detectable. |
| Hunger initial range | `0.62-1.0` | Fish start somewhat to very hungry. |
| Hunger drop rate near food | `0.16 / second` | Controls how long fish need to stay near food before full. |
| Hunger recovery away from food | `0.034 / second` | Controls how slowly fish become hungry again. |
| Hungry status threshold | `0.6` | Red status dot at or above this value, green below it. |
| Full food desire floor | `0.5` | Full fish still feel half of the configured food attraction. |
| Food loiter threshold | `2.0` | Food attraction value at which full schools loiter near food instead of leaving. |
| School wander interval | `8-18 seconds` | Random interval for changing exploration targets. |
| Jellyfish bait interval | `30-45 seconds` | Random interval before jellyfish leader visits the Krabby Patty. |
| Cross-species separation multiplier | `2.55` | Expands separation range for different species. |

## Controls

The controls panel exposes the main interactive parameters:

- `Agents`: changes population size.
- `Perception radius`: changes local sensing range.
- `Food attraction`: changes the strength of Krabby Patty attraction and controls whether full schools loiter near food.
- `Hazard avoidance`: changes how strongly fish avoid the jellyfish swarm.
- `Separation`: changes crowding avoidance.
- `Alignment`: changes same-school heading matching.
- `Cohesion`: changes same-school clustering.
- `Status dots`: toggles hunger indicators on or off.
- `Reset simulation`: resets agents and random target state.

Scene navigation:

- Mouse drag orbits the camera around the current view target.
- Mouse wheel zooms in and out within the configured OrbitControls distance limits.
- `W` / `S` move forward and backward relative to the camera's current horizontal facing direction.
- `A` / `D` strafe left and right relative to the camera's current rotation. The OrbitControls target is translated with the camera so orbiting remains stable after keyboard movement.

## Expected Behaviors to Discuss in the Report

- Low Food attraction: fish may visit the Krabby Patty but full schools are more likely to wander away after feeding.
- High Food attraction: fish still approach when hungry, and full schools tend to remain around the Krabby Patty by selecting food-loiter targets.
- Status dots reveal the internal hunger state that explains why fish approach, stay, or drift away.
- Blue or distant schools can eventually discover food because school-level wandering explores the simulation volume.
- Different fish species maintain separate schools because cross-species neighbors repel more strongly and do not contribute to alignment or cohesion.
- Jellyfish visits interrupt feeding behavior and create visible avoidance bursts around the bait location.
- Landmarks constrain the scene physically, so ground agents cannot walk through buildings and fish are kept out of obstacle interiors when relevant.

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

## Project Structure

```text
public/
  models/
    jellyfish.glb          Available jellyfish model asset, not currently used by the procedural swarm
    downloaded/
      Fish.glb             Reef fish group model
      Fish (1).glb         Blue fish group model
      Fish (2).glb         Long fish group model
      Blowfish.glb         Puffer fish group model
      Burger.glb           Food attractor model
      spongebob.glb        SpongeBob character model
      patrick.glb          Patrick character model
      squidward.glb        Squidward character model
      spongebobs_house.glb     SpongeBob's pineapple house model
      patricks_house.glb       Patrick's house model
      squidwards_house.glb     Squidward's house model
      krusty_krab.glb          Krusty Krab model
      downtown_fullset.glb     Downtown building cluster model
      downtown_buildings.glb   Downtown building cluster model
src/
  components/
    ControlsPanel.tsx      Interactive behavior controls
    SimulationScene.tsx    3D rendering, animation loop, status indicators, camera navigation
  sim/
    simulation.ts          Agent initialization, hunger, steering, school targets, hazard updates
    staticEnvironment.ts   Landmark placement and static obstacle footprints
    types.ts               Shared simulation data types
  App.tsx                  Application shell
  main.tsx                 React entry point
```

## Implementation Notes

- Hunger indicators are intentionally plain-color `meshBasicMaterial` markers. They are debug/status UI, not part of the physical environment.
- The puffer fish has a higher status-dot offset than the other fish species to avoid overlap with its rounder body.
- Loiter targets are sampled outside the Krabby Patty collision radius but inside the feeding radius, so full schools can remain near food without colliding with the attractor.
- The jellyfish target uses the Krabby Patty position plus a vertical offset so the swarm visits the bait area from above.
- Character agents are ground-locked and have separate collision handling from swimming fish.
- WASD camera movement projects the camera's forward vector onto the horizontal plane, derives the current right vector from that heading, and moves both `camera.position` and `OrbitControls.target`. This keeps `A` and `D` correct after orbit rotation.

## Limitations and Future Improvements

- Hunger parameters are hand-tuned. A future report could include a small parameter sweep showing how hunger drop rate and recovery rate change feeding cycles.
- The status dots are binary red/green indicators. A continuous gradient or size encoding could show hunger magnitude more precisely.
- Fish currently share the same hunger dynamics. Species-specific hunger drop or recovery rates could create more distinct ecological roles.
- Jellyfish behavior uses a random interval and waypoint steering rather than explicit predator decision-making.
- The Food attraction slider controls both attraction strength and full-school loitering. This is useful for demonstration, but future work could split it into separate "food cue strength" and "food persistence" parameters if more experimental control is needed.

## Asset Notes

- [Poly Pizza](https://poly.pizza/) for low-poly GLTF/GLB-style assets.
- [Quaternius](https://quaternius.com/) for free game-ready packs.
- [Kenney](https://kenney.nl/assets) for consistent game asset sets.
- [Sketchfab](https://sketchfab.com/) if filtering for downloadable CC0 or CC-BY models.
