# Hunyuan3D 2.1 Image-to-3D Integration Plan

## Selected engine
**Hunyuan3D 2.1** is the first image-conditioned shape/texture generation engine to evaluate for Aster. It is not an anime-avatar rigging system and does not produce a VRM 0.x avatar by itself.

## Target user flow
1. Upload one anime illustration (initially PNG/JPEG/WebP).
2. Submit it to a private inference service.
3. Generate a shape mesh; optionally run texture painting.
4. Inspect the generated asset in a browser 3D viewer.
5. Auto-rig to a humanoid skeleton (separate service/stage).
6. Validate skeleton, skinning and coordinate conventions.
7. Package only as VRM 0.x using Aster's own exporter (not UniVRM).

## Integration boundary
GitHub Pages is static hosting and cannot run the Hunyuan3D model weights. A GPU backend is required. It must:
- keep credentials server-side (never commit secrets or put them in browser code);
- enforce upload size/type limits and job quotas;
- expose job creation, status polling, and result retrieval;
- return generated mesh/texture assets as temporary downloadable files;
- report errors rather than fabricate a model or success status.

## Suggested service endpoints
- `POST /api/image-to-3d/jobs`: multipart image upload, returns `jobId`.
- `GET /api/jobs/{jobId}`: returns status (`queued|shape|texture|rigging|complete|failed`) and progress.
- `GET /api/jobs/{jobId}/assets`: returns temporary mesh/texture asset references only when ready.

These are proposed endpoints, not implemented or deployed yet.

## Model stages
- Shape generation: Hunyuan3D 2.1 shape pipeline.
- Texture: optional Hunyuan3D paint pipeline.
- Rigging: independent humanoid auto-rigging stage; must be evaluated and integrated.
- VRM 0.x: custom exporter and validator; not yet implemented.

## Compute
Inference requires a GPU host and downloaded model weights. Resource requirements, license terms, hosting cost and performance must be checked against the official Hunyuan3D repository and model cards before deployment. The static frontend must not claim the model is running until backend inference is tested.

## Compatibility gate
Do not enable VRM download until a real export is validated in target applications. The generated mesh alone is not a VRM avatar.

## Current implementation status
This document is architecture and implementation planning. No Hunyuan3D inference service, rigging service or VRM 0.x export has been deployed by this commit.
