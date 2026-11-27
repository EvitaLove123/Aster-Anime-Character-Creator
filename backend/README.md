# Aster GPU Backend (Hunyuan3D 2.1)

This is a backend scaffold for the browser UI. It is not an inference implementation and does not include model weights.

## Run

- Python 3.10+
- Install `requirements.txt`
- `uvicorn server:app --host 0.0.0.0 --port 7860`

The server exposes the job contract used by the website. Until a licensed/compatible Hunyuan3D 2.1 inference adapter and GPU environment are installed, generation requests return an explicit `adapter_not_configured` failure rather than a fake model.

## API

- `POST /api/image-to-3d/jobs` multipart: `mode` (`image` or `text`), `image` or `prompt`
- `GET /api/jobs/{jobId}`
- `GET /api/jobs/{jobId}/assets`

The current frontend sends image mode or prompt mode. Model inference, texture generation, humanoid rigging, and VRM 0.x packaging must be connected as separate stages. See `docs/HUNYUAN3D_IMAGE_TO_VRM0_PIPELINE.md`.

Keep this backend private or protect it with authentication and quotas before exposing it publicly. Do not store API keys in GitHub Pages.
