import { useEffect, useRef, useState } from "react";
import { Graph, type GraphConfigInterface } from "@cosmos.gl/graph";
import { useAppStore } from "../state/appStore";
import { getColumn } from "../api/client";
import {
  hexToRgba,
  pointColorsFromCategorical,
  pointColorsFromNumeric,
  pointColorsFromTheme,
} from "../lib/colors";

const GROUP_BY = "__group__";

export default function GraphCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const hasFittedRef = useRef(false);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const dragStartedRef = useRef(false);

  const topology = useAppStore((s) => s.topology);
  const dataset = useAppStore((s) => s.dataset);
  const forces = useAppStore((s) => s.forces);
  const rendering = useAppStore((s) => s.rendering);
  const themeName = useAppStore((s) => s.themeName);
  const appConfig = useAppStore((s) => s.appConfig);
  const colorBy = useAppStore((s) => s.colorBy);
  const paused = useAppStore((s) => s.paused);
  const inspect = useAppStore((s) => s.inspect);
  const setSelection = useAppStore((s) => s.setSelection);
  const selection = useAppStore((s) => s.selection);
  const groups = useAppStore((s) => s.groups);
  const colorRules = useAppStore((s) => s.colorRules);

  const theme = appConfig ? appConfig.themes[themeName] : null;

  // ── Graph init (once) ────────────────────────────────────────────────────
  useEffect(() => {
    if (!hostRef.current || !forces || !rendering || !theme) return;
    const host = hostRef.current;

    const graph = new Graph(host, {
      ...forces,
      ...rendering,
      enableSimulation: true,
      fitViewOnInit: false,
      enableDrag: true,
      backgroundColor: theme.background,
      pointDefaultColor: theme.node,
      linkDefaultColor: theme.link,
      hoveredPointRingColor: theme.accent,
      focusedPointRingColor: theme.accent,
      renderHoveredPointRing: true,
      onClick: (index: number | undefined) => {
        if (typeof index === "number") {
          setSelection([index]);
          inspect(index);
          graph.selectPointByIndex(index, true);
          graph.setConfig({ focusedPointIndex: index });
        } else {
          setSelection([]);
          inspect(null);
          graph.unselectPoints();
        }
      },
      onSimulationEnd: () => {
        // Only fit the view once the simulation has actually settled.
        graphRef.current?.fitView(500, 0.15);
        hasFittedRef.current = true;
      },
    });

    graphRef.current = graph;
    return () => {
      graph.destroy();
      graphRef.current = null;
      host.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live force / render / theme updates ──────────────────────────────────
  useEffect(() => {
    const g = graphRef.current;
    if (!g || !forces || !rendering || !theme) return;
    const patch: GraphConfigInterface = {
      ...forces,
      ...rendering,
      backgroundColor: theme.background,
      pointDefaultColor: theme.node,
      linkDefaultColor: theme.link,
      hoveredPointRingColor: theme.accent,
      focusedPointRingColor: theme.accent,
    };
    g.setConfig(patch);
    g.start(0.15);
  }, [forces, rendering, theme]);

  // ── Pause / resume ───────────────────────────────────────────────────────
  useEffect(() => {
    const g = graphRef.current;
    if (!g) return;
    if (paused) g.pause();
    else g.start(0.3);
  }, [paused]);

  // ── Topology updates ─────────────────────────────────────────────────────
  useEffect(() => {
    const g = graphRef.current;
    if (!g || !topology) return;
    const n = topology.nodes.length;
    const positions = new Float32Array(n * 2);
    // Seed in a zero-mean ring — prevents the random-bias drift that made the
    // camera appear to pan toward the bottom-left quadrant.
    for (let i = 0; i < n; i++) {
      const angle = (i / Math.max(1, n)) * Math.PI * 2 + Math.random() * 0.3;
      const r = 80 + Math.random() * 80;
      positions[i * 2] = Math.cos(angle) * r;
      positions[i * 2 + 1] = Math.sin(angle) * r;
    }
    const links = new Float32Array(topology.edges.length * 2);
    for (let i = 0; i < topology.edges.length; i++) {
      const [s, t] = topology.edges[i];
      links[i * 2] = s;
      links[i * 2 + 1] = t;
    }
    g.setPointPositions(positions);
    g.setLinks(links);
    hasFittedRef.current = false;
    applyColors();
    g.render();
    g.start(1.0);
    // Camera adjustment is deferred to onSimulationEnd — no premature fit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topology]);

  // ── Recolor on theme / color-by / groups / rules change ──────────────────
  useEffect(() => {
    applyColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorBy, themeName, topology, groups, colorRules]);

  // ── Reflect external selection changes back into cosmos ──────────────────
  useEffect(() => {
    const g = graphRef.current;
    if (!g) return;
    if (selection.size === 0) {
      g.unselectPoints();
      // restore default link coloring (no node focused)
      applyColors();
      return;
    }
    g.selectPointsByIndices(Array.from(selection));
    // Highlight: when exactly one node is focused, recolor links so adjacent
    // edges are fully opaque and non-adjacent are dimmed.
    if (selection.size === 1) {
      const focused = Array.from(selection)[0];
      highlightLinksForNode(focused);
    } else {
      applyColors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  function highlightLinksForNode(focused: number) {
    const g = graphRef.current;
    if (!g || !topology) return;
    const m = topology.edges.length;
    if (m === 0) return;
    const pointColors = g.getPointColors();
    const baseLinks = currentBaseLinkColors(pointColors);
    const dimAlpha = 0.05;
    const hiAlpha = 1.0;
    for (let i = 0; i < m; i++) {
      const [s, t] = topology.edges[i];
      const adjacent = s === focused || t === focused;
      baseLinks[i * 4 + 3] = adjacent ? hiAlpha : dimAlpha;
    }
    g.setLinkColors(baseLinks);
    g.render();
  }

  function currentBaseLinkColors(pointColors: Float32Array): Float32Array {
    // Recompute the "resting" link colors (rule-based or blended) so the
    // alpha overrides can be reapplied without losing the rule palette.
    if (!topology || !appConfig) return new Float32Array(0);
    const m = topology.edges.length;
    const out = new Float32Array(m * 4);
    const alpha = rendering?.linkOpacity ?? 0.6;
    const useRulePalette = (topology.rule_labels?.length ?? 0) > 1;
    const palette = appConfig.colorScales.categorical;
    for (let i = 0; i < m; i++) {
      if (useRulePalette && topology.edge_rules) {
        const ridx = topology.edge_rules[i] ?? 0;
        const [r, gC, b] = hexToRgba(palette[ridx % palette.length]);
        out[i * 4] = r;
        out[i * 4 + 1] = gC;
        out[i * 4 + 2] = b;
      } else {
        const [s, t] = topology.edges[i];
        out[i * 4] = (pointColors[s * 4] + pointColors[t * 4]) / 2;
        out[i * 4 + 1] = (pointColors[s * 4 + 1] + pointColors[t * 4 + 1]) / 2;
        out[i * 4 + 2] = (pointColors[s * 4 + 2] + pointColors[t * 4 + 2]) / 2;
      }
      out[i * 4 + 3] = alpha;
    }
    return out;
  }

  async function fetchRuleColumns(): Promise<Map<string, (string | null)[]>> {
    const map = new Map<string, (string | null)[]>();
    if (!dataset || !topology) return map;
    const cols = Array.from(new Set(colorRules.map((r) => r.column)));
    const ids = topology.nodes;
    await Promise.all(
      cols.map(async (c) => {
        try {
          const col = await getColumn(dataset.dataset_id, c);
          map.set(
            c,
            ids.map((i) =>
              i < col.values.length ? (col.values[i] == null ? null : String(col.values[i])) : null,
            ),
          );
        } catch {
          /* ignore */
        }
      }),
    );
    return map;
  }

  function applyNodeRuleOverrides(
    colors: Float32Array,
    nodeValues: Map<string, (string | null)[]>,
  ) {
    const nodeRules = colorRules.filter((r) => r.target === "node");
    if (!topology || nodeRules.length === 0) return;
    const n = topology.nodes.length;
    for (let i = 0; i < n; i++) {
      for (const rule of nodeRules) {
        const vals = nodeValues.get(rule.column);
        if (!vals) continue;
        if (vals[i] === rule.value) {
          const [r, gC, b] = hexToRgba(rule.color);
          colors[i * 4] = r;
          colors[i * 4 + 1] = gC;
          colors[i * 4 + 2] = b;
          colors[i * 4 + 3] = 1;
        }
      }
    }
  }

  function applyLinkRuleOverrides(
    linkColors: Float32Array,
    nodeValues: Map<string, (string | null)[]>,
  ) {
    const linkRules = colorRules.filter((r) => r.target === "link");
    if (!topology || linkRules.length === 0) return;
    for (let i = 0; i < topology.edges.length; i++) {
      const [s, t] = topology.edges[i];
      for (const rule of linkRules) {
        const vals = nodeValues.get(rule.column);
        if (!vals) continue;
        if (vals[s] === rule.value || vals[t] === rule.value) {
          // alpha is 0..1 for cosmos link colors; preserve current alpha.
          const a = linkColors[i * 4 + 3] || 0.8;
          const [r, gC, b] = hexToRgba(rule.color);
          linkColors[i * 4] = r;
          linkColors[i * 4 + 1] = gC;
          linkColors[i * 4 + 2] = b;
          linkColors[i * 4 + 3] = a;
        }
      }
    }
  }

  async function applyColors() {
    const g = graphRef.current;
    if (!g || !topology || !theme || !appConfig) return;
    const n = topology.nodes.length;

    let colors: Float32Array;

    if (colorBy === GROUP_BY) {
      colors = pointColorsFromTheme(n, theme);
      for (const grp of groups) {
        const [r, gC, b] = hexToRgba(grp.color);
        for (const idx of grp.ids) {
          if (idx < 0 || idx >= n) continue;
          colors[idx * 4] = r;
          colors[idx * 4 + 1] = gC;
          colors[idx * 4 + 2] = b;
          colors[idx * 4 + 3] = 1;
        }
      }
    } else if (!colorBy || !dataset) {
      // Colorful default. When the graph was built from multiple edge rules,
      // color each node by the dominant rule among its incident edges so the
      // grouping is visible at a glance. Otherwise spread categorical palette
      // across node index so the graph isn't a monochrome blob.
      const palette = appConfig.colorScales.categorical;
      const ruleLabels = topology.rule_labels ?? [];
      const edgeRules = topology.edge_rules ?? [];
      colors = new Float32Array(n * 4);
      if (ruleLabels.length > 1 && edgeRules.length === topology.edges.length) {
        // Count rule incidences per node; pick the dominant rule.
        const counts: Map<number, number>[] = Array.from({ length: n }, () => new Map());
        for (let i = 0; i < topology.edges.length; i++) {
          const [s, t] = topology.edges[i];
          const ridx = edgeRules[i];
          counts[s].set(ridx, (counts[s].get(ridx) ?? 0) + 1);
          counts[t].set(ridx, (counts[t].get(ridx) ?? 0) + 1);
        }
        for (let i = 0; i < n; i++) {
          let bestRule = -1;
          let bestCount = -1;
          for (const [r, c] of counts[i]) {
            if (c > bestCount) {
              bestCount = c;
              bestRule = r;
            }
          }
          const ridx = bestRule >= 0 ? bestRule : i % palette.length;
          const [r, gC, b] = hexToRgba(palette[ridx % palette.length]);
          colors[i * 4] = r;
          colors[i * 4 + 1] = gC;
          colors[i * 4 + 2] = b;
          colors[i * 4 + 3] = 1;
        }
      } else {
        for (let i = 0; i < n; i++) {
          const [r, gC, b] = hexToRgba(palette[i % palette.length]);
          colors[i * 4] = r;
          colors[i * 4 + 1] = gC;
          colors[i * 4 + 2] = b;
          colors[i * 4 + 3] = 1;
        }
      }
    } else {
      try {
        const col = await getColumn(dataset.dataset_id, colorBy);
        const aligned = topology.nodes.map((i) =>
          i < col.values.length ? col.values[i] : null,
        );
        const palette = col.is_numeric
          ? appConfig.colorScales.numeric
          : appConfig.colorScales.categorical;
        colors = col.is_numeric
          ? pointColorsFromNumeric(aligned, palette)
          : pointColorsFromCategorical(aligned, palette);
      } catch {
        colors = pointColorsFromTheme(n, theme);
      }
    }

    const ruleVals = colorRules.length > 0 ? await fetchRuleColumns() : new Map();
    applyNodeRuleOverrides(colors, ruleVals);
    g.setPointColors(colors);

    // Link colors: when 2+ rules, color each link by its rule; otherwise
    // blend source + target node colors. Then apply manual rule overrides.
    if (topology.edges.length > 0) {
      const linkColors = new Float32Array(topology.edges.length * 4);
      // Cosmos quirk: RGB is 0..255 but alpha is 0..1 for links/points.
      const alpha = rendering?.linkOpacity ?? 0.6;
      const palette = appConfig.colorScales.categorical;
      const ruleLabels = topology.rule_labels ?? [];
      const edgeRules = topology.edge_rules ?? [];
      const useRulePalette =
        ruleLabels.length > 1 && edgeRules.length === topology.edges.length;
      for (let i = 0; i < topology.edges.length; i++) {
        if (useRulePalette) {
          const ridx = edgeRules[i];
          const [r, gC, b] = hexToRgba(palette[ridx % palette.length]);
          linkColors[i * 4] = r;
          linkColors[i * 4 + 1] = gC;
          linkColors[i * 4 + 2] = b;
        } else {
          const [s, t] = topology.edges[i];
          linkColors[i * 4] = (colors[s * 4] + colors[t * 4]) / 2;
          linkColors[i * 4 + 1] = (colors[s * 4 + 1] + colors[t * 4 + 1]) / 2;
          linkColors[i * 4 + 2] = (colors[s * 4 + 2] + colors[t * 4 + 2]) / 2;
        }
        linkColors[i * 4 + 3] = alpha;
      }
      applyLinkRuleOverrides(linkColors, ruleVals);
      g.setLinkColors(linkColors);
    }

    g.render();
  }

  // ── Right-click drag area selection ──────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 2) return;
    if (!hostRef.current) return;
    const rect = hostRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDrag({ x0: x, y0: y, x1: x, y1: y });
    dragStartedRef.current = true;
    e.preventDefault();
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragStartedRef.current || !drag || !hostRef.current) return;
    const rect = hostRef.current.getBoundingClientRect();
    setDrag({ ...drag, x1: e.clientX - rect.left, y1: e.clientY - rect.top });
  }
  function onMouseUp(e: React.MouseEvent) {
    if (e.button !== 2 || !dragStartedRef.current) return;
    dragStartedRef.current = false;
    if (!drag || !graphRef.current) {
      setDrag(null);
      return;
    }
    const left = Math.min(drag.x0, drag.x1);
    const right = Math.max(drag.x0, drag.x1);
    const top = Math.min(drag.y0, drag.y1);
    const bottom = Math.max(drag.y0, drag.y1);
    setDrag(null);
    if (right - left < 4 && bottom - top < 4) return;
    const indices = graphRef.current.getPointsInRect([
      [left, top],
      [right, bottom],
    ]);
    const ids = Array.from(indices, (v) => Number(v));
    setSelection(ids);
    inspect(null);
    graphRef.current.selectPointsByIndices(ids);
    e.preventDefault();
  }

  const overlay = drag && (
    <div
      style={{
        position: "absolute",
        left: Math.min(drag.x0, drag.x1),
        top: Math.min(drag.y0, drag.y1),
        width: Math.abs(drag.x1 - drag.x0),
        height: Math.abs(drag.y1 - drag.y0),
        border: `1.5px dashed ${theme?.accent ?? "#39bae6"}`,
        background: `${theme?.accent ?? "#39bae6"}22`,
        pointerEvents: "none",
      }}
    />
  );

  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={hostRef} style={{ width: "100%", height: "100%" }} />
      {overlay}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          fontSize: 11,
          opacity: 0.55,
          color: theme?.text ?? "#fff",
          pointerEvents: "none",
          background: theme?.panel ? `${theme.panel}cc` : "#0008",
          padding: "3px 8px",
          borderRadius: 6,
        }}
      >
        Click: select 1 · Right-drag: select area · ⏸ pause to freeze
      </div>
      <button
        onClick={() => graphRef.current?.fitView(400, 0.12)}
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          fontSize: 11,
          padding: "5px 12px",
          background: theme?.panel ? `${theme.panel}ee` : "#0008",
          color: theme?.text ?? "#fff",
          border: `1px solid ${theme?.border ?? "#2a2f3a"}`,
          borderRadius: 6,
          cursor: "pointer",
        }}
        title="Re-center the view on all nodes"
      >
        ⊕ Center view
      </button>
      {topology && (topology.rule_labels?.length ?? 0) > 1 && appConfig && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: theme?.panel ? `${theme.panel}ee` : "#0008",
            border: `1px solid ${theme?.border ?? "#2a2f3a"}`,
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 11,
            color: theme?.text ?? "#fff",
            maxWidth: 220,
          }}
        >
          <div style={{ opacity: 0.6, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10 }}>
            Edge rules
          </div>
          {topology.rule_labels!.map((label, i) => {
            const palette = appConfig.colorScales.categorical;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, lineHeight: 1.6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: palette[i % palette.length],
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {!topology && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: theme?.text ?? "#5a6275",
            opacity: 0.5,
            pointerEvents: "none",
          }}
        >
          Build a graph in the left panel to visualize.
        </div>
      )}
    </div>
  );
}
