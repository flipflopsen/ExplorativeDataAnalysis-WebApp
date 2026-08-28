import { useState } from "react";
import { importCsvFile, importJsonFile, importSql, testSql } from "../api/client";
import { useAppStore } from "../state/appStore";

type Source = "csv" | "json" | "sql";

export default function ImportView() {
  const setDataset = useAppStore((s) => s.setDataset);
  const [source, setSource] = useState<Source>("csv");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SQL state
  const [sqlUrl, setSqlUrl] = useState("sqlite:///01_data/databases/project_data.db");
  const [sqlTable, setSqlTable] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");

  // JSON state
  const [jsonLines, setJsonLines] = useState(false);
  const [jsonRecordPath, setJsonRecordPath] = useState("");

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const info =
        source === "csv"
          ? await importCsvFile(file)
          : await importJsonFile(file, {
              lines: jsonLines,
              recordPath: jsonRecordPath || undefined,
            });
      setDataset(info);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSql() {
    setBusy(true);
    setError(null);
    try {
      const info = await importSql(sqlUrl, sqlTable || undefined, sqlQuery || undefined);
      setDataset(info);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 780, margin: "0 auto" }}>
      <h2>Import data</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["csv", "json", "sql"] as const).map((s) => (
          <button key={s} onClick={() => setSource(s)} disabled={source === s}>
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {source === "csv" && (
        <div>
          <p style={{ opacity: 0.7 }}>Upload a CSV file. Header row expected.</p>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {source === "json" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ opacity: 0.7 }}>
            Upload a JSON file (record array, single object, or NDJSON).
          </p>
          <label>
            <input
              type="checkbox"
              checked={jsonLines}
              onChange={(e) => setJsonLines(e.target.checked)}
            />{" "}
            JSON Lines (one record per line)
          </label>
          <label>
            Record path (optional, dotted, e.g. <code>data.items</code>):
            <input
              type="text"
              value={jsonRecordPath}
              onChange={(e) => setJsonRecordPath(e.target.value)}
              placeholder="leave blank for top-level array"
              style={{ width: "100%" }}
            />
          </label>
          <input
            type="file"
            accept=".json,.ndjson,.jsonl,application/json"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {source === "sql" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label>
            SQLAlchemy URL
            <input
              type="text"
              value={sqlUrl}
              onChange={(e) => setSqlUrl(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            Table (or use query below)
            <input
              type="text"
              value={sqlTable}
              onChange={(e) => setSqlTable(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            Query (overrides table)
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              rows={3}
              style={{ width: "100%" }}
            />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={busy || !sqlUrl}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await testSql(sqlUrl);
                  alert("Connection OK");
                } catch (e) {
                  setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Test connection
            </button>
            <button disabled={busy || !sqlUrl || (!sqlTable && !sqlQuery)} onClick={handleSql}>
              Load
            </button>
          </div>
        </div>
      )}

      {busy && <p>Loading…</p>}
      {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}
    </div>
  );
}
