# AI Image/Text-to-VRM pipeline

## Product goal

The user experience must be simple:
1. Choose **Text to 3D** or **Image to 3D**.
2. Enter a prompt or select an OC image.
3. Tap **Generate** and preview the 3D character.
4. Tap **Export VRM 0.x** after the model passes validation.

The user must not be asked to create API keys, edit JSON, configure environment variables, or paste credentials into the app.

## Product architecture

- Keep the Android-first GitHub Pages frontend as the user-facing app.
- The frontend talks to one managed generation service. Provider credentials stay on that service and are never exposed to the browser, local storage, repository, or user.
- The service can use a 3D generation provider such as Tripo behind the scenes, but the frontend should not be tightly coupled to a provider-specific API.
- The service handles generation tasks, progress polling, temporary model downloads, rig-check, and biped auto-rig.
- Aster imports the rigged model, maps and validates the humanoid skeleton, then uses Aster's own custom VRM 0.x exporter.
- The user sees one Generate flow, not provider setup screens.

## Important operational constraint

Removing API setup from the user's experience does not make AI generation infrastructure-free. A hosted service still needs a provider account, private credentials, compute/credits, rate limits, and ongoing hosting. Those are service-owner responsibilities, not settings the user should have to manage. Do not claim that generation is live until a managed service is actually deployed and tested.

If no managed service is available yet, show the feature as **Coming soon** or clearly disabled. Do not present a fake Generate button or a mock result as real AI generation.

## 3D-to-VRM boundary

Tripo's documented model conversion formats include GLTF, FBX, USDZ, OBJ, STL and 3MF; VRM is not listed as a direct export format. A generated GLB is only an intermediate model. Aster must implement its own VRM 0.x packaging and validation.

No UniVRM. Do not fabricate UniGLTF/UniVRM metadata or claim compatibility without testing.

## Android-first UX

- Keep the existing light theme and touch-friendly layout.
- Two simple modes: **Text to 3D** and **Image to 3D**.
- Show generation and rigging progress with clear error messages.
- Preview the generated model before export.
- Never ask the user to enter provider credentials.
- Keep model processing client-side where practical; use the managed service only for tasks that require hosted AI generation.

## Export validation

A successful generation or rigging task does not guarantee a valid VRM. Before enabling Download VRM 0.x, validate:
- required humanoid bone mapping and skeleton hierarchy
- bind pose and skin weights
- mesh and material references
- VRM 0.x metadata and material properties
- expression/blendshape bindings where present
- secondary bone groups and colliders where present

Test exports in VRM Posing Mobile, Virtual Droid, and Napharmonia. Report compatibility per app; do not claim support before testing.

## Current status

This document describes the target architecture. The frontend now includes a first AI workflow UI prototype: Text to 3D / Image to 3D mode switching, prompt entry, local image selection and preview, and basic input validation. The Generate action does not call an AI service and explicitly reports that generation is unavailable. The project still has no live managed AI generation service, production character rigging, or working VRM 0.x exporter. Keep those limitations visible until each feature is implemented and verified.
