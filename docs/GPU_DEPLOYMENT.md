# GPU Deployment — Aster Anime Character Creator

## Current truth
The GitHub Pages frontend and proxy backend are code scaffolds. This repository does not itself provision a GPU, launch Hunyuan3D weights, or host an inference endpoint. You need a GPU host (RunPod, a compatible cloud GPU VM, or your own server) and must deploy the upstream Tencent Hunyuan3D-2.1 runtime there.

## Deployment topology
- GitHub Pages: UI only.
- Aster API container: image upload, job state, and artifact handoff.
- Hunyuan3D 2.1 upstream: separate GPU inference service; must expose a compatible image-to-GLB API.
- Future rigging worker and custom VRM 0.x exporter: separate pipeline stages; not implemented yet.

## Aster API container
Build in the backend directory:

```bash
docker build -t aster-api .
```

Run it with a persistent output folder and the upstream API address:

```bash
docker run --rm -p 7860:7860 -v aster-output:/data/outputs \\
  -e HUNYUAN3D_API_URL=http://HOST_OR_SERVICE:8081/generate \\
  -e ASTER_ALLOWED_ORIGINS=https://evitalove123.github.io \\
  aster-api
```

Replace the upstream URL with the address and route actually exposed by the GPU service. Confirm the upstream contract and test its response before connecting it; the proxy currently expects the response body itself to be a GLB binary. The upstream is not included in this Docker image.

## Host deployment checklist
1. Provision a GPU host with enough VRAM for the chosen Hunyuan3D 2.1 model/configuration.
2. Install and run the official Tencent Hunyuan3D-2.1 repository using its supported environment and weights.
3. Expose its API only to the Aster backend (prefer private networking); do not expose a raw model endpoint publicly without authentication/rate limits.
4. Test a direct upstream request and confirm the returned bytes are a valid GLB.
5. Deploy this API container on the same host or private network. Set `HUNYUAN3D_API_URL`.
6. HTTPS-protect the Aster API, add authentication and upload/job limits before public use. The current scaffold is not production-secure: jobs are in-memory and there is no auth, quota, or cleanup worker.
7. Configure the frontend `ASTER_API_BASE` to the HTTPS URL of this backend, then test on mobile.

## CORS and frontend
The frontend currently contains an empty `ASTER_API_BASE` constant. After backend deployment, update it to the backend HTTPS origin. Do not put GPU provider tokens or secrets in GitHub Pages.

## Upstream
https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1
