# AI Image/Text-to-VRM pipeline

## Product goal

Add an in-app AI character generation workflow inspired by Tripo:
- Text prompt -> 3D character
- Reference image -> 3D character
- Preview and inspect the generated model
- Check and create a biped humanoid rig
- Convert the result into a validated VRM 0.x file using Aster's own exporter

This is a pipeline target, not a claim that the current prototype already exports VRM.

## Proposed pipeline

1. The Android-friendly web UI collects a prompt or a PNG/JPEG/WebP reference image.
2. A secure server-side API proxy calls Tripo API v3. The Tripo API key must be stored as a server environment variable (TRIPO_API_KEY), never in index.html, browser storage, or Git.
3. Tripo creates a model asynchronously. The app polls the task endpoint and downloads the GLB promptly because Tripo model URLs are temporary.
4. The app submits the generated task to rig-check. Continue only when the result is riggable and reports a biped rig.
5. Request Tripo Auto Rig, then retrieve the rigged model.
6. Aster imports the rigged GLB, maps and validates the humanoid skeleton, checks skin weights and materials, and prepares VRM 0.x metadata.
7. Aster's custom VRM 0.x exporter writes the VRM file. It must not use UniVRM or fabricate UniGLTF/UniVRM metadata.

## Important technical boundary

Tripo's documented model conversion formats include GLTF, FBX, USDZ, OBJ, STL and 3MF; VRM is not listed as a direct export format. Therefore Aster must perform the VRM packaging and validation itself. A GLB download is only an intermediate asset, not a VRM file.

## Android-first UX

- Keep the existing light theme and touch-friendly layout.
- Offer two clear modes: Text to VRM and Image to VRM.
- Show generation/rigging progress and actionable errors.
- Preview the generated 3D asset before export.
- Do not require users to edit JSON or expose API keys.
- Keep model processing client-side where practical; use the server only as a secure Tripo API proxy.

## Compatibility and validation

A successful Tripo generation or rigging task does not guarantee a valid VRM. Before enabling Download VRM 0.x, Aster must validate:
- humanoid bone mapping and required bones
- skeleton hierarchy and bind pose
- skinning and mesh/material references
- VRM 0.x metadata and material properties
- expression/blendshape bindings where present
- secondary bone groups and colliders where present

Test exported files in VRM Posing Mobile, Virtual Droid, and Napharmonia. Compatibility must be reported per app; do not claim support before testing.

## Required secrets and deployment

- TRIPO_API_KEY: server-side environment variable only.
- The current GitHub Pages static site cannot safely hold this secret or directly provide a private API proxy.
- Deploy the proxy as a serverless backend (for example, a Vercel Function) and configure the frontend with its public API base URL.
- Do not commit credentials, generated private models, or user-uploaded reference images.
