import os
import sys
from fastapi import APIRouter, Depends, HTTPException, Body
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth import get_current_user, CurrentUser
from auth.roles import ROLES
from mongo import db
from bson import ObjectId
import celery_config
from notifications.whatsapp import notify_designer_visual_queue

router = APIRouter()

def check_permission(user: CurrentUser, required_permission: str):
    if user.role == "admin":
        return True
    user_perms = ROLES.get(user.role, {}).get("permissions", [])
    if "*" in user_perms or required_permission in user_perms:
        return True
    raise HTTPException(status_code=403, detail=f"Permission denied: {required_permission} required")

class ApproveRequest(BaseModel):
    scheduled_at: Optional[str] = None

class RejectRequest(BaseModel):
    reason: str

class EditRequest(BaseModel):
    content_body: str

class DesignerApproveRequest(BaseModel):
    action: str
    asset_url: Optional[str] = None

@router.get("/api/review/queue")
def get_review_queue(current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "review:read")
    
    items = list(db.content_library.find({"status": "pending_review"}).sort("scheduled_at", 1))
    
    # Also fetch designer_pending for Blue Arrow if requested, but queue should mostly be pending_review
    # Convert ObjectIds to strings
    for item in items:
        item["_id"] = str(item["_id"])
        
    return items

@router.post("/api/review/approve/{content_id}")
def approve_content(content_id: str, request: ApproveRequest, current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "review:approve")
    
    try:
        obj_id = ObjectId(content_id)
    except:
        raise HTTPException(400, "Invalid content ID format")
        
    item = db.content_library.find_one({"_id": obj_id})
    if not item:
        raise HTTPException(404, "Content item not found")

    if item.get("status") != "pending_review":
        raise HTTPException(400, f"Cannot approve item with status: {item.get('status')}")

    # Gate 3: Blue Arrow cultural gate — HARD BLOCK
    if item.get("brand") == "blue_arrow_cpa" and not item.get("designer_approved", False):
        raise HTTPException(
            403, 
            "Blue Arrow CPA content requires Designer cultural review approval first. "
            "designer_approved must be True before this item can be approved."
        )

    scheduled_at = request.scheduled_at or item.get("scheduled_at", datetime.utcnow().isoformat())
    
    db.content_library.update_one(
        {"_id": obj_id},
        {"$set": {
            "status": "approved",
            "approved_by": current_user.id,
            "approved_at": datetime.utcnow().isoformat(),
            "scheduled_at": scheduled_at,
        }}
    )

    try:
        eta = datetime.fromisoformat(str(scheduled_at).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        eta = datetime.utcnow()

    task = celery_config.agent3_publish.apply_async(args=[content_id], eta=eta)
    return {"status": "ok", "celery_task_id": task.id}

@router.post("/api/review/reject/{content_id}")
def reject_content(content_id: str, request: RejectRequest, current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "review:reject")
    
    try:
        obj_id = ObjectId(content_id)
    except:
        raise HTTPException(400, "Invalid content ID format")
        
    db.content_library.update_one(
        {"_id": obj_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": request.reason,
            "rejected_by": current_user.id,
            "rejected_at": datetime.utcnow().isoformat(),
        }}
    )

    # Queue Agent 2 regeneration with rejection reason injected into prompt
    task = celery_config.smo_agent2_regenerate.apply_async(
        args=[content_id, request.reason],
        countdown=5,  # 5-second delay so the status update commits first
    )

    return {"status": "ok", "regeneration_queued": True, "task_id": task.id}

@router.put("/api/review/edit/{content_id}")
def edit_content(content_id: str, request: EditRequest, current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "review:edit")
    
    try:
        obj_id = ObjectId(content_id)
    except:
        raise HTTPException(400, "Invalid content ID format")
        
    item = db.content_library.find_one({"_id": obj_id})
    if not item:
        raise HTTPException(404, "Not found")
        
    original = item.get("original_content_body")
    if not original:
        original = item.get("content_body")
        
    db.content_library.update_one(
        {"_id": obj_id},
        {"$set": {
            "content_body": request.content_body,
            "original_content_body": original,
            "dm_edited": True
        }}
    )
    
    return {"status": "ok"}

@router.get("/api/review/designer-queue")
def get_designer_queue(current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "visual_queue:read")
    
    items = list(db.content_library.find({"status": "designer_pending"}))
    for item in items:
        item["_id"] = str(item["_id"])
        
    return items

@router.post("/api/review/designer-approve/{content_id}")
def designer_approve(content_id: str, request: DesignerApproveRequest, current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "designer_approved:write")
    
    try:
        obj_id = ObjectId(content_id)
    except:
        raise HTTPException(400, "Invalid ID")
        
    item = db.content_library.find_one({"_id": obj_id})
    if not item:
        raise HTTPException(404, "Not found")
        
    update_data = {
        "designer_approved": True,
        "designer_approved_by": current_user.id,
        "designer_approved_at": datetime.utcnow().isoformat(),
        "status": "pending_review"
    }
    
    if request.asset_url:
        update_data["visual_asset_url"] = request.asset_url
        
    db.content_library.update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )
    
    # Send WhatsApp to DM Leader
    item["designer_approved"] = True
    notify_designer_visual_queue(item)
    
    return {"status": "ok"}

class SmoGenerateRequest(BaseModel):
    brand: Optional[str] = None  # hcllp | blue_arrow_cpa | advisory | None = all

@router.post("/api/smo/generate")
def trigger_smo_generate(request: SmoGenerateRequest = Body(SmoGenerateRequest()), current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "smo:trigger")

    brand = request.brand if request.brand in ("hcllp", "blue_arrow_cpa", "advisory") else None
    result = celery_config.smo_agent1_brief_gen.apply_async(kwargs={"brand": brand})
    brands_label = brand or "all brands"
    return {"task_id": result.id, "brand": brands_label, "expected_completion": "5 minutes"}

@router.get("/api/analytics/performance-summary")
def get_performance_summary(current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")
    
    context = db.agent1_brief_context.find_one(sort=[("week_start", -1)])
    if context:
        context["_id"] = str(context["_id"])
    return context or {}

@router.get("/api/review/cascade-preview/{content_id}")
def cascade_preview(content_id: str, current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "review:read")
    from datetime import timedelta

    # Return real cascade children if they already exist (blog was published)
    existing = list(db.content_library.find({"cascade_parent_id": content_id}))
    if existing:
        result = []
        for child in existing:
            result.append({
                "day_offset": None,
                "platform": ", ".join(child.get("platform", [])),
                "content_summary": (child.get("content_body") or "")[:80],
                "scheduled_at": child.get("scheduled_at").isoformat() if hasattr(child.get("scheduled_at"), "isoformat") else str(child.get("scheduled_at", "")),
                "status": child.get("status", "pending"),
                "_id": str(child["_id"]),
            })
        return result

    # Blog not yet published — compute schedule preview from parent item
    try:
        obj_id = ObjectId(content_id)
    except Exception:
        raise HTTPException(400, "Invalid content ID")

    item = db.content_library.find_one({"_id": obj_id})
    if not item:
        raise HTTPException(404, "Content item not found")

    base_date = item.get("scheduled_at") or datetime.utcnow()
    if isinstance(base_date, str):
        try:
            base_date = datetime.fromisoformat(base_date.replace("Z", "+00:00"))
        except Exception:
            base_date = datetime.utcnow()

    cascade_schedule = [
        {"day_offset": 0,  "platform": "Blog / LinkedIn",          "type": "Main blog post publish"},
        {"day_offset": 3,  "platform": "LinkedIn",                 "type": "Stat post from blog"},
        {"day_offset": 7,  "platform": "Instagram, Facebook",      "type": "Quote card"},
        {"day_offset": 14, "platform": "LinkedIn",                 "type": "Did you know"},
        {"day_offset": 21, "platform": "LinkedIn, Facebook",       "type": "ICYMI re-share"},
    ]

    return [
        {
            "day_offset": s["day_offset"],
            "platform": s["platform"],
            "content_summary": s["type"],
            "scheduled_at": (base_date + timedelta(days=s["day_offset"])).isoformat(),
            "status": "preview",
        }
        for s in cascade_schedule
    ]
