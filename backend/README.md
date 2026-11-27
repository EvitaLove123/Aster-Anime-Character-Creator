# Aster GPU Backend — Hunyuan3D 2.1

English backend scaffold with a real API proxy to an externally hosted Hunyuan3D 2.1 server. It does not bundle model weights or provision a GPU.

## Run this API
Install Python 3.10+, then:
```bash
pip install -r requirements.txt
export HUNYUAN3D_API_URL=http://YOUR_GPU_HOST:8081/generate
uvicorn server:app --host 0.0.0.0 --port 7860
```
The upstream endpoint should follow Tencent's Hunyuan3D API server contract (`POST /generate`, JSON image base64, output GLB). The API server must be started with the official Hunyuan3D-2.1 repository and its model weights on a compatible GPU.

## Current pipeline status
1. Image upload + validation — implemented here.
2. Hunyuan3D shape/texture generation — proxy implemented, requires configured running upstream.
3. GLB artifact storage — implemented.
4. Humanoid auto-rig — NOT implemented.
5. VRM 0.x metadata, humanoid bone mapping, skin weights, expressions, spring bones and custom exporter — NOT implemented.

Completed generation currently reports `rigging_required` and makes the GLB available at `GET /api/jobs/{jobId}/mesh`. It intentionally will not label an unrigged mesh as VRM.

## Reference
Official upstream: https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1
See the project docs for a roadmap to humanoid rigging and VRM 0.x packaging.
