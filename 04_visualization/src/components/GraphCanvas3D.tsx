import { useEffect, useMemo, useRef } from "react";
import ForceGraph3D, { type ForceGraph3DInstance } from "3d-force-graph";
import { useAppStore } from "../state/appStore";
import { getColumn } from "../api/client";
interface N3 {
  id: number;
  color: string;
}
interface L3 {
  source: number;
  target: number;
  color: string;
}

const NUMERIC = ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"];

function lerpHex(palette: string[], t: number): string {
  const n = palette.length - 1;
  const idx = Math.max(0, Math.min(n, t * n));
  const i = Math.floor(idx);
  const f = idx - i;
  const c1 = hex(palette[i]);
  const c2 = hex(palette[Math.min(n, i + 1)]);
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * f);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * f);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * f);
  return `rgb(${r},${g},${b})`;
}
function hex(h: string): [number, number, number] {
  let s = h.replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const num = parseInt(s, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export default function GraphCanvas3D() {
  const hostRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph3DInstance | null>(null);

  const topology = useAppStore((s) => s.topology);
  const dataset = useAppStore((s) => s.dataset);
  const appConfig = useAppStore((s) => s.appConfig);
  const themeName = useAppStore((s) => s.themeName);
  const colorBy = useAppStore((s) => s.colorBy);
  const groups = useAppStore((s) => s.groups);
  const rendering = useAppStore((s) => s.rendering);
  const forces3d = useAppStore((s) => s.forces3d);
  const inspect = useAppStore((s) => s.inspect);
  const setSelection = useAppStore((s) => s.setSelection);

  const theme = appConfig ? appConfig.themes[themeName] : null;

  // ── Init once ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hostRef.current || !theme) return;
    const host = hostRef.current;
    const g = new ForceGraph3D(host)
      .backgroundColor(theme.background)
      .showNavInfo(false)
      .nodeRelSize(rendering?.pointDefaultSize ?? 4)
      .nodeOpacity(0.95)
      .linkOpacity(rendering?.linkOpacity ?? 0.5)
      .onNodeClick((node: object) => {
        const id = (node as N3).id;
        setSelection([id]);
        inspect(id);
        // Aim camera at the clicked node.
        const n = node as unknown as { x: number; y: number; z: number };
        const dist = 120;
        const ratio = 1 + dist / Math.hypot(n.x || 1, n.y || 1, n.z || 1);
        graphRef.current?.cameraPosition(
          { x: (n.x || 0) * ratio, y: (n.y || 0) * ratio, z: (n.z || 0) * ratio },
          n as { x: number; y: number; z: number },
          800,
        );
      })
      .onBackgroundClick(() => {
        setSelection([]);
        inspect(null);
      });
    graphRef.current = g;
    return () => {
      g._destructor?.();
      graphRef.current = null;
      host.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resize handling ──────────────────────────────────────────────────────
  useEffect(() => {
    const g = graphRef.current;
    const host = hostRef.current;
    if (!g || !host) return;
    const ro = new ResizeObserver(() => {
      g.width(host.clientWidth);
      g.height(host.clientHeight);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // ── Theme / rendering updates ────────────────────────────────────────────
  useEffect(() => {
    const g = graphRef.current;
    if (!g || !theme) return;
    g.backgroundColor(theme.background);
    if (rendering) {
      g.nodeRelSize(rendering.pointDefaultSize).linkOpacity(rendering.linkOpacity);
    }
  }, [theme, rendering]);

  // ── Force settings ───────────────────────────────────────────────────────
  useEffect(() => {
    const g = graphRef.current;
    if (!g) return;
    g.d3VelocityDecay(forces3d.velocityDecay);
    g.d3AlphaDecay(forces3d.alphaDecay);
    const charge = g.d3Force("charge");
    if (charge) charge.strength(forces3d.charge);
    const link = g.d3Force("link");
    if (link) {
      link.distance(forces3d.linkDistance).strength(forces3d.linkStrength);
    }
    // Re-heat the simulation so changes take visible effect.
    g.d3ReheatSimulation();
  }, [forces3d]);

  const dataKey = useMemo(
    () => `${topology ? topology.nodes.length : 0}:${colorBy}:${themeName}:${groups.length}`,
    [topology, colorBy, themeName, groups],
  );

  // ── Data + colors ────────────────────────────────────────────────────────
  useEffect(() => {
    const g = graphRef.current;
    if (!g || !topology || !appConfig || !theme) return;
    let cancelled = false;

    async function buildData() {
      const n = topology!.nodes.length;
      const palette = appConfig!.colorScales.categorical;
      const nodeColors: string[] = new Array(n).fill(theme!.node);

      const ruleLabels = topology!.rule_labels ?? [];
      const edgeRules = topology!.edge_rules ?? [];
      const useRulePalette =
        ruleLabels.length > 1 && edgeRules.length === topology!.edges.length;

      if (colorBy === "__group__") {
        for (const grp of groups) for (const idx of grp.ids) if (idx < n) nodeColors[idx] = grp.color;
      } else if (colorBy && dataset) {
        try {
          const col = await getColumn(dataset.dataset_id, colorBy);
          if (col.is_numeric) {
            let min = Infinity,
              max = -Infinity;
            for (const v of col.values)
              if (typeof v === "number" && Number.isFinite(v)) {
                if (v < min) min = v;
                if (v > max) max = v;
              }
            const span = max - min || 1;
            for (let i = 0; i < n; i++) {
              const v = col.values[topology!.nodes[i]];
              const t = typeof v === "number" && Number.isFinite(v) ? (v - min) / span : 0.5;
              nodeColors[i] = lerpHex(NUMERIC, t);
            }
          } else {
            const map = new Map<string, number>();
            for (let i = 0; i < n; i++) {
              const v = col.values[topology!.nodes[i]];
              const key = v == null ? "∅" : String(v);
              if (!map.has(key)) map.set(key, map.size);
              nodeColors[i] = palette[map.get(key)! % palette.length];
            }
          }
        } catch {
          /* keep default */
        }
      } else if (useRulePalette) {
        // Dominant incident rule per node.
        const counts: Map<number, number>[] = Array.from({ length: n }, () => new Map());
        for (let i = 0; i < topology!.edges.length; i++) {
          const [s, t] = topology!.edges[i];
          const r = edgeRules[i];
          counts[s].set(r, (counts[s].get(r) ?? 0) + 1);
          counts[t].set(r, (counts[t].get(r) ?? 0) + 1);
        }
        for (let i = 0; i < n; i++) {
          let best = -1,
            bestC = -1;
          for (const [r, c] of counts[i]) if (c > bestC) ((bestC = c), (best = r));
          nodeColors[i] = palette[(best >= 0 ? best : i) % palette.length];
        }
      } else {
        for (let i = 0; i < n; i++) nodeColors[i] = palette[i % palette.length];
      }

      if (cancelled) return;

      const nodes: N3[] = topology!.nodes.map((id, i) => ({ id, color: nodeColors[i] }));
      // node id → array index (nodes are 0..n but topology.nodes may be a subsample)
      const idToIdx = new Map<number, number>();
      topology!.nodes.forEach((id, i) => idToIdx.set(id, i));

      const links: L3[] = topology!.edges.map(([s, t], i) => {
        let color: string;
        if (useRulePalette) {
          color = palette[edgeRules[i] % palette.length];
        } else {
          const si = idToIdx.get(s),
            ti = idToIdx.get(t);
          const c1 = hex(si != null ? nodeColors[si] : theme!.link);
          const c2 = hex(ti != null ? nodeColors[ti] : theme!.link);
          color = `rgb(${(c1[0] + c2[0]) >> 1},${(c1[1] + c2[1]) >> 1},${(c1[2] + c2[2]) >> 1})`;
        }
        return { source: s, target: t, color };
      });

      g!.graphData({ nodes, links })
        .nodeColor((node: object) => (node as N3).color)
        .linkColor((link: object) => (link as L3).color);
      // Frame the scene after the layout warms up.
      setTimeout(() => g!.zoomToFit(600, 40), 600);
    }

    buildData();
    return () => {
      cancelled = true;
    };
  }, [dataKey, dataset, topology, appConfig, theme, colorBy, groups]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={hostRef} style={{ width: "100%", height: "100%" }} />
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
        Drag: orbit · Scroll: zoom · Click node: focus · 3D (GPU)
      </div>
      <button
        onClick={() => graphRef.current?.zoomToFit(600, 40)}
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
        title="Frame all nodes"
      >
        ⊕ Center view
      </button>
    </div>
  );
}
