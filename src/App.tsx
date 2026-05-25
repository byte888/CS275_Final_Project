import { useMemo, useState } from "react";
import { Vector3 } from "three";
import { ControlsPanel } from "./components/ControlsPanel";
import { SimulationScene } from "./components/SimulationScene";
import { defaultConfig } from "./sim/simulation";
import type { SimulationConfig } from "./sim/types";
import "./App.css";

function cloneConfig(config: SimulationConfig): SimulationConfig {
  return {
    ...config,
    bounds: config.bounds.clone(),
    weights: { ...config.weights },
  };
}

export default function App() {
  const initialConfig = useMemo(() => cloneConfig(defaultConfig), []);
  const [config, setConfig] = useState<SimulationConfig>(initialConfig);
  const [sceneKey, setSceneKey] = useState(0);

  const resetSimulation = () => {
    setConfig({
      ...cloneConfig(defaultConfig),
      bounds: new Vector3(defaultConfig.bounds.x, defaultConfig.bounds.y, defaultConfig.bounds.z),
    });
    setSceneKey((key) => key + 1);
  };

  return (
    <main className="app-shell">
      <SimulationScene key={sceneKey} config={config} />
      <ControlsPanel config={config} onConfigChange={setConfig} onReset={resetSimulation} />
      <section className="status-card" aria-label="Simulation summary">
        <strong>{config.agentCount}</strong> autonomous fish
        <span>Krabby Patty attractor</span>
        <span>Moving jellyfish hazard</span>
      </section>
    </main>
  );
}
