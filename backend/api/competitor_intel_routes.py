"""
Competitor Intelligence — API Routes
"""
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, check_permission, CurrentUser
import models

router = APIRouter(tags=["competitor-intel"])


# ── Pydantic ─────────────────────────────────────────────────────────────────

class CompetitorIn(BaseModel):
    name: str
    industry: str = "CPA / Accounting"
    website: str = ""
    linkedin_handle: str = ""
    facebook_handle: str = ""
    instagram_handle: str = ""
    twitter_handle: str = ""
    youtube_handle: str = ""

class CompetitorUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    linkedin_handle: Optional[str] = None
    facebook_handle: Optional[str] = None
    instagram_handle: Optional[str] = None
    twitter_handle: Optional[str] = None
    youtube_handle: Optional[str] = None
    is_active: Optional[int] = None

class ReviewAction(BaseModel):
    action: str                          # approve / reject / schedule
    rejection_reason: Optional[str] = None
    scheduled_at: Optional[str] = None
    content: Optional[str] = None

class ScheduleConfigIn(BaseModel):
    cron_hour: int = 3
    cron_minute: int = 0
    is_enabled: int = 0
    days_back: int = 7
    top_n: int = 30
    weight_likes: int = 1
    weight_comments: int = 3
    weight_shares: int = 5
    weight_views: int = 0

class RunRequest(BaseModel):
    brands: Optional[list] = None


# ── Serializers ──────────────────────────────────────────────────────────────

def _sc(c) -> dict:
    return {
        "id": c.id, "name": c.name, "industry": c.industry or "",
        "website": c.website or "",
        "linkedin_handle": c.linkedin_handle or "",
        "facebook_handle": c.facebook_handle or "",
        "instagram_handle": c.instagram_handle or "",
        "twitter_handle": c.twitter_handle or "",
        "youtube_handle": c.youtube_handle or "",
        "is_active": c.is_active,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }

def _sr(r) -> dict:
    return {
        "id": r.id, "triggered_by": r.triggered_by or "",
        "status": r.status, "step": r.step or "",
        "posts_collected": r.posts_collected,
        "posts_scored": r.posts_scored,
        "posts_top": r.posts_top,
        "content_generated": r.content_generated,
        "logs": r.logs or "",
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
    }

def _sp(p, cname="") -> dict:
    return {
        "id": p.id, "competitor_id": p.competitor_id,
        "competitor_name": cname,
        "platform": p.platform, "post_url": p.post_url or "",
        "content": p.content or "",
        "published_at": p.published_at.isoformat() if p.published_at else None,
        "likes": p.likes, "comments": p.comments,
        "shares": p.shares, "reposts": p.reposts, "views": p.views,
        "engagement_score": p.engagement_score, "rank": p.rank,
    }

def _sg(g) -> dict:
    return {
        "id": g.id, "run_id": g.run_id,
        "brand": g.brand, "platform": g.platform,
        "headline": g.headline or "", "content": g.content or "",
        "cta": g.cta or "",
        "hashtags": json.loads(g.hashtags or "[]"),
        "image_prompt": g.image_prompt or "",
        "inspiration_post_ids": json.loads(g.inspiration_post_ids or "[]"),
        "quality_brand_score": g.quality_brand_score,
        "quality_originality_score": g.quality_originality_score,
        "quality_readability_score": g.quality_readability_score,
        "status": g.status,
        "source_type": getattr(g, "source_type", None) or "competitor_intel",
        "calendar_event_name": getattr(g, "calendar_event_name", None) or "",
        "rejection_reason": g.rejection_reason or "",
        "live_url": g.live_url or "",
        "scheduled_at": g.scheduled_at.isoformat() if g.scheduled_at else None,
        "published_at": g.published_at.isoformat() if g.published_at else None,
        "created_at": g.created_at.isoformat() if g.created_at else None,
    }


# ── Competitors ───────────────────────────────────────────────────────────────

@router.get("/api/ci/competitors")
def list_competitors(active_only: bool = True, db: Session = Depends(get_db),
                     current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")
    q = db.query(models.CICompetitor)
    if active_only:
        q = q.filter(models.CICompetitor.is_active == 1)
    competitors = q.order_by(models.CICompetitor.name).all()

    # Get post counts from the latest completed run
    latest_run = (db.query(models.CIPipelineRun)
                  .filter(models.CIPipelineRun.status == "completed")
                  .order_by(models.CIPipelineRun.id.desc()).first())
    post_counts: dict[int, int] = {}
    if latest_run:
        from sqlalchemy import func
        rows = (db.query(models.CISocialPost.competitor_id, func.count(models.CISocialPost.id))
                .filter(models.CISocialPost.run_id == latest_run.id)
                .group_by(models.CISocialPost.competitor_id).all())
        post_counts = {cid: cnt for cid, cnt in rows}

    result = []
    for c in competitors:
        d = _sc(c)
        d["posts_collected"] = post_counts.get(c.id, 0)
        d["latest_run_id"] = latest_run.id if latest_run else None
        result.append(d)
    return result


@router.post("/api/ci/competitors")
def add_competitor(body: CompetitorIn, db: Session = Depends(get_db),
                   current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "smo:trigger")
    c = models.CICompetitor(**body.dict())
    db.add(c); db.commit(); db.refresh(c)
    return _sc(c)


@router.patch("/api/ci/competitors/{cid}")
def update_competitor(cid: int, body: CompetitorUpdate, db: Session = Depends(get_db),
                      current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "smo:trigger")
    c = db.query(models.CICompetitor).filter(models.CICompetitor.id == cid).first()
    if not c:
        raise HTTPException(404, "Competitor not found")
    for k, v in body.dict(exclude_none=True).items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    return _sc(c)


@router.delete("/api/ci/competitors/{cid}")
def delete_competitor(cid: int, db: Session = Depends(get_db),
                      current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "smo:trigger")
    c = db.query(models.CICompetitor).filter(models.CICompetitor.id == cid).first()
    if not c:
        raise HTTPException(404, "Competitor not found")
    c.is_active = 0; db.commit()
    return {"status": "deactivated"}


@router.post("/api/ci/competitors/{cid}/toggle")
def toggle_competitor(cid: int, db: Session = Depends(get_db),
                      current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "smo:trigger")
    c = db.query(models.CICompetitor).filter(models.CICompetitor.id == cid).first()
    if not c:
        raise HTTPException(404, "Competitor not found")
    c.is_active = 0 if c.is_active else 1
    db.commit()
    return {"status": "active" if c.is_active else "inactive", "is_active": c.is_active}


# ── Pipeline ──────────────────────────────────────────────────────────────────

@router.post("/api/ci/run")
def trigger_run(body: RunRequest = Body(RunRequest()), db: Session = Depends(get_db),
                current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "smo:trigger")
    run = models.CIPipelineRun(triggered_by=current_user.username, status="pending", step="queued")
    db.add(run); db.commit(); db.refresh(run)
    run_id = run.id
    brands = body.brands

    try:
        import celery_config
        celery_config.run_ci_pipeline.apply_async(kwargs={"run_id": run_id, "brands": brands})
    except Exception:
        # Celery unavailable — run in background thread
        import threading
        def _run():
            import celery_config as cc
            cc.run_ci_pipeline(run_id=run_id, brands=brands)
        threading.Thread(target=_run, daemon=True).start()

    return {"run_id": run_id, "status": "queued"}


@router.get("/api/ci/runs")
def list_runs(limit: int = 20, db: Session = Depends(get_db),
              current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")
    rows = db.query(models.CIPipelineRun).order_by(models.CIPipelineRun.id.desc()).limit(limit).all()
    return [_sr(r) for r in rows]


@router.get("/api/ci/runs/{run_id}")
def get_run(run_id: int, db: Session = Depends(get_db),
            current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")
    r = db.query(models.CIPipelineRun).filter(models.CIPipelineRun.id == run_id).first()
    if not r:
        raise HTTPException(404, "Run not found")
    return _sr(r)


# ── Top Posts ─────────────────────────────────────────────────────────────────

@router.get("/api/ci/posts/top")
def top_posts(run_id: Optional[int] = None, limit: int = 30,
              db: Session = Depends(get_db),
              current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")
    if not run_id:
        latest = (db.query(models.CIPipelineRun)
                  .filter(models.CIPipelineRun.status == "completed")
                  .order_by(models.CIPipelineRun.id.desc()).first())
        if not latest:
            return []
        run_id = latest.id

    posts = (db.query(models.CISocialPost)
             .filter(models.CISocialPost.run_id == run_id, models.CISocialPost.rank <= limit)
             .order_by(models.CISocialPost.rank).all())

    cmap = {c.id: c.name for c in db.query(models.CICompetitor).all()}
    return [_sp(p, cmap.get(p.competitor_id, "Unknown")) for p in posts]


# ── Trend Report ──────────────────────────────────────────────────────────────

@router.get("/api/ci/trend-report")
def trend_report(run_id: Optional[int] = None, db: Session = Depends(get_db),
                 current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")
    if not run_id:
        latest = (db.query(models.CIPipelineRun)
                  .filter(models.CIPipelineRun.status == "completed")
                  .order_by(models.CIPipelineRun.id.desc()).first())
        if not latest:
            return {}
        run_id = latest.id

    r = db.query(models.CITrendReport).filter(models.CITrendReport.run_id == run_id).first()
    if not r:
        return {}
    return {
        "run_id": run_id,
        "themes": json.loads(r.themes or "[]"),
        "writing_styles": json.loads(r.writing_styles or "[]"),
        "hook_patterns": json.loads(r.hook_patterns or "[]"),
        "cta_patterns": json.loads(r.cta_patterns or "[]"),
        "summary": r.summary or "",
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# ── Generated Content ─────────────────────────────────────────────────────────

@router.get("/api/ci/generated")
def list_generated(run_id: Optional[int] = None, brand: Optional[str] = None,
                   platform: Optional[str] = None, status: Optional[str] = None,
                   source_type: Optional[str] = None,
                   limit: int = 30, offset: int = 0, db: Session = Depends(get_db),
                   current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")
    if not run_id:
        latest = (db.query(models.CIPipelineRun)
                  .filter(models.CIPipelineRun.status == "completed")
                  .order_by(models.CIPipelineRun.id.desc()).first())
        if not latest:
            return []
        run_id = latest.id

    q = db.query(models.CIGeneratedContent).filter(models.CIGeneratedContent.run_id == run_id)
    if brand:       q = q.filter(models.CIGeneratedContent.brand == brand)
    if platform:    q = q.filter(models.CIGeneratedContent.platform == platform)
    if status:      q = q.filter(models.CIGeneratedContent.status == status)
    if source_type: q = q.filter(models.CIGeneratedContent.source_type == source_type)
    return [_sg(g) for g in q.order_by(models.CIGeneratedContent.id).offset(offset).limit(limit).all()]


@router.patch("/api/ci/generated/{gid}")
def review_generated(gid: int, body: ReviewAction, db: Session = Depends(get_db),
                     current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "review:approve")
    g = db.query(models.CIGeneratedContent).filter(models.CIGeneratedContent.id == gid).first()
    if not g:
        raise HTTPException(404, "Post not found")
    if body.content is not None:
        g.content = body.content
    if body.action == "approve":
        g.status = "approved"
    elif body.action == "reject":
        g.status = "rejected"
        g.rejection_reason = body.rejection_reason or ""
    elif body.action == "schedule":
        g.status = "scheduled"
        if body.scheduled_at:
            g.scheduled_at = datetime.fromisoformat(body.scheduled_at)
    else:
        raise HTTPException(400, "Invalid action")
    g.updated_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(g)
    return _sg(g)


# ── Schedule Config ───────────────────────────────────────────────────────────

@router.get("/api/ci/schedule")
def get_schedule(db: Session = Depends(get_db),
                 current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")
    cfg = db.query(models.CIScheduleConfig).first()
    if not cfg:
        return ScheduleConfigIn().dict()
    return {"cron_hour": cfg.cron_hour, "cron_minute": cfg.cron_minute,
            "is_enabled": cfg.is_enabled, "days_back": cfg.days_back,
            "top_n": cfg.top_n, "weight_likes": cfg.weight_likes,
            "weight_comments": cfg.weight_comments, "weight_shares": cfg.weight_shares,
            "weight_views": cfg.weight_views}


@router.post("/api/ci/schedule")
def save_schedule(body: ScheduleConfigIn, db: Session = Depends(get_db),
                  current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "smo:trigger")
    cfg = db.query(models.CIScheduleConfig).first()
    if not cfg:
        cfg = models.CIScheduleConfig(); db.add(cfg)
    for k, v in body.dict().items():
        setattr(cfg, k, v)
    db.commit()
    return {"status": "saved"}


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/api/ci/stats")
def get_stats(db: Session = Depends(get_db),
              current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")
    return {
        "total_competitors": db.query(models.CICompetitor).filter(models.CICompetitor.is_active == 1).count(),
        "total_runs": db.query(models.CIPipelineRun).count(),
        "pending_review": db.query(models.CIGeneratedContent).filter(models.CIGeneratedContent.status == "draft").count(),
        "approved": db.query(models.CIGeneratedContent).filter(models.CIGeneratedContent.status == "approved").count(),
        "latest_run": _sr(db.query(models.CIPipelineRun).order_by(models.CIPipelineRun.id.desc()).first()) if db.query(models.CIPipelineRun).count() else None,
    }


# ── Calendar Events ───────────────────────────────────────────────────────────

class CalendarEventIn(BaseModel):
    event_date: str                         # ISO date string e.g. "2026-06-15"
    event_name: str
    event_type: str = "general"             # general / deadline / campaign / holiday / webinar
    brand: str = "all"
    platforms: str = "linkedin,facebook"
    notes: str = ""
    days_before: int = 3

class CalendarEventBulk(BaseModel):
    events: list[CalendarEventIn]


def _sev(e) -> dict:
    return {
        "id": e.id,
        "event_date": e.event_date.isoformat() if e.event_date else None,
        "event_name": e.event_name,
        "event_type": e.event_type or "general",
        "brand": e.brand or "all",
        "platforms": (e.platforms or "").split(","),
        "notes": e.notes or "",
        "days_before": e.days_before or 3,
        "is_active": e.is_active,
    }


@router.get("/api/ci/calendar")
def list_calendar(month: Optional[int] = None, year: Optional[int] = None,
                  db: Session = Depends(get_db),
                  current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")
    from sqlalchemy import extract
    q = db.query(models.CICalendarEvent).filter(models.CICalendarEvent.is_active == 1)
    if month:
        q = q.filter(extract("month", models.CICalendarEvent.event_date) == month)
    if year:
        q = q.filter(extract("year", models.CICalendarEvent.event_date) == year)
    return [_sev(e) for e in q.order_by(models.CICalendarEvent.event_date).all()]


@router.post("/api/ci/calendar")
def add_calendar_event(body: CalendarEventIn, db: Session = Depends(get_db),
                       current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "smo:trigger")
    ev = models.CICalendarEvent(
        event_date=datetime.fromisoformat(body.event_date),
        event_name=body.event_name,
        event_type=body.event_type,
        brand=body.brand,
        platforms=",".join(body.platforms) if isinstance(body.platforms, list) else body.platforms,
        notes=body.notes,
        days_before=body.days_before,
    )
    db.add(ev); db.commit(); db.refresh(ev)
    return _sev(ev)


@router.post("/api/ci/calendar/bulk")
def bulk_add_calendar(body: CalendarEventBulk, db: Session = Depends(get_db),
                      current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "smo:trigger")
    created = []
    for item in body.events:
        ev = models.CICalendarEvent(
            event_date=datetime.fromisoformat(item.event_date),
            event_name=item.event_name,
            event_type=item.event_type,
            brand=item.brand,
            platforms=",".join(item.platforms) if isinstance(item.platforms, list) else item.platforms,
            notes=item.notes,
            days_before=item.days_before,
        )
        db.add(ev)
        created.append(ev)
    db.commit()
    return {"created": len(created)}


@router.patch("/api/ci/calendar/{eid}")
def update_calendar_event(eid: int, body: CalendarEventIn, db: Session = Depends(get_db),
                          current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "smo:trigger")
    ev = db.query(models.CICalendarEvent).filter(models.CICalendarEvent.id == eid).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    ev.event_date = datetime.fromisoformat(body.event_date)
    ev.event_name = body.event_name
    ev.event_type = body.event_type
    ev.brand = body.brand
    ev.platforms = ",".join(body.platforms) if isinstance(body.platforms, list) else body.platforms
    ev.notes = body.notes
    ev.days_before = body.days_before
    db.commit(); db.refresh(ev)
    return _sev(ev)


@router.delete("/api/ci/calendar/{eid}")
def delete_calendar_event(eid: int, db: Session = Depends(get_db),
                          current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "smo:trigger")
    ev = db.query(models.CICalendarEvent).filter(models.CICalendarEvent.id == eid).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    ev.is_active = 0; db.commit()
    return {"status": "deleted"}


# ── Calendar Post Manual Generation ──────────────────────────────────────────

class CalendarGenerateRequest(BaseModel):
    brands: Optional[list] = None        # None = all brands
    event_ids: Optional[list] = None     # None = all upcoming events (next 30 days)


@router.post("/api/ci/calendar/generate")
def generate_calendar_posts_manual(
    body: CalendarGenerateRequest = Body(CalendarGenerateRequest()),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    check_permission(current_user, "smo:trigger")

    from datetime import timedelta, timezone
    now = datetime.now(timezone.utc)

    run = models.CIPipelineRun(
        triggered_by=current_user.username,
        status="running",
        step="calendar_generate",
    )
    db.add(run); db.commit(); db.refresh(run)
    run_id = run.id

    try:
        q = db.query(models.CICalendarEvent).filter(
            models.CICalendarEvent.is_active == 1,
            models.CICalendarEvent.event_date >= now,
            models.CICalendarEvent.event_date <= now + timedelta(days=30),
        )
        if body.event_ids:
            q = q.filter(models.CICalendarEvent.id.in_(body.event_ids))
        events = q.order_by(models.CICalendarEvent.event_date).all()

        if not events:
            run.status = "completed"
            run.step = "no_events"
            db.commit()
            return {"run_id": run_id, "generated": 0, "message": "No upcoming calendar events found in the next 30 days"}

        from agents.competitor_intel.generator import generate_calendar_posts
        generated_dicts = generate_calendar_posts(run_id, events, brands=body.brands)

        for gd in generated_dicts:
            db.add(models.CIGeneratedContent(**gd))
        db.commit()

        run.status = "completed"
        run.content_generated = len(generated_dicts)
        run.step = "calendar_generate_done"
        db.commit()

        return {
            "run_id": run_id,
            "generated": len(generated_dicts),
            "events_processed": len(events),
        }
    except Exception as e:
        run.status = "failed"
        run.logs = str(e)
        db.commit()
        raise HTTPException(500, f"Calendar post generation failed: {e}")


# ── File Parse (AI-assisted event extraction) ─────────────────────────────────

def _extract_text_from_file(content: bytes, filename: str) -> str:
    """Extract plain text from uploaded file based on extension."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else "txt"

    if ext in ("txt", "md"):
        return content.decode("utf-8", errors="ignore")

    if ext == "csv":
        import csv, io
        text_lines = []
        reader = csv.reader(io.StringIO(content.decode("utf-8", errors="ignore")))
        for row in reader:
            text_lines.append(" | ".join(row))
        return "\n".join(text_lines)

    if ext in ("xlsx", "xls"):
        import io
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            lines = []
            for sheet in wb.worksheets:
                lines.append(f"[Sheet: {sheet.title}]")
                for row in sheet.iter_rows(values_only=True):
                    row_text = " | ".join(str(c) if c is not None else "" for c in row)
                    if row_text.strip(" |"):
                        lines.append(row_text)
            return "\n".join(lines)
        except Exception as e:
            return f"[Excel parse error: {e}]"

    if ext == "pdf":
        import io
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            return f"[PDF parse error: {e}]"

    return content.decode("utf-8", errors="ignore")


@router.post("/api/ci/calendar/parse-file")
async def parse_file_for_event(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    check_permission(current_user, "smo:trigger")

    content = await file.read()
    raw_text = _extract_text_from_file(content, file.filename or "upload.txt")

    if not raw_text.strip():
        raise HTTPException(400, "Could not extract text from file.")

    # Truncate to 6000 chars to stay within token limits
    text_snippet = raw_text[:6000]

    import os
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    prompt = f"""You are a calendar event extractor. Given the document text below, extract calendar event details for a social media content calendar.

Return ONLY valid JSON (no markdown, no explanation):
{{
  "event_name": "short descriptive name (max 10 words)",
  "event_date": "YYYY-MM-DD or empty string if not found",
  "event_type": "general or deadline or campaign or holiday or webinar",
  "brand": "all or hcllp or blue_arrow_cpa or advisory",
  "platforms": "linkedin,facebook",
  "days_before": 3,
  "notes": "concise AI context summary (2-4 sentences) that will help generate social media posts for this event"
}}

If multiple events are present, extract the most prominent one.
If a field cannot be determined, use a sensible default.

Document:
{text_snippet}"""

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=400,
        )
        raw = resp.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
        parsed["raw_text_preview"] = raw_text[:300]
        return parsed
    except Exception as e:
        # Return raw text as notes fallback
        return {
            "event_name": "",
            "event_date": "",
            "event_type": "general",
            "brand": "all",
            "platforms": "linkedin,facebook",
            "days_before": 3,
            "notes": raw_text[:500],
            "raw_text_preview": raw_text[:300],
            "parse_error": str(e),
        }
