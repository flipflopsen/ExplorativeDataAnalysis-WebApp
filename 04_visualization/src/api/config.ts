// Force / theme types mirroring graph_config.json.

export interface ForceConfig {
  simulationDecay: number;
  simulationGravity: number;
  simulationCenter: number;
  simulationRepulsion: number;
  simulationRepulsionTheta: number;
  simulationLinkSpring: number;
  simulationLinkDistance: number;
  simulationFriction: number;
  simulationCluster: number;
  simulationRepulsionFromMouse: number;
  spaceSize: number;
}

export interface RenderConfig {
  pointDefaultSize: number;
  linkDefaultWidth: number;
  linkOpacity: number;
  pointOpacity: number;
  renderHoveredPointRing: boolean;
  curvedLinks: boolean;
}

export interface Theme {
  label: string;
  background: string;
  node: string;
  link: string;
  text: string;
  accent: string;
  panel: string;
  border: string;
}

export interface GraphAppConfig {
  forces: ForceConfig;
  rendering: RenderConfig;
  defaultTheme: string;
  themes: Record<string, Theme>;
  colorScales: {
    numeric: string[];
    categorical: string[];
  };
}

export const FORCE_META: {
  key: keyof ForceConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  help: string;
}[] = [
  { key: "simulationRepulsion", label: "Repulsion", min: 0, max: 5, step: 0.05, help: "Node-to-node push (Barnes–Hut)" },
  { key: "simulationLinkSpring", label: "Link spring", min: 0, max: 5, step: 0.05, help: "Edge attraction stiffness" },
  { key: "simulationLinkDistance", label: "Link distance", min: 1, max: 100, step: 1, help: "Resting edge length" },
  { key: "simulationGravity", label: "Gravity", min: 0, max: 2, step: 0.05, help: "Pull toward layout center" },
  { key: "simulationCenter", label: "Center force", min: 0, max: 2, step: 0.05, help: "Recenter the cloud each tick" },
  { key: "simulationFriction", label: "Friction", min: 0.5, max: 1, step: 0.01, help: "Damping — higher = stiller (1 = no decay)" },
  { key: "simulationDecay", label: "Decay (cooldown)", min: 100, max: 20000, step: 100, help: "Higher = slower cooldown" },
  { key: "simulationRepulsionTheta", label: "Repulsion θ", min: 0.3, max: 2, step: 0.05, help: "Barnes–Hut accuracy (lower = more accurate)" },
  { key: "simulationCluster", label: "Cluster force", min: 0, max: 1, step: 0.05, help: "Pull toward per-node cluster anchors" },
  { key: "simulationRepulsionFromMouse", label: "Mouse repulsion", min: 0, max: 5, step: 0.1, help: "Push nodes away from cursor on right-click" },
  { key: "spaceSize", label: "Space size", min: 512, max: 8192, step: 256, help: "Simulation canvas extent" },
];
