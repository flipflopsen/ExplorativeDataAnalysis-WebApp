// Shared types matching backend Pydantic models.

export type DType = "int" | "float" | "bool" | "string" | "datetime" | "category" | "other";

export interface ColumnInfo {
  name: string;
  dtype: DType;
  n_unique: number | null;
  n_null: number | null;
  sample: unknown[] | null;
}

export interface DatasetInfo {
  dataset_id: string;
  source: "csv" | "json" | "sql";
  origin: string;
  n_rows: number;
  n_cols: number;
  columns: ColumnInfo[];
}

export type EdgeRuleKind = "shared_key" | "knn" | "similarity" | "explicit";

export interface EdgeRule {
  kind: EdgeRuleKind;
  key_column?: string;
  max_pairs_per_group?: number;
  feature_columns?: string[];
  k?: number;
  threshold?: number;
  metric?: "cosine" | "jaccard";
  edge_dataset_id?: string;
  src_column?: string;
  dst_column?: string;
  weight_column?: string;
}

export interface GraphSpec {
  dataset_id: string;
  rules: EdgeRule[];
  max_nodes?: number;
}

export interface GraphInfo {
  graph_id: string;
  dataset_id: string;
  n_nodes: number;
  n_edges: number;
  suggested_layout: "client_force" | "server_force_atlas2" | "spring";
}

export interface GraphTopology {
  nodes: number[];
  edges: [number, number, number][];
  edge_rules?: number[];
  rule_labels?: string[];
}

export type ChartKind =
  | "histogram"
  | "scatter"
  | "hexbin"
  | "heatmap"
  | "parallel"
  | "box"
  | "corr"
  | "map";

export interface ChartSuggestion {
  kind: ChartKind;
  features: string[];
  score: number;
  reason: string;
}

export interface VizAggregateRequest {
  dataset_id: string;
  node_ids?: number[] | null;
  features: string[];
  kind: ChartKind;
  bins?: number;
}
