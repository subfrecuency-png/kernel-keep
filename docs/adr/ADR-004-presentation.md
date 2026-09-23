# ADR-004: 2.5D Canvas presentation for the slice

- **Status:** Accepted for the slice; reconsider in Milestone F.
- **Options:** a stylized 3D elevated camera (three.js or Godot 3D) vs a lighter 2.5D (top-down with extruded buildings).
- **Decision:** 2.5D on Canvas 2D. Buildings are drawn as extruded blocks with a glyph on top. Units use shape-coded silhouettes with ownership rings. The fog overlay is one scaled image. Glow comes from bright lines on a dark lattice, not bloom.
- **Why:** it's readable at RTS zoom levels and cheap on modest hardware. There's no GPU in the build environment, so a 3D path couldn't be verified here. Measured: 60 fps with 132 units in software-rendered headless Chromium (container). Research agrees that emissive colours on dark backgrounds carry the neon look better than heavy bloom (RESEARCH #31–33).
- **Upgrade path:** move to PixiJS/WebGL if draw counts grow, or to three.js/Godot for real 3D using Blender→glTF assets with emissive materials and instancing.
