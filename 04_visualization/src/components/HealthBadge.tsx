import { useQuery } from "@tanstack/react-query";
import { health } from "../api/client";

export default function HealthBadge() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: health,
    refetchInterval: 15_000,
  });

  if (isLoading) return <span style={{ fontSize: 12, opacity: 0.6 }}>…</span>;
  if (error || !data)
    return <span style={{ fontSize: 12, color: "#ff6b6b" }}>backend offline</span>;

  const color = data.gpu ? "#5cd97a" : "#ffd166";
  return (
    <span style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
      {data.backend} {data.gpu ? "(GPU)" : "(CPU)"} · v{data.version}
    </span>
  );
}
