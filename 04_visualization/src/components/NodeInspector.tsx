import { useEffect, useState } from "react";
import { getRow, getStats, type ColumnStat, type RowResponse } from "../api/client";
import { useAppStore } from "../state/appStore";

const GROUP_PALETTE = [
  "#39bae6", "#ffb454", "#5ec962", "#ff7eb6", "#c678dd",
  "#80cbc4", "#bd93f9", "#ff6b6b", "#fde725", "#7aa8ff",
];

export default function NodeInspector() {
  const inspectedNode = useAppStore((s) => s.inspectedNode);
  const dataset = useAppStore((s) => s.dataset);
  const selection = useAppStore((s) => s.selection);
  const inspect = useAppStore((s) => s.inspect);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const groups = useAppStore((s) => s.groups);
  const addGroup = useAppStore((s) => s.addGroup);
  const removeGroup = useAppStore((s) => s.removeGroup);
  const setColorBy = useAppStore((s) => s.setColorBy);

  const [row, setRow] = useState<RowResponse | null>(null);
  const [stats, setStats] = useState<{ n_rows: number; columns: ColumnStat[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isMulti = selection.size > 1;
  const isSingle = inspectedNode != null && selection.size <= 1;

  // Single-row fetch
  useEffect(() => {
    if (!isSingle || !dataset || inspectedNode == null) {
      setRow(null);
      return;
    }
    setBusy(true);
    setError(null);
    getRow(dataset.dataset_id, inspectedNode)
      .then(setRow)
      .catch((e) => setError(String(e)))
      .finally(() => setBusy(false));
  }, [isSingle, inspectedNode, dataset]);

  // Multi-row stats fetch
  useEffect(() => {
    if (!isMulti || !dataset) {
      setStats(null);
      return;
    }
    setBusy(true);
    setError(null);
    getStats(dataset.dataset_id, Array.from(selection))
      .then(setStats)
      .catch((e) => setError(String(e)))
      .finally(() => setBusy(false));
  }, [isMulti, selection, dataset]);

  if (!isSingle && !isMulti) {
    return (
      <div style={{ fontSize: 12, opacity: 0.6 }}>
        Click a node or right-drag an area to inspect.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 13 }}>
          {isMulti ? `Selection (${selection.size.toLocaleString()})` : `Node #${inspectedNode}`}
        </strong>
        <button
          onClick={() => {
            inspect(null);
            clearSelection();
          }}
        >
          ×
        </button>
      </div>

      {isMulti && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              const idx = groups.length % GROUP_PALETTE.length;
              addGroup(`Group ${groups.length + 1}`, GROUP_PALETTE[idx]);
              setColorBy("__group__");
            }}
            title="Save current selection as a colored group"
          >
            + Save as group
          </button>
        </div>
      )}

      {busy && <div style={{ fontSize: 12, opacity: 0.7 }}>Loading…</div>}
      {error && <div style={{ fontSize: 12, color: "#ff6b6b" }}>{error}</div>}

      {isSingle && row && (
        <table style={{ fontSize: 11, width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {Object.entries(row.values).map(([k, v]) => (
              <tr key={k} style={{ borderBottom: "1px solid var(--border, #2a2f3a44)" }}>
                <td
                  style={{
                    padding: "2px 6px 2px 0",
                    verticalAlign: "top",
                    opacity: 0.7,
                    whiteSpace: "nowrap",
                  }}
                >
                  {k}
                </td>
                <td style={{ padding: "2px 0", wordBreak: "break-word" }}>
                  {v == null ? <em style={{ opacity: 0.5 }}>null</em> : String(v)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isMulti && stats && (
        <div style={{ overflow: "auto" }}>
          {stats.columns.map((c) => (
            <ColumnStatBlock key={c.column} c={c} />
          ))}
        </div>
      )}

      {groups.length > 0 && (
        <div style={{ marginTop: 8, borderTop: "1px solid #2a2f3a44", paddingTop: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Saved groups</div>
          {groups.map((g) => (
            <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span style={{ width: 10, height: 10, background: g.color, borderRadius: 2 }} />
              <span style={{ flex: 1 }}>{g.name} ({g.ids.length})</span>
              <button onClick={() => removeGroup(g.name)}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ColumnStatBlock({ c }: { c: ColumnStat }) {
  return (
    <div
      style={{
        marginBottom: 6,
        padding: "4px 6px",
        background: "#0006",
        borderRadius: 3,
        fontSize: 11,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>{c.column}</strong>
        <span style={{ opacity: 0.6 }}>{c.kind}</span>
      </div>
      {c.kind === "numeric" && (
        <div style={{ opacity: 0.85, display: "grid", gridTemplateColumns: "auto 1fr", gap: "0 8px" }}>
          <span style={{ opacity: 0.6 }}>mean</span><span>{fmt(c.mean)}</span>
          <span style={{ opacity: 0.6 }}>median</span><span>{fmt(c.median)}</span>
          <span style={{ opacity: 0.6 }}>std</span><span>{fmt(c.std)}</span>
          <span style={{ opacity: 0.6 }}>min</span><span>{fmt(c.min)}</span>
          <span style={{ opacity: 0.6 }}>max</span><span>{fmt(c.max)}</span>
          <span style={{ opacity: 0.6 }}>null</span><span>{c.n_null}</span>
        </div>
      )}
      {c.kind === "categorical" && (
        <div style={{ opacity: 0.85 }}>
          <div style={{ opacity: 0.6 }}>
            unique: {c.n_unique} · null: {c.n_null}
          </div>
          {(c.top ?? []).map((t) => (
            <div key={t.value} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                {t.value || <em style={{ opacity: 0.5 }}>∅</em>}
              </span>
              <span style={{ opacity: 0.7 }}>{t.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmt(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs !== 0 && (abs < 0.01 || abs >= 1e6)) return v.toExponential(2);
  return Number(v.toFixed(3)).toString();
}
