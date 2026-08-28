// Color helpers: hex → RGBA Float32 (0..1 for d3/cosmos arrays of [0..255]).
// Cosmos uses Uint8 0..255 in [r,g,b,a].

import type { Theme } from "../api/config";

export function hexToRgba(hex: string, alpha = 255): [number, number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return [r, g, b, alpha];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function interpolatePalette(palette: string[], t: number): [number, number, number] {
  const n = palette.length - 1;
  const idx = Math.max(0, Math.min(n, t * n));
  const i = Math.floor(idx);
  const f = idx - i;
  const c1 = hexToRgba(palette[i]);
  const c2 = hexToRgba(palette[Math.min(n, i + 1)]);
  return [Math.round(lerp(c1[0], c2[0], f)), Math.round(lerp(c1[1], c2[1], f)), Math.round(lerp(c1[2], c2[2], f))];
}

/** Encode RGBA per node into a flat Float32Array consumed by cosmos.setPointColors. */
export function pointColorsFromTheme(n: number, theme: Theme, alpha = 1): Float32Array {
  const [r, g, b] = hexToRgba(theme.node);
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = alpha;
  }
  return out;
}

/** Encode RGBA from numeric column normalized to [0,1] over a palette. */
export function pointColorsFromNumeric(
  values: (number | string | boolean | null)[],
  palette: string[],
  alpha = 1,
): Float32Array {
  const nums: number[] = values.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : NaN));
  let min = Infinity;
  let max = -Infinity;
  for (const v of nums) if (Number.isFinite(v)) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  const out = new Float32Array(nums.length * 4);
  for (let i = 0; i < nums.length; i++) {
    const v = nums[i];
    const t = Number.isFinite(v) ? (v - min) / span : 0.5;
    const [r, g, b] = interpolatePalette(palette, t);
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = alpha;
  }
  return out;
}

/** Encode RGBA by mapping each unique category to a palette slot. */
export function pointColorsFromCategorical(
  values: (number | string | boolean | null)[],
  palette: string[],
  alpha = 1,
): Float32Array {
  const map = new Map<string, number>();
  const out = new Float32Array(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    const key = values[i] == null ? "∅" : String(values[i]);
    if (!map.has(key)) map.set(key, map.size);
    const idx = map.get(key)! % palette.length;
    const [r, g, b] = hexToRgba(palette[idx]);
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = alpha;
  }
  return out;
}
