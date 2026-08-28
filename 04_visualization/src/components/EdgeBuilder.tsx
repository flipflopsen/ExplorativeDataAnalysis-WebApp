import { useEffect, useState } from "react";
import { buildGraph, getTopology } from "../api/client";
import { useAppStore } from "../state/appStore";
import type { EdgeRule, EdgeRuleKind } from "../api/types";
import { Button, Card, Input, Label, Segmented, Select } from "../ui/primitives";

interface Props {
  onBuilt?: () => void;
}

export default function EdgeBuilder({ onBuilt }: Props) {
  const dataset = useAppStore((s) => s.dataset)!;
  const setGraph = useAppStore((s) => s.setGraph);

  const [mode, setMode] = useState<"easy" | "advanced">("easy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericCols = dataset.columns
    .filter((c) => c.dtype === "int" || c.dtype === "float")
    .map((c) => c.name);
  const categoricalCols = dataset.columns
    .filter((c) => c.dtype === "string" || c.dtype === "category" || c.dtype === "bool")
    .map((c) => c.name);
  const allCols = dataset.columns.map((c) => c.name);

  // ── Easy mode state ────────────────────────────────────────────────────
  const [easyKind, setEasyKind] = useState<"cluster" | "knn" | "similarity">("cluster");
  const [easyColumn, setEasyColumn] = useState<string>(categoricalCols[0] ?? allCols[0]);
  const [easyFeatures, setEasyFeatures] = useState<string[]>(numericCols.slice(0, 3));
  const [easyK, setEasyK] = useState<number>(6);
  const [easyMaxPairs, setEasyMaxPairs] = useState<number>(40);
  const [easyThreshold, setEasyThreshold] = useState<number>(0.9);

  // ── Advanced mode state ────────────────────────────────────────────────
  const [rules, setRules] = useState<EdgeRule[]>([]);

  useEffect(() => {
    if (!easyColumn && allCols.length > 0) setEasyColumn(allCols[0]);
  }, [allCols, easyColumn]);

  function easyAsRules(): EdgeRule[] {
    if (easyKind === "cluster") {
      return [{ kind: "shared_key", key_column: easyColumn, max_pairs_per_group: easyMaxPairs }];
    }
    if (easyKind === "knn") {
      return [{ kind: "knn", feature_columns: easyFeatures, k: easyK }];
    }
    return [
      {
        kind: "similarity",
        feature_columns: easyFeatures,
        threshold: easyThreshold,
        metric: "cosine",
      },
    ];
  }

  async function build() {
    setBusy(true);
    setError(null);
    try {
      const ruleSpec = mode === "easy" ? easyAsRules() : rules;
      const info = await buildGraph({ dataset_id: dataset.dataset_id, rules: ruleSpec });
      const topo = await getTopology(info.graph_id);
      setGraph(info, topo);
      onBuilt?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function addRule(kind: EdgeRuleKind) {
    const base: EdgeRule = { kind };
    if (kind === "knn") {
      base.feature_columns = numericCols.slice(0, 2);
      base.k = 8;
    } else if (kind === "shared_key") {
      base.key_column = allCols[0];
      base.max_pairs_per_group = 50;
    } else if (kind === "similarity") {
      base.feature_columns = numericCols.slice(0, 2);
      base.threshold = 0.9;
      base.metric = "cosine";
    }
    setRules([...rules, base]);
  }

  function updateRule(i: number, patch: Partial<EdgeRule>) {
    setRules(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRule(i: number) {
    setRules(rules.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Segmented
        options={[
          { value: "easy", label: "Easy" },
          { value: "advanced", label: "Advanced" },
        ]}
        value={mode}
        onChange={setMode}
        style={{ alignSelf: "flex-start" }}
      />

      {mode === "easy" ? (
        <Card padded title="Quick start">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Label>What kind of graph?</Label>
            <Segmented
              options={[
                { value: "cluster", label: "Clusters" },
                { value: "knn", label: "K-Nearest" },
                { value: "similarity", label: "Similarity" },
              ]}
              value={easyKind}
              onChange={setEasyKind}
            />

            {easyKind === "cluster" && (
              <>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  Group rows that share the same value of a column. Great for
                  category-based exploration.
                </div>
                <div>
                  <Label>Group by column</Label>
                  <Select value={easyColumn} onChange={(e) => setEasyColumn(e.target.value)}>
                    {allCols.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Max links per group: {easyMaxPairs}</Label>
                  <input
                    type="range"
                    min={5}
                    max={200}
                    value={easyMaxPairs}
                    onChange={(e) => setEasyMaxPairs(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
              </>
            )}

            {easyKind === "knn" && (
              <>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  Connect each row to its K most similar neighbors using
                  numeric features.
                </div>
                <MultiPickerInline
                  label="Features"
                  options={numericCols}
                  values={easyFeatures}
                  onChange={setEasyFeatures}
                />
                <div>
                  <Label>K (neighbors per node): {easyK}</Label>
                  <input
                    type="range"
                    min={2}
                    max={30}
                    value={easyK}
                    onChange={(e) => setEasyK(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
              </>
            )}

            {easyKind === "similarity" && (
              <>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  Connect rows whose cosine similarity exceeds a threshold.
                </div>
                <MultiPickerInline
                  label="Features"
                  options={numericCols}
                  values={easyFeatures}
                  onChange={setEasyFeatures}
                />
                <div>
                  <Label>Threshold: {easyThreshold.toFixed(2)}</Label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={easyThreshold}
                    onChange={(e) => setEasyThreshold(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
              </>
            )}
          </div>
        </Card>
      ) : (
        <Card
          padded
          title="Edge rules"
          actions={
            <div style={{ display: "flex", gap: 4 }}>
              <Button size="sm" onClick={() => addRule("knn")}>+ KNN</Button>
              <Button size="sm" onClick={() => addRule("shared_key")}>+ Key</Button>
              <Button size="sm" onClick={() => addRule("similarity")}>+ Sim</Button>
            </div>
          }
        >
          {rules.length === 0 && (
            <div style={{ fontSize: 11, opacity: 0.6 }}>
              Add one or more rules. Multiple rules union their edges.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rules.map((r, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid #2a2f3a",
                  padding: 8,
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <strong style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: 0.5 }}>
                    {r.kind}
                  </strong>
                  <Button variant="ghost" size="sm" onClick={() => removeRule(i)}>×</Button>
                </div>
                {r.kind === "knn" && (
                  <>
                    <MultiPickerInline
                      label="Features"
                      options={numericCols}
                      values={r.feature_columns ?? []}
                      onChange={(vals) => updateRule(i, { feature_columns: vals })}
                    />
                    <Label>K</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={r.k ?? 8}
                      onChange={(e) => updateRule(i, { k: Number(e.target.value) })}
                    />
                  </>
                )}
                {r.kind === "shared_key" && (
                  <>
                    <Label>Column</Label>
                    <Select
                      value={r.key_column}
                      onChange={(e) => updateRule(i, { key_column: e.target.value })}
                    >
                      {allCols.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                    <Label>Max pairs / group</Label>
                    <Input
                      type="number"
                      min={2}
                      max={500}
                      value={r.max_pairs_per_group ?? 50}
                      onChange={(e) =>
                        updateRule(i, { max_pairs_per_group: Number(e.target.value) })
                      }
                    />
                  </>
                )}
                {r.kind === "similarity" && (
                  <>
                    <MultiPickerInline
                      label="Features"
                      options={numericCols}
                      values={r.feature_columns ?? []}
                      onChange={(vals) => updateRule(i, { feature_columns: vals })}
                    />
                    <Label>Threshold</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={r.threshold ?? 0.9}
                      onChange={(e) => updateRule(i, { threshold: Number(e.target.value) })}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Button
        variant="primary"
        size="md"
        disabled={busy || (mode === "advanced" && rules.length === 0)}
        onClick={build}
        style={{ justifyContent: "center" }}
      >
        {busy ? "Building…" : "Build graph"}
      </Button>
      {error && <div style={{ color: "#ff6b6b", fontSize: 12 }}>{error}</div>}
    </div>
  );
}

function MultiPickerInline({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(opt: string) {
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
  }
  return (
    <div>
      <Label>{label} ({values.length})</Label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {options.length === 0 && (
          <span style={{ fontSize: 11, opacity: 0.6 }}>No numeric features available.</span>
        )}
        {options.map((o) => {
          const active = values.includes(o);
          return (
            <button
              key={o}
              onClick={() => toggle(o)}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 4,
                cursor: "pointer",
                border: active ? "1px solid #39bae6" : "1px solid #2a2f3a",
                background: active ? "#39bae633" : "transparent",
                color: "inherit",
              }}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
