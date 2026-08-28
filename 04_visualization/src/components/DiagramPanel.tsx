import { useEffect, useState } from "react";
import { aggregateViz, suggestCharts } from "../api/client";
import { useAppStore } from "../state/appStore";
import type { ChartKind, ChartSuggestion } from "../api/types";
import FeaturePicker from "./FeaturePicker";
import ChartView from "./ChartView";

const ALL_KINDS: ChartKind[] = ["histogram", "scatter", "hexbin", "heatmap", "parallel", "box", "corr", "map"];

export default function DiagramPanel() {
  const dataset = useAppStore((s) => s.dataset)!;
  const selection = useAppStore((s) => s.selection);
  const clearSelection = useAppStore((s) => s.clearSelection);

  const [features, setFeatures] = useState<string[]>([]);
  const [kind, setKind] = useState<ChartKind>("histogram");
  const [suggestions, setSuggestions] = useState<ChartSuggestion[]>([]);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (features.length === 0) {
      setSuggestions([]);
      return;
    }
    suggestCharts(dataset.dataset_id, features)
      .then((s) => {
        setSuggestions(s);
        if (s.length > 0 && !s.find((x) => x.kind === kind)) setKind(s[0].kind);
      })
      .catch(() => setSuggestions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features.join(","), dataset.dataset_id]);

  async function render() {
    setBusy(true);
    setError(null);
    try {
      const node_ids = selection.size > 0 ? Array.from(selection) : null;
      const result = await aggregateViz({
        dataset_id: dataset.dataset_id,
        node_ids,
        features,
        kind,
      });
      setData(result);
    } catch (e) {
      setError(String(e));
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div>
        <h3 style={{ margin: "0 0 8px" }}>Diagram</h3>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Selection: {selection.size > 0 ? selection.size.toLocaleString() + " nodes" : "all rows"}{" "}
          {selection.size > 0 && (
            <button onClick={clearSelection} style={{ marginLeft: 8 }}>
              clear
            </button>
          )}
        </div>
      </div>
      <FeaturePicker value={features} onChange={setFeatures} />
      <div>
        <label style={{ fontSize: 12 }}>
          Chart kind:{" "}
          <select value={kind} onChange={(e) => setKind(e.target.value as ChartKind)}>
            {ALL_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        {suggestions.length > 0 && (
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
            Suggested: {suggestions.slice(0, 3).map((s) => s.kind).join(", ")}
          </div>
        )}
      </div>
      <button disabled={busy || features.length === 0} onClick={render}>
        {busy ? "Rendering…" : "Render"}
      </button>
      {error && <div style={{ color: "#ff6b6b", fontSize: 12 }}>{error}</div>}
      <div style={{ flex: 1, minHeight: 0 }}>{data && <ChartView data={data} />}</div>
    </div>
  );
}
