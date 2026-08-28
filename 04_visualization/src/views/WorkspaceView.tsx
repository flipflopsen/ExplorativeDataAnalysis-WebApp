import { useState } from "react";
import { useAppStore } from "../state/appStore";
import EdgeBuilder from "../components/EdgeBuilder";
import GraphCanvas from "../components/GraphCanvas";
import GraphCanvas3D from "../components/GraphCanvas3D";
import DiagramPanel from "../components/DiagramPanel";
import ForcePanel from "../components/ForcePanel";
import Force3DPanel from "../components/Force3DPanel";
import ThemePanel from "../components/ThemePanel";
import NodeInspector from "../components/NodeInspector";
import { hasGpuWebGL } from "../lib/gpu";
import { Segmented } from "../ui/primitives";

export default function WorkspaceView() {
  const dataset = useAppStore((s) => s.dataset);
  const graph = useAppStore((s) => s.graph);
  const appConfig = useAppStore((s) => s.appConfig);
  const themeName = useAppStore((s) => s.themeName);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const theme = appConfig ? appConfig.themes[themeName] : null;

  const gpuOk = hasGpuWebGL();

  const [showBuilder, setShowBuilder] = useState(true);
  const [leftTab, setLeftTab] = useState<"graph" | "forces" | "theme">("graph");

  if (!dataset) return <div style={{ padding: 24 }}>No dataset loaded.</div>;

  const panelBg = theme?.panel ?? "#14191f";
  const border = theme?.border ?? "#2a2f3a";
  const text = theme?.text ?? "#e6e6e6";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr 380px",
        height: "100%",
        color: text,
      }}
    >
      {/* LEFT: tabbed graph / forces / theme */}
      <aside
        style={{
          borderRight: `1px solid ${border}`,
          background: panelBg,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <TabBar
          tabs={[
            { id: "graph", label: "Graph" },
            { id: "forces", label: "Forces" },
            { id: "theme", label: "Theme" },
          ]}
          active={leftTab}
          onChange={(id) => setLeftTab(id as typeof leftTab)}
          theme={theme}
        />
        <div style={{ padding: 12, overflow: "auto", flex: 1 }}>
          {leftTab === "graph" &&
            (showBuilder || !graph ? (
              <EdgeBuilder onBuilt={() => setShowBuilder(false)} />
            ) : (
              <div>
                <p style={{ fontSize: 13, opacity: 0.85 }}>
                  {graph.n_nodes.toLocaleString()} nodes · {graph.n_edges.toLocaleString()} edges
                  <br />
                  layout: <code>{graph.suggested_layout}</code>
                </p>
                <button onClick={() => setShowBuilder(true)}>Rebuild graph…</button>
              </div>
            ))}
          {leftTab === "forces" && (viewMode === "3d" && gpuOk ? <Force3DPanel /> : <ForcePanel />)}
          {leftTab === "theme" && <ThemePanel />}
        </div>
      </aside>

      {/* CENTER: graph canvas */}
      <section style={{ position: "relative", minWidth: 0, background: theme?.background ?? "#0f1115" }}>
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Segmented
            options={[
              { value: "2d", label: "2D" },
              { value: "3d", label: gpuOk ? "3D (GPU)" : "3D ⚠" },
            ]}
            value={viewMode}
            onChange={(m) => {
              if (m === "3d" && !gpuOk) return;
              setViewMode(m);
            }}
          />
          {!gpuOk && viewMode === "2d" && (
            <span style={{ fontSize: 10, opacity: 0.6, color: theme?.text }}>
              3D requires a GPU
            </span>
          )}
        </div>
        {viewMode === "3d" && gpuOk ? <GraphCanvas3D /> : <GraphCanvas />}
      </section>

      {/* RIGHT: Inspector (top) + Diagrams (bottom), each its own scrollable region */}
      <aside
        style={{
          borderLeft: `1px solid ${border}`,
          background: panelBg,
          display: "grid",
          gridTemplateRows: "minmax(180px, 38%) 6px 1fr",
          minHeight: 0,
        }}
      >
        <div style={{ overflow: "auto", padding: 12 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
              opacity: 0.6,
              marginBottom: 6,
            }}
          >
            Inspector
          </div>
          <NodeInspector />
        </div>
        <div style={{ background: border, opacity: 0.6 }} />
        <div style={{ overflow: "auto", padding: 12 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
              opacity: 0.6,
              marginBottom: 6,
            }}
          >
            Diagrams
          </div>
          <DiagramPanel />
        </div>
      </aside>
    </div>
  );
}

function TabBar({
  tabs,
  active,
  onChange,
  theme,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  theme: { accent: string; border: string; text: string } | null;
}) {
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${theme?.border ?? "#2a2f3a"}` }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1,
            padding: "6px 8px",
            fontSize: 12,
            background: "transparent",
            color: theme?.text ?? "#e6e6e6",
            border: "none",
            borderBottom: `2px solid ${active === t.id ? theme?.accent ?? "#39bae6" : "transparent"}`,
            cursor: "pointer",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
