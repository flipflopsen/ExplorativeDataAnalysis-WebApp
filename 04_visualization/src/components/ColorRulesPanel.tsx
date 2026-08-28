import { useEffect, useMemo, useState } from "react";
import { getColumn } from "../api/client";
import { useAppStore, type ColorRule } from "../state/appStore";
import { Button, ColorSwatch, Label, Segmented, Select } from "../ui/primitives";

const DEFAULT_COLORS = [
  "#39bae6", "#ffb454", "#5ec962", "#ff7eb6", "#c678dd",
  "#80cbc4", "#bd93f9", "#ff6b6b", "#fde725", "#7aa8ff",
];

export default function ColorRulesPanel() {
  const dataset = useAppStore((s) => s.dataset);
  const rules = useAppStore((s) => s.colorRules);
  const addRule = useAppStore((s) => s.addColorRule);
  const updateRule = useAppStore((s) => s.updateColorRule);
  const removeRule = useAppStore((s) => s.removeColorRule);
  const clearRules = useAppStore((s) => s.clearColorRules);

  const [draftTarget, setDraftTarget] = useState<"node" | "link">("node");
  const [draftColumn, setDraftColumn] = useState<string>("");
  const [draftValues, setDraftValues] = useState<string[]>([]);
  const [draftValue, setDraftValue] = useState<string>("");
  const [draftColor, setDraftColor] = useState<string>(DEFAULT_COLORS[0]);

  const cols = useMemo(() => dataset?.columns ?? [], [dataset]);

  useEffect(() => {
    if (!dataset) return;
    if (!draftColumn && cols.length > 0) setDraftColumn(cols[0].name);
  }, [dataset, cols, draftColumn]);

  // Load distinct values for the selected column (capped).
  useEffect(() => {
    let cancelled = false;
    if (!dataset || !draftColumn) {
      setDraftValues([]);
      return;
    }
    getColumn(dataset.dataset_id, draftColumn)
      .then((col) => {
        if (cancelled) return;
        const seen = new Set<string>();
        for (const v of col.values) {
          if (seen.size >= 200) break;
          const key = v == null ? "∅" : String(v);
          seen.add(key);
        }
        const list = Array.from(seen).sort();
        setDraftValues(list);
        setDraftValue((prev) => (prev && list.includes(prev) ? prev : list[0] ?? ""));
      })
      .catch(() => setDraftValues([]));
    return () => {
      cancelled = true;
    };
  }, [dataset, draftColumn]);

  function commit() {
    if (!draftColumn || !draftValue) return;
    addRule({
      target: draftTarget,
      column: draftColumn,
      value: draftValue,
      color: draftColor,
    });
    // Rotate default color to make subsequent rules distinct.
    const next = (DEFAULT_COLORS.indexOf(draftColor) + 1) % DEFAULT_COLORS.length;
    setDraftColor(DEFAULT_COLORS[next]);
  }

  if (!dataset) return <Label>Load a dataset first.</Label>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Segmented
        options={[
          { value: "node", label: "Nodes" },
          { value: "link", label: "Links" },
        ]}
        value={draftTarget}
        onChange={setDraftTarget}
      />

      <div>
        <Label>Feature</Label>
        <Select value={draftColumn} onChange={(e) => setDraftColumn(e.target.value)}>
          {cols.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} · {c.dtype}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Value</Label>
        <Select
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          disabled={draftValues.length === 0}
        >
          {draftValues.length === 0 && <option>(none)</option>}
          {draftValues.map((v) => (
            <option key={v} value={v}>
              {v.length > 60 ? v.slice(0, 57) + "…" : v}
            </option>
          ))}
        </Select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Label style={{ marginBottom: 0 }}>Color</Label>
        <ColorSwatch value={draftColor} onChange={setDraftColor} size={24} />
        <span style={{ fontSize: 11, opacity: 0.6, fontFamily: "monospace" }}>{draftColor}</span>
        <div style={{ flex: 1 }} />
        <Button variant="primary" onClick={commit} disabled={!draftValue}>
          Add rule
        </Button>
      </div>

      {rules.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Label style={{ marginBottom: 0 }}>Active rules ({rules.length})</Label>
            <Button variant="danger" size="sm" onClick={clearRules}>
              Clear all
            </Button>
          </div>
          {rules.map((r, i) => (
            <RuleRow key={i} rule={r} idx={i} onUpdate={updateRule} onRemove={removeRule} />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleRow({
  rule,
  idx,
  onUpdate,
  onRemove,
}: {
  rule: ColorRule;
  idx: number;
  onUpdate: (idx: number, patch: Partial<ColorRule>) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        padding: "4px 6px",
        background: "#0004",
        borderRadius: 4,
      }}
    >
      <ColorSwatch value={rule.color} onChange={(c) => onUpdate(idx, { color: c })} />
      <span style={{ opacity: 0.7, textTransform: "uppercase", fontSize: 10, width: 36 }}>
        {rule.target}
      </span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <strong>{rule.column}</strong> = {rule.value}
      </span>
      <Button variant="ghost" size="sm" onClick={() => onRemove(idx)}>
        ×
      </Button>
    </div>
  );
}
