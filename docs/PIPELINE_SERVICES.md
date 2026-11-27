# Aster Image-to-VRM pipeline services

## Stage orchestration
The API now orchestrates 3 separately deployable services: Hunyuan image-conditioned mesh generation, a humanoid rigging adapter, and a custom VRM 0.x exporter adapter. The original mesh and rigged intermediate are retained when later stages fail. A VRM download is only enabled after a binary/container sanity check.

## Adapter contracts
### Inference
Configured via `HUNYUAN3D_API_URL`. Existing endpoint contract: POST JSON `{image: base64, texture: true, type: "glb"}`; returns GLB binary.

### Rigging
Configured via `ASTER_RIGGING_API_URL`. POST JSON:
```json
{"model_glb_base64":"...","profile":"anime_humanoid","format":"glb"}
```
Expected JSON response: `{"model_glb_base64":"..."}`. Service must fit/validate a humanoid skeleton and skin weights, return a valid skinned GLB, and fail rather than attach a guessed rig to non-humanoid topology. This adapter is not yet bundled with a rigging model.

### Custom VRM 0.x exporter
Configured via `ASTER_VRM0_EXPORT_API_URL`. POST JSON:
```json
{"model_glb_base64":"...","target":"VRM0","metadata":{"name":"Aster Character","version":"1.0"}}
```
Expected JSON: `{"vrm_base64":"..."}`. Exporter must write the VRM 0.x extension into a valid GLB container and include humanoid mapping, first-person/look-at settings, blendshape groups, material settings, and optional springbone data when present. This exporter is an external adapter contract until its implementation and parser/app validation are completed. UniVRM is not used.

## Deploy
1. Deploy a GPU inference server running Hunyuan3D 2.1 and configure its endpoint.
2. Deploy a rigging service implementing the contract above.
3. Deploy the custom VRM 0.x writer/validator implementing the exporter contract.
4. Build and deploy this FastAPI API container, setting endpoint variables.
5. Set the frontend API base URL to this API and test an image end-to-end.

`backend/docker-compose.yml` is a starting deployment configuration. It does not itself provision a GPU or download model weights. Production deployment requires auth, rate limiting, isolated GPU services, quotas, file retention controls, and TLS.
