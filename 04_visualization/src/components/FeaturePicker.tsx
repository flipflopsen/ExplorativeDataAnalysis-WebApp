import { useAppStore } from "../state/appStore";

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
}

export default function FeaturePicker({ value, onChange }: Props) {
  const dataset = useAppStore((s) => s.dataset)!;
  const cols = dataset.columns;

  function toggle(name: string) {
    if (value.includes(name)) onChange(value.filter((v) => v !== name));
    else onChange([...value, name]);
  }

  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Features ({value.length})</div>
      <div
        style={{
          maxHeight: 180,
          overflow: "auto",
          border: "1px solid #2a2f3a",
          padding: 6,
          fontSize: 12,
        }}
      >
        {cols.map((c) => (
          <label key={c.name} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={value.includes(c.name)}
              onChange={() => toggle(c.name)}
            />
            <span style={{ flex: 1 }}>{c.name}</span>
            <span style={{ opacity: 0.5 }}>{c.dtype}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
