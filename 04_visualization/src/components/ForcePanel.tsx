import { FORCE_META } from "../api/config";
import { useAppStore } from "../state/appStore";

export default function ForcePanel() {
  const forces = useAppStore((s) => s.forces);
  const patch = useAppStore((s) => s.patchForces);
  const reset = useAppStore((s) => s.resetForces);
  const paused = useAppStore((s) => s.paused);
  const setPaused = useAppStore((s) => s.setPaused);

  if (!forces) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h4 style={{ margin: "0 0 8px" }}>Forces</h4>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setPaused(!paused)} title={paused ? "Resume" : "Pause"}>
            {paused ? "▶ Play" : "⏸ Pause"}
          </button>
          <button onClick={reset} title="Reset to graph_config.json defaults">
            Reset
          </button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {FORCE_META.map((m) => {
          const v = forces[m.key];
          return (
            <label key={m.key} style={{ fontSize: 11, display: "block" }} title={m.help}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{m.label}</span>
                <span style={{ opacity: 0.7 }}>{Number(v).toFixed(m.step < 1 ? 2 : 0)}</span>
              </div>
              <input
                type="range"
                min={m.min}
                max={m.max}
                step={m.step}
                value={Number(v)}
                onChange={(e) => patch({ [m.key]: Number(e.target.value) } as Partial<typeof forces>)}
                style={{ width: "100%" }}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
