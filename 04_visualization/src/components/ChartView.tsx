import Plot from "react-plotly.js";

// Local lightweight types — plotly.js-dist-min ships no .d.ts.
type Data = Record<string, unknown>;
type Layout = Record<string, unknown>;

interface Props {
  data: Record<string, unknown>;
}

const LAYOUT_BASE: Partial<Layout> = {
  paper_bgcolor: "#0f1115",
  plot_bgcolor: "#0f1115",
  font: { color: "#cfd2d8", size: 11 },
  margin: { l: 40, r: 10, t: 30, b: 40 },
  autosize: true,
};

export default function ChartView({ data }: Props) {
  const kind = data.kind as string;
  const traces = buildTraces(kind, data);
  const layout = buildLayout(kind, data);
  return (
    <Plot
      data={traces}
      layout={{ ...LAYOUT_BASE, ...layout }}
      useResizeHandler
      style={{ width: "100%", height: "100%" }}
      config={{ displaylogo: false, responsive: true }}
    />
  );
}

function buildTraces(kind: string, d: Record<string, unknown>): Data[] {
  if (kind === "histogram") {
    const edges = d.bin_edges as number[];
    const counts = d.counts as number[];
    const centers = edges.slice(0, -1).map((e, i) => (e + edges[i + 1]) / 2);
    return [{ type: "bar", x: centers, y: counts, marker: { color: "#7aa8ff" } } as Data];
  }
  if (kind === "scatter") {
    const trace: Data = {
      type: "scattergl",
      mode: "markers",
      x: d.x as number[],
      y: d.y as number[],
      marker: { size: 4, color: "#7aa8ff", opacity: 0.7 },
    };
    if (Array.isArray(d.color)) {
      (trace.marker as Record<string, unknown>).color = d.color;
    }
    return [trace];
  }
  if (kind === "hexbin" || kind === "heatmap") {
    return [
      {
        type: "heatmap",
        x: d.x_edges as number[],
        y: d.y_edges as number[],
        z: d.counts as number[][],
        colorscale: "Viridis",
        transpose: true,
      } as Data,
    ];
  }
  if (kind === "corr") {
    return [
      {
        type: "heatmap",
        x: d.labels as string[],
        y: d.labels as string[],
        z: d.matrix as number[][],
        colorscale: "RdBu",
        zmin: -1,
        zmax: 1,
      } as Data,
    ];
  }
  if (kind === "box") {
    const series = d.series as { feature: string; values: number[] }[];
    return series.map((s) => ({ type: "box", y: s.values, name: s.feature } as Data));
  }
  if (kind === "parallel") {
    const features = d.features as string[];
    const rows = d.rows as number[][];
    const dims = features.map((f, i) => ({
      label: f,
      values: rows.map((r) => r[i]),
    }));
    return [{ type: "parcoords", dimensions: dims, line: { color: "#7aa8ff" } } as Data];
  }
  if (kind === "map") {
    return [
      {
        type: "scattergl",
        mode: "markers",
        x: d.lon as number[],
        y: d.lat as number[],
        marker: { size: 4, color: "#7aa8ff", opacity: 0.7 },
      } as Data,
    ];
  }
  return [];
}

function buildLayout(kind: string, d: Record<string, unknown>): Partial<Layout> {
  if (kind === "histogram")
    return { title: { text: `Histogram of ${d.feature as string}`, font: { size: 13 } } };
  if (kind === "scatter")
    return {
      xaxis: { title: { text: d.x_label as string } },
      yaxis: { title: { text: d.y_label as string } },
    };
  if (kind === "hexbin" || kind === "heatmap")
    return {
      xaxis: { title: { text: d.x_label as string } },
      yaxis: { title: { text: d.y_label as string } },
    };
  if (kind === "map")
    return {
      xaxis: { title: { text: "lon" } },
      yaxis: { title: { text: "lat" }, scaleanchor: "x" as const },
    };
  return {};
}
