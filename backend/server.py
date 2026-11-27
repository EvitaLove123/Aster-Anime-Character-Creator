"""Aster Image-to-3D backend API scaffold.

This intentionally does not fake inference. Connect an actual Hunyuan3D
inference worker and VRM 0.x packager before enabling production use.
"""
from __future__ import annotations
import os, uuid
from typing import Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Aster GPU API", version="0.1.0")
allowed = [x.strip() for x in os.getenv("ASTER_ALLOWED_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed, allow_methods=["GET", "POST"], allow_headers=["*"])
JOBS: dict[str, dict[str, Any]] = {}
MAX_BYTES = 20 * 1024 * 1024

@app.get("/health")
def health():
    return {"status": "ok", "inference_adapter": "not_configured"}

@app.post("/api/image-to-3d/jobs")
async def create_job(mode: str = Form(...), prompt: str | None = Form(None), image: UploadFile | None = File(None)):
    if mode not in ("image", "text"):
        raise HTTPException(400, "mode must be image or text")
    if mode == "image":
        if image is None: raise HTTPException(400, "image is required")
        if image.content_type not in ("image/png", "image/jpeg", "image/webp"): raise HTTPException(400, "unsupported image type")
        data = await image.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES: raise HTTPException(413, "image exceeds 20 MB limit")
        if not data: raise HTTPException(400, "empty image")
    else:
        if not prompt or not prompt.strip(): raise HTTPException(400, "prompt is required")
        if len(prompt) > 1024: raise HTTPException(400, "prompt exceeds 1024 characters")
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {"jobId": job_id, "status": "failed", "progress": 0, "error": "Hunyuan3D inference adapter is not configured on this server.", "errorCode": "adapter_not_configured"}
    return {"jobId": job_id, "status": "failed", "errorCode": "adapter_not_configured", "message": "Backend API scaffold is online, but model inference is not installed."}

@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    if job_id not in JOBS: raise HTTPException(404, "job not found")
    return JOBS[job_id]

@app.get("/api/jobs/{job_id}/assets")
def get_assets(job_id: str):
    if job_id not in JOBS: raise HTTPException(404, "job not found")
    job = JOBS[job_id]
    if job.get("status") != "complete": raise HTTPException(409, "job has no completed assets")
    return job.get("assets", {})
