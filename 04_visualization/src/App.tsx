import { useEffect, useState } from "react";
import { useAppStore } from "./state/appStore";
import { getAppConfig } from "./api/client";
import ImportView from "./views/ImportView";
import WorkspaceView from "./views/WorkspaceView";
import HealthBadge from "./components/HealthBadge";

export default function App() {
  const dataset = useAppStore((s) => s.dataset);
  const appConfig = useAppStore((s) => s.appConfig);
  const themeName = useAppStore((s) => s.themeName);
  const loadAppConfig = useAppStore((s) => s.loadAppConfig);
  const [tab, setTab] = useState<"import" | "workspace">("import");
  const [cfgError, setCfgError] = useState<string | null>(null);

  useEffect(() => {
    getAppConfig()
      .then(loadAppConfig)
      .catch((e) => setCfgError(String(e)));
  }, [loadAppConfig]);

  if (dataset && tab === "import") setTab("workspace");

  const theme = appConfig ? appConfig.themes[themeName] : null;
  const bg = theme?.background ?? "#0f1115";
  const text = theme?.text ?? "#e6e6e6";
  const border = theme?.border ?? "#2a2f3a";
  const panel = theme?.panel ?? "#14191f";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: bg, color: text }}>
      <header
        style={{
          padding: "8px 16px",
          borderBottom: `1px solid ${border}`,
          background: panel,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <strong style={{ fontSize: 16 }}>EDA Web App</strong>
        <nav style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setTab("import")} disabled={tab === "import"}>
            Import
          </button>
          <button onClick={() => setTab("workspace")} disabled={tab === "workspace" || !dataset}>
            Workspace
          </button>
        </nav>
        {dataset && (
          <span style={{ opacity: 0.7, fontSize: 12 }}>
            {dataset.origin} · {dataset.n_rows.toLocaleString()} rows × {dataset.n_cols} cols
          </span>
        )}
        {cfgError && (
          <span style={{ fontSize: 12, color: "#ff6b6b" }}>config: {cfgError}</span>
        )}
        <div style={{ marginLeft: "auto" }}>
          <HealthBadge />
        </div>
      </header>
      <main style={{ flex: 1, minHeight: 0 }}>
        {!appConfig ? (
          <div style={{ padding: 24, opacity: 0.6 }}>Loading config…</div>
        ) : tab === "import" ? (
          <ImportView />
        ) : (
          <WorkspaceView />
        )}
      </main>
    </div>
  );
}
