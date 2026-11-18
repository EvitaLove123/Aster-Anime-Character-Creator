# Aster Anime Character Creator

Android-first browser-based 3D anime character creator, inspired by the accessible modular workflow of CUSTOM CAST and the deeper customization approach of Koikatsu/VKatsu.

## Current prototype

- Interactive Three.js 3D preview with touch orbit and zoom.
- Basic face, hair, body proportion, outfit color/type, and accessory controls.
- Procedural placeholder character assembled in the browser.
- Save and reload character presets using browser local storage.
- Responsive light UI for Android screens.
- AI generation interface prototype with Text to 3D / Image to 3D modes, prompt input, image selection, and input validation.
- AI prompt/mode draft autosave and restore in browser local storage, with a clear-draft action.

## Project scope

- Create new characters only.
- Target export format: **VRM 0.x only**.
- No PMX, FBX, GLB, or glTF model import workflow.
- AI image/text-to-3D generation is a planned feature, not live yet.
- No UniVRM.

## Not implemented yet

The current prototype is a first interactive preview, not a complete Koikatsu-level creator. It does not yet contain a production modular anime mesh library, humanoid skeleton/skin weights, real blendshape system, physics/secondary animation, or a VRM 0.x exporter. The Export button remains disabled until a real exporter is implemented and validated.

## Run

Open the GitHub Pages site in a modern browser with WebGL enabled. Three.js is currently loaded from jsDelivr, so the first load requires an internet connection.

## Planned development

1. Replace placeholder geometry with a modular, original/licensed anime character asset library.
2. Add consistent humanoid rigging, skinning, and editable morph targets.
3. Add layered clothing, hair parts, accessories, and material controls.
4. Implement and validate a custom VRM 0.x exporter without UniVRM.
5. Test performance and export compatibility on Android browsers and target VRM apps.

## AI Image/Text-to-VRM roadmap

The next major feature is a provider-independent, managed AI generation workflow:
- Text prompt → 3D character
- Reference image → 3D character
- Hosted rig-check + biped auto-rig
- Aster custom VRM 0.x packaging and validation

The app should not ask users to create API keys or configure services. Provider credentials and generation costs must be handled privately by the managed service. A generated GLB is only an intermediate model; Aster must implement its own VRM 0.x exporter. The AI generator interface is now present, but its Generate action is intentionally marked as unavailable until a managed generation service is deployed. It does not create a 3D model yet. The VRM exporter is also not implemented.

See [AI to VRM pipeline](docs/AI_TO_VRM_PIPELINE.md) for the architecture, validation requirements, and current limitations.
