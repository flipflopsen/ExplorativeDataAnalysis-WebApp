import { useAppStore } from "../state/appStore";
import { Button, Card, Label, Select } from "../ui/primitives";
import ColorRulesPanel from "./ColorRulesPanel";

export default function ThemePanel() {
  const appConfig = useAppStore((s) => s.appConfig);
  const themeName = useAppStore((s) => s.themeName);
  const setTheme = useAppStore((s) => s.setTheme);
  const dataset = useAppStore((s) => s.dataset);
  const colorBy = useAppStore((s) => s.colorBy);
  const setColorBy = useAppStore((s) => s.setColorBy);
  const rendering = useAppStore((s) => s.rendering);
  const patchRendering = useAppStore((s) => s.patchRendering);
  const groups = useAppStore((s) => s.groups);

  if (!appConfig) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Card padded title="Theme">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {Object.entries(appConfig.themes).map(([key, t]) => (
            <Button
              key={key}
              onClick={() => setTheme(key)}
              variant={key === themeName ? "primary" : "outline"}
              style={{ justifyContent: "flex-start", padding: "6px 8px" }}
            >
              <span style={{ display: "flex", gap: 2 }}>
                <span style={{ width: 10, height: 10, background: t.node, borderRadius: 2 }} />
                <span style={{ width: 10, height: 10, background: t.accent, borderRadius: 2 }} />
                <span style={{ width: 10, height: 10, background: t.link, borderRadius: 2 }} />
              </span>
              <span style={{ fontSize: 11 }}>{t.label}</span>
            </Button>
          ))}
        </div>
      </Card>

      <Card padded title="Color nodes by">
        <Select
          value={colorBy ?? ""}
          onChange={(e) => setColorBy(e.target.value || null)}
          disabled={!dataset}
        >
          <option value="">(rainbow default)</option>
          <option value="__group__" disabled={groups.length === 0}>
            ▸ Saved groups {groups.length > 0 ? `(${groups.length})` : "— none yet"}
          </option>
          <optgroup label="By column">
            {dataset?.columns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} · {c.dtype}
              </option>
            ))}
          </optgroup>
        </Select>
      </Card>

      <Card padded title="Manual color rules">
        <ColorRulesPanel />
      </Card>

      {rendering && (
        <Card padded title="Rendering">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div>
              <Label>Point size: {rendering.pointDefaultSize.toFixed(1)}</Label>
              <input
                type="range"
                min={1}
                max={20}
                step={0.5}
                value={rendering.pointDefaultSize}
                onChange={(e) => patchRendering({ pointDefaultSize: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <Label>Link width: {rendering.linkDefaultWidth.toFixed(1)}</Label>
              <input
                type="range"
                min={0.1}
                max={5}
                step={0.1}
                value={rendering.linkDefaultWidth}
                onChange={(e) => patchRendering({ linkDefaultWidth: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <Label>Link opacity: {rendering.linkOpacity.toFixed(2)}</Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={rendering.linkOpacity}
                onChange={(e) => patchRendering({ linkOpacity: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>
            <label style={{ fontSize: 11, display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={rendering.curvedLinks}
                onChange={(e) => patchRendering({ curvedLinks: e.target.checked })}
              />
              Curved links
            </label>
          </div>
        </Card>
      )}
    </div>
  );
}
