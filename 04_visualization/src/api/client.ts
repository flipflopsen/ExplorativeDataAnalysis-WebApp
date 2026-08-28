// Thin typed REST client for the EDA backend.
import type {
  ChartSuggestion,
  DatasetInfo,
  GraphInfo,
  GraphSpec,
  GraphTopology,
  VizAggregateRequest,
} from "./types";
import type { GraphAppConfig } from "./config";

const BASE = "/api";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function health(): Promise<{ status: string; backend: string; gpu: boolean; version: string }> {
  return jsonOrThrow(await fetch(`${BASE}/health`));
}

export async function importCsvFile(file: File, delimiter = ","): Promise<DatasetInfo> {
  const fd = new FormData();
  fd.append("file", file);
  // delimiter/has_header come from default ImportCsvRequest server-side
  void delimiter;
  return jsonOrThrow(await fetch(`${BASE}/import/csv`, { method: "POST", body: fd }));
}

export async function importJsonFile(file: File, opts: { lines?: boolean; recordPath?: string } = {}): Promise<DatasetInfo> {
  const fd = new FormData();
  fd.append("file", file);
  if (opts.lines) fd.append("lines", "true");
  if (opts.recordPath) fd.append("record_path", opts.recordPath);
  return jsonOrThrow(await fetch(`${BASE}/import/json`, { method: "POST", body: fd }));
}

export async function importSql(url: string, table?: string, query?: string): Promise<DatasetInfo> {
  return jsonOrThrow(
    await fetch(`${BASE}/import/sql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, table: table || null, query: query || null }),
    }),
  );
}

export async function testSql(url: string): Promise<{ ok: boolean }> {
  return jsonOrThrow(
    await fetch(`${BASE}/import/sql/test`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }),
  );
}

export async function listDatasets(): Promise<DatasetInfo[]> {
  return jsonOrThrow(await fetch(`${BASE}/datasets`));
}

export async function getDataset(id: string): Promise<DatasetInfo> {
  return jsonOrThrow(await fetch(`${BASE}/datasets/${id}`));
}

export async function buildGraph(spec: GraphSpec): Promise<GraphInfo> {
  return jsonOrThrow(
    await fetch(`${BASE}/graph/build`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(spec),
    }),
  );
}

export async function getTopology(graphId: string): Promise<GraphTopology> {
  return jsonOrThrow(await fetch(`${BASE}/graph/${graphId}/topology`));
}

export async function aggregateViz(req: VizAggregateRequest): Promise<Record<string, unknown>> {
  return jsonOrThrow(
    await fetch(`${BASE}/viz/aggregate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    }),
  );
}

export async function suggestCharts(datasetId: string, features: string[]): Promise<ChartSuggestion[]> {
  const q = new URLSearchParams({ dataset_id: datasetId, features: features.join(",") });
  return jsonOrThrow(await fetch(`${BASE}/viz/suggest?${q.toString()}`));
}

export async function getAppConfig(): Promise<GraphAppConfig> {
  return jsonOrThrow(await fetch(`${BASE}/config`));
}

export interface RowResponse {
  index: number;
  values: Record<string, unknown>;
}

export async function getRow(datasetId: string, idx: number): Promise<RowResponse> {
  return jsonOrThrow(await fetch(`${BASE}/datasets/${datasetId}/row/${idx}`));
}

export interface ColumnResponse {
  column: string;
  n: number;
  is_numeric: boolean;
  values: (number | string | boolean | null)[];
}

export async function getColumn(datasetId: string, col: string): Promise<ColumnResponse> {
  return jsonOrThrow(await fetch(`${BASE}/datasets/${datasetId}/column/${encodeURIComponent(col)}`));
}

export interface ColumnStat {
  column: string;
  kind: "numeric" | "categorical";
  n: number;
  n_null: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  n_unique?: number;
  top?: { value: string; count: number }[];
}

export interface StatsResponse {
  n_rows: number;
  columns: ColumnStat[];
}

export async function getStats(
  datasetId: string,
  nodeIds: number[] | null,
  columns?: string[],
): Promise<StatsResponse> {
  return jsonOrThrow(
    await fetch(`${BASE}/stats`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataset_id: datasetId, node_ids: nodeIds, columns: columns ?? null }),
    }),
  );
}
