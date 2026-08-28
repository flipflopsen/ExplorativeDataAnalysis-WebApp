import { useAppStore } from "../state/appStore";
import type { Force3DConfig } from "../state/appStore";

interface Meta {
  key: keyof Force3DConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  help: string;
}

const META: Meta[] = [
  { key: "charge", label: "Repulsion (charge)", min: -400, max: -10, step: 5, help: "How strongly nodes push each other apart. More negative = more spread." },
  { key: "linkDistance", label: "Link distance", min: 5, max: 120, step: 1, help: "Target resting length of edges." },
  { key: "linkStrength", label: "Link strength", min: 0, max: 2, step: 0.05, help: "How rigidly edges pull connected nodes together." },
  { key: "velocityDecay", label: "Friction (decay)", min: 0.05, max: 0.9, step: 0.01, help: "Higher = nodes slow down faster, less wobble." },
  { key: "alphaDecay", label: "Cooldown", min: 0.005, max: 0.1, step: 0.001, help: "Higher = the layout settles sooner." },
];

export default function Force3DPanel() {
  const forces3d = useAppStore((s) => s.forces3d);
  const patch = useAppStore((s) => s.patchForces3d);
  const reset = useAppStore((s) => s.resetForces3d);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h4 style={{ margin: "0 0 8px" }}>3D Forces</h4>
        <button onClick={reset} title="Reset 3D forces to defaults">
          Reset
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {META.map((m) => {
          const v = forces3d[m.key];
          return (
            <label key={m.key} style={{ fontSize: 11, display: "block" }} title={m.help}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{m.label}</span>
                <span style={{ opacity: 0.7 }}>{Number(v).toFixed(m.step < 1 ? 3 : 0)}</span>
              </div>
              <input
                type="range"
                min={m.min}
                max={m.max}
                step={m.step}
                value={Number(v)}
                onChange={(e) => patch({ [m.key]: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
