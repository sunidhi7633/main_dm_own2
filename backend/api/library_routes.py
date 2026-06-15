import os
import sys
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
import boto3
from PIL import Image
import io

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth import get_current_user, CurrentUser
from auth.roles import ROLES
from mongo import db

router = APIRouter()

BUCKET  = os.getenv("S3_BUCKET_NAME", "harshwal-dm-library")
region  = os.getenv("AWS_REGION", "ap-south-1")

_aws_key = os.getenv("AWS_ACCESS_KEY_ID", "")
s3 = None
if _aws_key and "your_" not in _aws_key:
    s3 = boto3.client("s3", region_name=region)

# Local fallback storage — used when S3 is not configured
UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


def check_permission(user: CurrentUser, required_permission: str):
    if user.role == "admin":
        return True
    user_perms = ROLES.get(user.role, {}).get("permissions", [])
    if "*" in user_perms or required_permission in user_perms:
        return True
    raise HTTPException(status_code=403, detail=f"Permission denied: {required_permission} required")


def _save_local(path: str, data: bytes) -> str:
    """Save bytes to local uploads dir, return a URL that can be served back."""
    full_path = os.path.join(UPLOADS_DIR, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(data)
    return f"{BACKEND_URL}/api/library/files/{path}"


def _upload(s3_key: str, data: bytes, content_type: str) -> str:
    """Upload to S3 if configured, otherwise save to local disk."""
    if s3:
        s3.put_object(
            Bucket=BUCKET,
            Key=s3_key,
            Body=data,
            ContentType=content_type,
        )
        return f"https://{BUCKET}.s3.amazonaws.com/{s3_key}"
    return _save_local(s3_key, data)


@router.get("/api/library/files/{file_path:path}")
async def serve_local_file(file_path: str):
    """Serve locally stored assets when S3 is not configured."""
    full_path = os.path.realpath(os.path.join(UPLOADS_DIR, file_path))
    # Prevent path traversal
    if not full_path.startswith(os.path.realpath(UPLOADS_DIR)):
        raise HTTPException(403, "Access denied")
    if not os.path.exists(full_path):
        raise HTTPException(404, "File not found")
    return FileResponse(full_path)


@router.post("/api/library/upload")
async def upload_asset(
    files: list[UploadFile] = File(...),
    brand: str = Form(...),
    file_type: str = Form(...),
    tags: str = Form(""),
    current_user: CurrentUser = Depends(get_current_user),
):
    check_permission(current_user, "library:write")

    results = []
    for file in files:
        content = await file.read()
        file_id = str(uuid.uuid4())
        ext     = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
        s3_key  = f"{brand}/{file_type}/{file_id}.{ext}"
        mime    = file.content_type or "application/octet-stream"

        thumbnail_url = None
        if mime.startswith("image/"):
            try:
                img = Image.open(io.BytesIO(content))
                img.thumbnail((320, 320))
                buf = io.BytesIO()
                img.save(buf, format="WEBP", quality=85)
                thumb_key     = f"thumbs/{file_id}.webp"
                thumbnail_url = _upload(thumb_key, buf.getvalue(), "image/webp")
            except Exception as e:
                print(f"Thumbnail error: {e}")

        file_url = _upload(s3_key, content, mime)

        doc = {
            "file_id":         file_id,
            "filename":        s3_key,
            "original_name":   file.filename,
            "file_type":       file_type,
            "brand":           brand,
            "tags":            [t.strip() for t in tags.split(",") if t.strip()],
            "size_bytes":      len(content),
            "mime_type":       mime,
            "storage_path":    s3_key,
            "file_url":        file_url,
            "uploaded_by":     current_user.id,
            "uploaded_at":     datetime.utcnow().isoformat(),
            "approved_for_use": True,
            "thumbnail_url":   thumbnail_url,
            "is_deleted":      False,
            "used_in_posts":   [],
        }

        db.dm_library.insert_one(doc)
        results.append({"file_id": file_id, "url": file_url})

    return {"uploaded": len(results), "files": results}


@router.get("/api/library/assets")
async def list_assets(
    brand: str = None,
    file_type: str = None,
    search: str = None,
    page: int = 1,
    per_page: int = 40,
    current_user: CurrentUser = Depends(get_current_user),
):
    check_permission(current_user, "library:read")

    query = {"is_deleted": False}
    if brand:
        query["brand"] = brand
    if file_type:
        query["file_type"] = file_type
    if search:
        query["$or"] = [
            {"original_name": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search.lower()]}},
        ]

    total  = db.dm_library.count_documents(query)
    assets = list(
        db.dm_library.find(query, {"_id": 0})
        .sort("uploaded_at", -1)
        .skip((page - 1) * per_page)
        .limit(per_page)
    )

    return {"total": total, "page": page, "assets": assets}


@router.delete("/api/library/assets/{file_id}")
async def delete_asset(file_id: str, current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "library:delete")

    db.dm_library.update_one(
        {"file_id": file_id},
        {"$set": {"is_deleted": True, "deleted_by": current_user.id, "deleted_at": datetime.utcnow().isoformat()}},
    )
    return {"status": "deleted"}
