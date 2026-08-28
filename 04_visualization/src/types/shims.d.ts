declare module "plotly.js-dist-min" {
  // Re-export types from the full plotly.js package types if present.
  export type Data = unknown;
  export type Layout = Record<string, unknown>;
  export type Config = Record<string, unknown>;
  const Plotly: unknown;
  export default Plotly;
}
