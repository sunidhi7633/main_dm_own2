import os
import sys
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth import get_current_user, CurrentUser
from auth.roles import ROLES
from mongo import db
from bson import ObjectId

router = APIRouter()

def check_permission(user: CurrentUser, required_permission: str):
    if user.role == "admin":
        return True
    user_perms = ROLES.get(user.role, {}).get("permissions", [])
    if "*" in user_perms or required_permission in user_perms:
        return True
    raise HTTPException(status_code=403, detail=f"Permission denied: {required_permission} required")

class RecipientRequest(BaseModel):
    name: str
    email: str
    whatsapp: str
    role: str # CEO | Partner | Advisor

@router.get("/api/settings/recipients")
async def get_recipients(current_user: CurrentUser = Depends(get_current_user)):
    # Any role that can read analytics can see the recipients list
    check_permission(current_user, "analytics:read")
    
    recipients = list(db.report_recipients.find({"active": {"$ne": False}}))
    for r in recipients:
        r["_id"] = str(r["_id"])
    return recipients

@router.post("/api/settings/recipients")
async def add_recipient(req: RecipientRequest, current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read") # Require DM Leader typically, using read here for simplicity
    if current_user.role not in ["dm_leader", "admin"]:
         raise HTTPException(403, "Only DM Leader can add recipients")
         
    doc = {
        "name": req.name,
        "email": req.email,
        "whatsapp": req.whatsapp,
        "role": req.role,
        "active": True,
        "added_by": current_user.id,
        "added_at": datetime.utcnow().isoformat()
    }
    db.report_recipients.insert_one(doc)
    return {"status": "ok"}

@router.delete("/api/settings/recipients/{recipient_id}")
async def remove_recipient(recipient_id: str, current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")
    if current_user.role not in ["dm_leader", "admin"]:
        raise HTTPException(403, "Only DM Leader can remove recipients")
    try:
        obj_id = ObjectId(recipient_id)
    except Exception:
        raise HTTPException(400, "Invalid recipient ID")
    result = db.report_recipients.update_one({"_id": obj_id}, {"$set": {"active": False}})
    if result.matched_count == 0:
        raise HTTPException(404, "Recipient not found")
    return {"status": "ok"}
