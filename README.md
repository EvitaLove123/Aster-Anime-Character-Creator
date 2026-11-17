# Aster Anime Character Creator

Android-first browser-based 3D anime character creator. The project creates **new characters only** and targets **VRM 0.x only**.

## Locked architecture

- Full 3D studio viewport with touch orbit, zoom, pan, and camera presets.
- Female base character first.
- Procedural modular mesh parts, kept as independently inspectable/skinned meshes.
- Starter humanoid skeleton and per-vertex skin indices/weights.
- Custom VRM 0.x exporter planned; **no UniVRM**.
- No model import pipeline and no AI image-to-character reconstruction.
- Light UI and browser-side processing, designed for Android Chrome.

## Phase 0 — 3D Studio

Implemented:
- Three.js WebGL renderer.
- OrbitControls for touch/mouse orbit, zoom, and pan.
- Front, three-quarter, side, and back camera presets.
- Studio lighting, floor, and grid.
- Responsive Android layout and WebGL context-loss notice.

## Phase 1 — Female Base Character

Implemented prototype:
- Original procedural female base built from separate mesh modules.
- Separate head, face details, hair pieces, torso, pelvis, arms, hands, fingers, legs, feet, and outfit meshes.
- Starter humanoid bone hierarchy using VRM-style bone names.
- SkinnedMesh binding with per-vertex skinIndex and skinWeight attributes.
- Modular part visibility controls and basic material color controls.
- Skeleton visualization toggle.

## Not implemented yet

This is a Phase 0–1 foundation, not a finished character creator or VRM exporter. The current mesh library is procedural starter geometry, not production-quality anime topology. It still needs refined topology, smooth joint deformation, full humanoid mapping, facial morph targets, hair/clothing asset libraries, physics, and the custom VRM 0.x exporter. The VRM action is intentionally disabled.

## Run

Open the GitHub Pages site in a modern browser with WebGL enabled. Three.js is loaded from jsDelivr, so the first load requires an internet connection.

## Development

The app is a static site. No build step is required. Main source: `src/main.js`.


## Phase 1.1 — Body Customization prototype

Implemented on the feature branch:
- Adult-base anatomy controls for chest volume, waist width, hip width, thigh volume, and shoulder width.
- Procedural vertex deformation on the existing modular torso, pelvis, skirt, and upper-leg meshes.
- Procedural skin texture preview with surface-detail intensity, freckles toggle, and soft-shading toggle.
- All controls run locally in the browser; no character model or texture is uploaded.

Limitations:
- These are broad proportion controls, not sculpt-grade anatomy or a Koikatsu-equivalent texture library.
- The generated texture is a procedural preview, not a hand-painted high-resolution body atlas.
- Texture import, layer painting, region masks, detailed anatomy morph targets, clothing refitting, and VRM 0.x export remain future work.
