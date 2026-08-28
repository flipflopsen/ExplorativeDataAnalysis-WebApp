// Detect real GPU-backed WebGL so the 3D view can be gated to GPU machines.
// Returns false on software renderers (SwiftShader / llvmpipe) or no WebGL2.

let cached: boolean | null = null;

export function hasGpuWebGL(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ||
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) {
      cached = false;
      return cached;
    }
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)).toLowerCase()
      : "";
    // Heuristic: flag known software renderers as non-GPU.
    const software = ["swiftshader", "llvmpipe", "software", "microsoft basic"].some((s) =>
      renderer.includes(s),
    );
    cached = !software;
    return cached;
  } catch {
    cached = false;
    return cached;
  }
}
