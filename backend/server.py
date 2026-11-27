"""Aster pipeline API: image inference -> rigging service -> custom VRM0 exporter.

Services are deliberately separated. Configure real endpoints; never masquerade a GLB
as VRM. Each downstream adapter accepts/returns JSON with base64 model payloads.
"""
from __future__ import annotations
import os, uuid, base64, threading, tempfile, time
from pathlib import Path
from typing import Any
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI(title="Aster Image-to-VRM API", version="0.3.0")
allowed = [x.strip() for x in os.getenv("ASTER_ALLOWED_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed, allow_methods=["GET", "POST"], allow_headers=["*"])
JOBS: dict[str, dict[str, Any]] = {}
OUT = Path(os.getenv("ASTER_OUTPUT_DIR", "./outputs")).resolve()
OUT.mkdir(parents=True, exist_ok=True)
MAX_BYTES = 20 * 1024 * 1024
HUNYUAN_URL = os.getenv("HUNYUAN3D_API_URL", "").strip()
RIG_URL = os.getenv("ASTER_RIGGING_API_URL", "").strip()
EXPORT_URL = os.getenv("ASTER_VRM0_EXPORT_API_URL", "").strip()
TIMEOUT = int(os.getenv("ASTER_PIPELINE_TIMEOUT", "1800"))

def glb_ok(data: bytes) -> bool:
    return len(data) > 12 and data[:4] == b"glTF"

def vrm_ok(data: bytes) -> bool:
    # VRM 0.x is a GLB container, but must have a VRM extension in JSON chunk.
    if not glb_ok(data): return False
    try:
        length = int.from_bytes(data[12:16], "little")
        chunk = data[20:20+length]
        return b'"VRM"' in chunk or b'VRM' in chunk
    except Exception: return False

def call_json_adapter(url: str, payload: dict, timeout: int) -> dict:
    if not url: raise RuntimeError("Adapter endpoint is not configured.")
    r=requests.post(url, json=payload, timeout=timeout)
    r.raise_for_status()
    result=r.json()
    if not isinstance(result,dict): raise RuntimeError("Adapter response must be a JSON object.")
    return result

def run_job(job_id: str, image_data: bytes):
    job=JOBS[job_id]
    try:
        if not HUNYUAN_URL: raise RuntimeError("GPU inference is not configured: set HUNYUAN3D_API_URL.")
        job.update(status="image_to_mesh",progress=10,stage="Image-to-3D")
        upstream=requests.post(HUNYUAN_URL,json={"image":base64.b64encode(image_data).decode(),"texture":True,"type":"glb"},timeout=TIMEOUT)
        upstream.raise_for_status()
        glb=upstream.content
        if not glb_ok(glb): raise RuntimeError("Inference service response is not a valid GLB.")
        mesh_path=OUT/f"{job_id}-source.glb"; mesh_path.write_bytes(glb)
        job["source_glb_path"]=str(mesh_path)
        job.update(status="rigging",progress=45,stage="Humanoid rigging")
        if not RIG_URL: raise RuntimeError("Auto-rigging adapter is not configured (ASTER_RIGGING_API_URL). Original GLB retained.")
        rig=call_json_adapter(RIG_URL,{"model_glb_base64":base64.b64encode(glb).decode(),"profile":"anime_humanoid","format":"glb"},TIMEOUT)
        rig_b64=rig.get("model_glb_base64")
        if not rig_b64: raise RuntimeError("Rigging adapter returned no model_glb_base64.")
        rigged=base64.b64decode(rig_b64)
        if not glb_ok(rigged): raise RuntimeError("Rigging adapter output is not valid GLB.")
        rig_path=OUT/f"{job_id}-rigged.glb"; rig_path.write_bytes(rigged)
        job["rigged_glb_path"]=str(rig_path)
        job.update(status="vrm_export",progress=75,stage="VRM 0.x export")
        if not EXPORT_URL: raise RuntimeError("Custom VRM 0.x exporter is not configured (ASTER_VRM0_EXPORT_API_URL). Rigged GLB retained.")
        exp=call_json_adapter(EXPORT_URL,{"model_glb_base64":base64.b64encode(rigged).decode(),"target":"VRM0","metadata":{"name":"Aster Character","version":"1.0"}},TIMEOUT)
        vrm_b64=exp.get("vrm_base64")
        if not vrm_b64: raise RuntimeError("VRM exporter returned no vrm_base64.")
        vrm=base64.b64decode(vrm_b64)
        if not vrm_ok(vrm): raise RuntimeError("Export output failed GLB-container/VRM-extension checks.")
        vrm_path=OUT/f"{job_id}.vrm"; vrm_path.write_bytes(vrm)
        job.update(status="complete",progress=100,stage="Complete",assets={"vrm":f"/api/jobs/{job_id}/vrm"},vrm_path=str(vrm_path))
    except Exception as exc:
        job.update(status="failed",stage=job.get("stage","pipeline"),errorCode="pipeline_stage_failed",error=str(exc))

@app.get("/health")
def health():
    return {"status":"ok","services":{"hunyuan3d":bool(HUNYUAN_URL),"rigging":bool(RIG_URL),"vrm0_export":bool(EXPORT_URL)},"pipeline":"image-to-mesh -> rig -> custom VRM0"}

@app.post("/api/image-to-3d/jobs")
async def create_job(mode: str = Form(...), prompt: str | None = Form(None), image: UploadFile | None = File(None)):
    if mode != "image": raise HTTPException(501,"Text-to-3D is not supported by this image pipeline.")
    if image is None: raise HTTPException(400,"image is required")
    if image.content_type not in ("image/png","image/jpeg","image/webp"): raise HTTPException(400,"unsupported image type")
    data=await image.read(MAX_BYTES+1)
    if len(data)>MAX_BYTES: raise HTTPException(413,"image exceeds 20 MB limit")
    if not data: raise HTTPException(400,"empty image")
    job_id=str(uuid.uuid4()); JOBS[job_id]={"jobId":job_id,"status":"queued","progress":0,"stage":"Queued","created":time.time()}
    threading.Thread(target=run_job,args=(job_id,data),daemon=True).start()
    return {"jobId":job_id,"status":"queued"}

@app.get("/api/jobs/{job_id}")
def get_job(job_id:str):
    job=JOBS.get(job_id)
    if not job: raise HTTPException(404,"job not found")
    return {k:v for k,v in job.items() if not k.endswith("_path")}

@app.get("/api/jobs/{job_id}/assets")
def get_assets(job_id:str):
    job=JOBS.get(job_id)
    if not job: raise HTTPException(404,"job not found")
    if job.get("status")!="complete": raise HTTPException(409,"VRM 0.x export not complete.")
    return job.get("assets",{})

@app.get("/api/jobs/{job_id}/vrm")
def download_vrm(job_id:str):
    job=JOBS.get(job_id)
    if not job: raise HTTPException(404,"job not found")
    path=job.get("vrm_path")
    if job.get("status")!="complete" or not path or not Path(path).exists(): raise HTTPException(409,"VRM export not ready")
    return FileResponse(path,media_type="model/gltf-binary",filename=f"Aster-{job_id}.vrm")

@app.get("/api/jobs/{job_id}/mesh")
def download_mesh(job_id:str):
    job=JOBS.get(job_id)
    if not job: raise HTTPException(404,"job not found")
    path=job.get("source_glb_path")
    if not path or not Path(path).exists(): raise HTTPException(409,"generated mesh not ready")
    return FileResponse(path,media_type="model/gltf-binary",filename=f"Aster-{job_id}-source.glb")
