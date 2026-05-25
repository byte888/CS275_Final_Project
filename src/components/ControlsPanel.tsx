import type { SimulationConfig } from "../sim/types";

type ControlsPanelProps = {
  config: SimulationConfig;
  onConfigChange: (config: SimulationConfig) => void;
  onReset: () => void;
};

type WeightKey = keyof SimulationConfig["weights"];

const WEIGHT_CONTROLS: Array<{ key: WeightKey; label: string; min: number; max: number; step: number }> = [
  { key: "food", label: "Food attraction", min: 0, max: 3, step: 0.05 },
  { key: "hazard", label: "Hazard avoidance", min: 0, max: 5, step: 0.05 },
  { key: "separation", label: "Separation", min: 0, max: 4, step: 0.05 },
  { key: "alignment", label: "Alignment", min: 0, max: 3, step: 0.05 },
  { key: "cohesion", label: "Cohesion", min: 0, max: 3, step: 0.05 },
];

export function ControlsPanel({ config, onConfigChange, onReset }: ControlsPanelProps) {
  const updateConfig = <Key extends keyof SimulationConfig>(
    key: Key,
    value: SimulationConfig[Key],
  ) => {
    onConfigChange({ ...config, [key]: value });
  };

  const updateWeight = (key: WeightKey, value: number) => {
    onConfigChange({
      ...config,
      weights: {
        ...config.weights,
        [key]: value,
      },
    });
  };

  return (
    <aside className="controls-panel">
      <div>
        <p className="eyebrow">Bikini Bottom ALife</p>
        <h1>Perception-Driven Fish School</h1>
        <p>
          Each fish senses only nearby fish, the Krabby Patty, the jellyfish swarm, and the
          simulation boundary. Local steering rules combine into visible schooling and avoidance.
        </p>
      </div>

      <label>
        <span>
          Agents <strong>{config.agentCount}</strong>
        </span>
        <input
          type="range"
          min="12"
          max="100"
          step="1"
          value={config.agentCount}
          onChange={(event) => updateConfig("agentCount", Number(event.target.value))}
        />
      </label>

      <label>
        <span>
          Perception radius <strong>{config.perceptionRadius.toFixed(1)}</strong>
        </span>
        <input
          type="range"
          min="1.5"
          max="7"
          step="0.1"
          value={config.perceptionRadius}
          onChange={(event) => updateConfig("perceptionRadius", Number(event.target.value))}
        />
      </label>

      {WEIGHT_CONTROLS.map((control) => (
        <label key={control.key}>
          <span>
            {control.label} <strong>{config.weights[control.key].toFixed(2)}</strong>
          </span>
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={config.weights[control.key]}
            onChange={(event) => updateWeight(control.key, Number(event.target.value))}
          />
        </label>
      ))}

      <button type="button" onClick={onReset}>
        Reset simulation
      </button>
    </aside>
  );
}
