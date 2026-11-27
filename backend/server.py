"""Aster GPU backend: Hunyuan3D 2.1 API proxy + VRM pipeline boundary.

Configure HUNYUAN3D_API_URL to an actual Hunyuan3D 2.1 server endpoint
(e.g. http://host:8081/generate). This server can produce GLB, but deliberately
does not claim humanoid rigging or VRM 0.x packaging until those adapters exist.
"""
from __future__ import annotations
import os, uuid, base64, threading, tempfile
from pathlib import Path
from typing import Any
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI(title="Aster GPU API", version="0.2.0")
allowed = [x.strip() for x in os.getenv("ASTER_ALLOWED_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed, allow_methods=["GET", "POST"], allow_headers=["*"])
JOBS: dict[str, dict[str, Any]] = {}
OUT = Path(os.getenv("ASTER_OUTPUT_DIR", "./outputs")).resolve()
OUT.mkdir(parents=True, exist_ok=True)
MAX_BYTES = 20 * 1024 * 1024
HUNYUAN_URL = os.getenv("HUNYUAN3D_API_URL", "").strip()

@app.get("/health")
def health():
    return {"status": "ok", "hunyuan3d_configured": bool(HUNYUAN_URL), "vrm_pipeline": "not_configured"}

def run_image_job(job_id: str, data: bytes):
    job = JOBS[job_id]
    if not HUNYUAN_URL:
        job.update(status="failed", errorCode="hunyuan_not_configured", error="Set HUNYUAN3D_API_URL to a running Hunyuan3D 2.1 server.")
        return
    try:
        job.update(status="shape", progress=10)
        payload = {"image": base64.b64encode(data).decode("ascii"), "texture": True, "type": "glb"}
        response = requests.post(HUNYUAN_URL, json=payload, timeout=900)
        response.raise_for_status()
        if not response.content: raise RuntimeError("Hunyuan3D returned an empty model")
        glb = OUT / f"{job_id}.glb"
        glb.write_bytes(response.content)
        job.update(status="rigging_required", progress=100, glb_path=str(glb),
                   errorCode="humanoid_rigging_adapter_missing",
                   error="Shape generation finished and GLB was saved. Humanoid rigging and VRM 0.x packaging are not connected yet.")
    except Exception as exc:
        job.update(status="failed", errorCode="inference_failed", error=str(exc))

@app.post("/api/image-to-3d/jobs")
async def create_job(mode: str = Form(...), prompt: str | None = Form(None), image: UploadFile | None = File(None)):
    if mode != "image":
        raise HTTPException(501, "Text-to-3D is not implemented by the current Hunyuan3D image-conditioned adapter.")
    if image is None: raise HTTPException(400, "image is required")
    if image.content_type not in ("image/png", "image/jpeg", "image/webp"): raise HTTPException(400, "unsupported image type")
    data = await image.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES: raise HTTPException(413, "image exceeds 20 MB limit")
    if not data: raise HTTPException(400, "empty image")
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {"jobId": job_id, "status": "queued", "progress": 0}
    threading.Thread(target=run_image_job, args=(job_id, data), daemon=True).start()
    return {"jobId": job_id, "status": "queued"}

@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    if job_id not in JOBS: raise HTTPException(404, "job not found")
    job = JOBS[job_id]
    # Expose a safe result summary, not server paths.
    return {k:v for k,v in job.items() if k != "glb_path"}

@app.get("/api/jobs/{job_id}/assets")
def get_assets(job_id: str):
    if job_id not in JOBS: raise HTTPException(404, "job not found")
    job = JOBS[job_id]
    if job.get("status") != "complete": raise HTTPException(409, "VRM 0.x is not available; humanoid rigging/export is pending.")
    return job.get("assets", {})

@app.get("/api/jobs/{job_id}/mesh")
def download_generated_mesh(job_id: str):
    job=JOBS.get(job_id)
    if not job: raise HTTPException(404, "job not found")
    path=job.get("glb_path")
    if not path or not Path(path).exists(): raise HTTPException(409, "generated mesh not ready")
    return FileResponse(path, media_type="model/gltf-binary", filename=f"Aster-{job_id}.glb")
