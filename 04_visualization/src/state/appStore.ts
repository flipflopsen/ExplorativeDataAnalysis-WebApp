import { create } from "zustand";
import type { DatasetInfo, GraphInfo, GraphTopology } from "../api/types";
import type { ForceConfig, GraphAppConfig, RenderConfig, Theme } from "../api/config";

interface AppState {
  dataset: DatasetInfo | null;
  graph: GraphInfo | null;
  topology: GraphTopology | null;

  selection: Set<number>;
  inspectedNode: number | null;
  groups: { name: string; color: string; ids: number[] }[];

  appConfig: GraphAppConfig | null;
  forces: ForceConfig | null;
  rendering: RenderConfig | null;
  themeName: string;

  colorBy: string | null;
  paused: boolean;
  colorRules: ColorRule[];
  viewMode: "2d" | "3d";
  forces3d: Force3DConfig;

  setDataset: (d: DatasetInfo | null) => void;
  setGraph: (g: GraphInfo | null, t: GraphTopology | null) => void;
  setSelection: (ids: Iterable<number>) => void;
  clearSelection: () => void;
  inspect: (id: number | null) => void;
  addGroup: (name: string, color: string) => void;
  removeGroup: (name: string) => void;

  loadAppConfig: (cfg: GraphAppConfig) => void;
  patchForces: (patch: Partial<ForceConfig>) => void;
  resetForces: () => void;
  patchRendering: (patch: Partial<RenderConfig>) => void;
  setTheme: (name: string) => void;
  setColorBy: (col: string | null) => void;
  setPaused: (p: boolean) => void;
  addColorRule: (rule: ColorRule) => void;
  updateColorRule: (idx: number, patch: Partial<ColorRule>) => void;
  removeColorRule: (idx: number) => void;
  clearColorRules: () => void;
  setViewMode: (m: "2d" | "3d") => void;
  patchForces3d: (patch: Partial<Force3DConfig>) => void;
  resetForces3d: () => void;
}

export interface Force3DConfig {
  charge: number;
  linkDistance: number;
  linkStrength: number;
  velocityDecay: number;
  alphaDecay: number;
}

export const DEFAULT_FORCES_3D: Force3DConfig = {
  charge: -120,
  linkDistance: 30,
  linkStrength: 1,
  velocityDecay: 0.4,
  alphaDecay: 0.0228,
};

export interface ColorRule {
  target: "node" | "link";
  column: string;
  value: string;
  color: string;
}

export const useAppStore = create<AppState>((set, get) => ({
  dataset: null,
  graph: null,
  topology: null,
  selection: new Set<number>(),
  inspectedNode: null,
  groups: [],

  appConfig: null,
  forces: null,
  rendering: null,
  themeName: "ayu-dark",

  colorBy: null,
  paused: false,
  colorRules: [],
  viewMode: "2d",
  forces3d: { ...DEFAULT_FORCES_3D },

  setDataset: (d) =>
    set({
      dataset: d,
      graph: null,
      topology: null,
      selection: new Set(),
      inspectedNode: null,
      colorBy: null,
    }),
  setGraph: (g, t) => set({ graph: g, topology: t, selection: new Set(), inspectedNode: null }),
  setSelection: (ids) => set({ selection: new Set(ids) }),
  clearSelection: () => set({ selection: new Set(), inspectedNode: null }),
  inspect: (id) => set({ inspectedNode: id }),
  addGroup: (name, color) => {
    const ids = Array.from(get().selection);
    if (ids.length === 0) return;
    set({ groups: [...get().groups, { name, color, ids }] });
  },
  removeGroup: (name) => {
    set({ groups: get().groups.filter((g) => g.name !== name) });
  },

  loadAppConfig: (cfg) =>
    set({
      appConfig: cfg,
      forces: { ...cfg.forces },
      rendering: { ...cfg.rendering },
      themeName: cfg.defaultTheme,
    }),
  patchForces: (patch) => {
    const f = get().forces;
    if (!f) return;
    set({ forces: { ...f, ...patch } });
  },
  resetForces: () => {
    const cfg = get().appConfig;
    if (!cfg) return;
    set({ forces: { ...cfg.forces } });
  },
  patchRendering: (patch) => {
    const r = get().rendering;
    if (!r) return;
    set({ rendering: { ...r, ...patch } });
  },
  setTheme: (name) => set({ themeName: name }),
  setColorBy: (col) => set({ colorBy: col }),
  setPaused: (p) => set({ paused: p }),
  addColorRule: (rule) => set({ colorRules: [...get().colorRules, rule] }),
  updateColorRule: (idx, patch) =>
    set({
      colorRules: get().colorRules.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }),
  removeColorRule: (idx) =>
    set({ colorRules: get().colorRules.filter((_, i) => i !== idx) }),
  clearColorRules: () => set({ colorRules: [] }),
  setViewMode: (m) => set({ viewMode: m }),
  patchForces3d: (patch) => set({ forces3d: { ...get().forces3d, ...patch } }),
  resetForces3d: () => set({ forces3d: { ...DEFAULT_FORCES_3D } }),
}));

export function currentTheme(): Theme | null {
  const s = useAppStore.getState();
  if (!s.appConfig) return null;
  return s.appConfig.themes[s.themeName] ?? Object.values(s.appConfig.themes)[0] ?? null;
}
