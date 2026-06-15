from dotenv import load_dotenv
load_dotenv()
from typing import Optional
from datetime import datetime, timezone

from pydantic import BaseModel
import asyncio
import time
import os
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, BackgroundTasks, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_user
from database import get_db
import models
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-4o")

try:
    from langchain_openai import ChatOpenAI
    llm = ChatOpenAI(model=CHAT_MODEL, temperature=0.7)
except ImportError:
    llm = None

async def generate_llm_response(system_prompt: str, user_message: str) -> str:
    if not llm:
        return "Error: LLM not configured (check OPENAI_API_KEY)"
    try:
        from langchain_core.messages import HumanMessage, SystemMessage
        ai_response = llm.invoke([SystemMessage(content=system_prompt), HumanMessage(content=user_message)])
        return ai_response.content
    except Exception as e:
        return f"Error using OpenAI: {e}"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables
    from database import engine, Base
    import models
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
    except Exception as e:
        print(f"Warning: pgvector extension not available (non-fatal): {e}")
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Warning: Could not create database tables: {e}")
        
    # Verify MongoDB Connection
    from mongo import client as mongo_client
    try:
        mongo_client.admin.command('ping')
        print("Successfully connected to MongoDB.")
    except Exception as e:
        print(f"Warning: Could not connect to MongoDB: {e}")

    # Seed default report recipient (Sanwar Harshwal, CEO) if list is empty
    try:
        from mongo import db as mongo_db
        if mongo_db.report_recipients.count_documents({"active": {"$ne": False}}) == 0:
            mongo_db.report_recipients.insert_one({
                "name": "Sanwar Harshwal",
                "email": "sanwar@harshwal.com",
                "whatsapp": "+919999999999",
                "role": "CEO",
                "active": True,
                "added_by": "system",
                "added_at": datetime.utcnow().isoformat(),
            })
            print("Seeded default recipient: Sanwar Harshwal (CEO)")
    except Exception as e:
        print(f"Warning: Could not seed report_recipients: {e}")

    # Seed sample competitors for Competitor Intelligence
    try:
        from database import SessionLocal as _SL
        _db = _SL()
        if _db.query(models.CICompetitor).count() == 0:
            _SAMPLE_COMPETITORS = [
                {"name": "Deloitte", "industry": "Big 4 Accounting", "website": "deloitte.com", "linkedin_handle": "deloitte", "twitter_handle": "Deloitte", "facebook_handle": "deloitte", "instagram_handle": "deloitte"},
                {"name": "PwC", "industry": "Big 4 Accounting", "website": "pwc.com", "linkedin_handle": "pwc", "twitter_handle": "PwC", "facebook_handle": "pwc", "instagram_handle": "pwc"},
                {"name": "KPMG", "industry": "Big 4 Accounting", "website": "kpmg.com", "linkedin_handle": "kpmg", "twitter_handle": "KPMG", "facebook_handle": "kpmg", "instagram_handle": "kpmg"},
                {"name": "EY", "industry": "Big 4 Accounting", "website": "ey.com", "linkedin_handle": "ernst-and-young", "twitter_handle": "EYnews", "facebook_handle": "EY", "instagram_handle": "ernstandyoung"},
                {"name": "Grant Thornton", "industry": "Mid-market CPA", "website": "grantthornton.com", "linkedin_handle": "grant-thornton", "twitter_handle": "GrantThorntonUS", "facebook_handle": "GrantThorntonUS", "instagram_handle": "grantthorntonus"},
                {"name": "BDO USA", "industry": "Mid-market CPA", "website": "bdo.com", "linkedin_handle": "bdo-usa", "twitter_handle": "BDO_USA_CPA", "facebook_handle": "BDOUSA", "instagram_handle": "bdousa"},
                {"name": "RSM US", "industry": "Mid-market CPA", "website": "rsmus.com", "linkedin_handle": "rsm-us", "twitter_handle": "RSM_US", "facebook_handle": "RSMUS", "instagram_handle": "rsm_us"},
                {"name": "CohnReznick", "industry": "CPA / Advisory", "website": "cohnreznick.com", "linkedin_handle": "cohnreznick", "twitter_handle": "CohnReznick", "facebook_handle": "CohnReznick", "instagram_handle": "cohnreznick"},
                {"name": "Plante Moran", "industry": "CPA / Advisory", "website": "plantemoran.com", "linkedin_handle": "plante-moran", "twitter_handle": "PlanteAndMoran", "facebook_handle": "PlanteAndMoran", "instagram_handle": "plantemoran"},
                {"name": "Moss Adams", "industry": "CPA / Advisory", "website": "mossadams.com", "linkedin_handle": "moss-adams", "twitter_handle": "MossAdams", "facebook_handle": "MossAdams", "instagram_handle": "mossadamsllp"},
            ]
            for c in _SAMPLE_COMPETITORS:
                _db.add(models.CICompetitor(**c))
            _db.commit()
            print(f"Seeded {len(_SAMPLE_COMPETITORS)} sample competitors.")
        _db.close()
    except Exception as e:
        print(f"Warning: Could not seed competitors: {e}")

    # Create MongoDB indexes for query performance
    try:
        from mongo import db as mongo_db
        mongo_db.content_library.create_index([("status", 1), ("brand", 1)])
        mongo_db.content_library.create_index([("scheduled_at", 1)])
        mongo_db.content_library.create_index([("smo_generated", 1)])
        mongo_db.smo_briefs.create_index([("status", 1), ("brand", 1)])
        mongo_db.agent1_brief_context.create_index([("week_start", -1)])
        print("MongoDB indexes ensured.")
    except Exception as e:
        print(f"Warning: Could not create MongoDB indexes: {e}")

    yield

app = FastAPI(
    title="Harshwal Automation API",
    description="Backend API for the Harshwal Automation platform",
    version="1.0.0",
    lifespan=lifespan
)

from api.review_routes import router as review_router
from api.library_routes import router as library_router
from api.report_routes import router as report_router
from api.settings_routes import router as settings_router
from api.competitor_intel_routes import router as ci_router

app.include_router(review_router)
app.include_router(library_router)
app.include_router(report_router)
app.include_router(settings_router)
app.include_router(ci_router)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    brand: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    session_id: str
    sources: list[str]

class LoginRequest(BaseModel):
    username: str
    password: str

class BrandVoiceRequest(BaseModel):
    brand_name: str
    platform: str
    tone: str
    topic: str

class SMOPostRequest(BaseModel):
    title: str
    platform: str
    caption: str
    tag: str

class SMOPostEditRequest(BaseModel):
    caption: str

ADMIN_USER = os.getenv("ADMIN_USERNAME")
ADMIN_PASS = os.getenv("ADMIN_PASSWORD")
if not ADMIN_USER or not ADMIN_PASS:
    raise RuntimeError("ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env — refusing to start with empty credentials.")

# Dev-only mock accounts — disabled entirely in production.
# Passwords must be set via env vars; no hardcoded defaults.
_MOCK_ACCOUNTS = {
    "purnima":  {"role": "dm_leader",    "pass_env": "MOCK_PURNIMA_PASS"},
    "designer": {"role": "designer",     "pass_env": "MOCK_DESIGNER_PASS"},
    "seo":      {"role": "seo_executive","pass_env": "MOCK_SEO_PASS"},
}

@app.post("/api/auth/login")
def login(req: LoginRequest):
    # Primary admin — always active
    if req.username == ADMIN_USER and req.password == ADMIN_PASS:
        token = create_access_token(data={"sub": req.username, "role": "admin"})
        return {"access_token": token, "token_type": "bearer", "role": "admin"}

    # Mock accounts — only in non-production, only if password env var is set
    if ENVIRONMENT != "production" and req.username in _MOCK_ACCOUNTS:
        account = _MOCK_ACCOUNTS[req.username]
        mock_pass = os.getenv(account["pass_env"], "")
        if mock_pass and req.password == mock_pass:
            token = create_access_token(data={"sub": req.username, "role": account["role"]})
            return {"access_token": token, "token_type": "bearer", "role": account["role"]}

    raise HTTPException(status_code=401, detail="Incorrect username or password")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Harshwal Automation API is running"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

def _format_last_run(dt) -> str:
    if not dt:
        return "never"
    from datetime import timezone
    now = datetime.utcnow().replace(tzinfo=timezone.utc) if hasattr(dt, 'tzinfo') and dt.tzinfo else datetime.utcnow()
    diff = now - (dt.replace(tzinfo=None) if hasattr(dt, 'tzinfo') else dt)
    mins = int(diff.total_seconds() / 60)
    if mins < 60:
        return f"{mins}m ago"
    if mins < 1440:
        return f"{mins // 60}h ago"
    return f"{mins // 1440}d ago"

@app.get("/api/agents/health")
def agents_health_check():
    from mongo import db as mongo_db
    from datetime import datetime

    def _last(collection, query=None, field="created_at"):
        try:
            doc = mongo_db[collection].find_one(query or {}, sort=[(field, -1)])
            return doc.get(field) if doc else None
        except Exception:
            return None

    # Agent 1 — last brief batch written to smo_briefs
    a1_ts = _last("smo_briefs")
    # Agent 2 — last AI-generated content item (agent1 calls agent2 inline)
    a2_ts = _last("content_library", {"smo_generated": True})
    # Agent 3 — last published item
    a3_ts = _last("content_library", {"status": "published"}, field="published_at")
    # Agent 4 — last analytics context written
    a4_ts = _last("agent1_brief_context")
    # Agent 7 — not yet built
    a7_ts = None

    def _health(ts, warn_hours=48):
        if not ts:
            return {"status": "never_run", "last_run": "never"}
        from datetime import timedelta
        age = datetime.utcnow() - (ts.replace(tzinfo=None) if hasattr(ts, 'tzinfo') else ts)
        status = "ok" if age.total_seconds() < warn_hours * 3600 else "warning"
        return {"status": status, "last_run": _format_last_run(ts)}

    return {
        "agent1": _health(a1_ts),
        "agent2": _health(a2_ts),
        "agent3": _health(a3_ts),
        "agent4": _health(a4_ts, warn_hours=168),  # runs weekly — warn after 7d
        "agent7": {"status": "not_configured", "last_run": "never"},
    }

def _keyword_search_chunks(message: str, db: Session, limit: int = 3) -> list[str]:
    """
    Keyword search on document_chunks — returns distinct source_url values whose
    content contains any word from the user message (length > 4 to skip stop words).
    Used in place of vector similarity search when pgvector is not available locally.
    """
    try:
        keywords = [w for w in message.lower().split() if len(w) > 4][:6]
        if not keywords:
            return []
        from sqlalchemy import or_
        filters = [models.DocumentChunk.content.ilike(f"%{kw}%") for kw in keywords]
        rows = (
            db.query(models.DocumentChunk.source_url)
            .filter(or_(*filters))
            .filter(models.DocumentChunk.source_url.isnot(None))
            .distinct()
            .limit(limit)
            .all()
        )
        return [r.source_url for r in rows if r.source_url]
    except Exception:
        return []


@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_knowledge_base(req: ChatRequest, db: Session = Depends(get_db)):
    if not llm:
        raise HTTPException(status_code=500, detail="LLM not configured (check OPENAI_API_KEY)")

    session_id = req.session_id or str(uuid.uuid4())

    # Retrieve relevant document chunks to surface as sources and enrich context
    sources = _keyword_search_chunks(req.message, db)

    BRAND_PROMPTS = {
        "hcllp": (
            "You are the content and knowledge assistant for Harshwal & Company LLP (HCLLP), "
            "a full-service CPA firm serving small and mid-size businesses, high-net-worth individuals, "
            "and S-Corp / LLC owners across the United States.\n\n"
            "HCLLP services: federal & state tax preparation and planning, bookkeeping, payroll, "
            "audit support, IRS representation, business entity structuring, estate planning, and "
            "QuickBooks advisory.\n\n"
            "Tone: professional, approachable, practical. Use plain English. "
            "Cite relevant IRC sections, IRS publications, or GAAP standards when helpful. "
            "Always frame answers around the needs of SMB owners and individuals. "
            "Never discuss Blue Arrow CPA tribal work or Harshwal Advisory M&A topics — "
            "those are separate brands."
        ),
        "blue_arrow_cpa": (
            "You are the content and knowledge assistant for Blue Arrow CPA, "
            "a specialist CPA firm exclusively serving tribal governments, Native American enterprises, "
            "and federally recognised tribal entities.\n\n"
            "Blue Arrow CPA services: Single Audit (2 CFR Part 200 / Uniform Guidance), SEFA preparation, "
            "federal grant compliance, Indian Gaming Regulatory Act (IGRA) compliance, tribal governmental "
            "accounting under GASB standards, sovereignty-aware financial governance, and OMB audit readiness.\n\n"
            "Tone: authoritative, compliance-focused, respectful of tribal sovereignty. "
            "Cite 2 CFR Part 200, GASB pronouncements, IGRA, and BIA regulations precisely. "
            "Never conflate tribal government accounting with commercial CPA work. "
            "Never discuss HCLLP SMB tax services or Harshwal Advisory topics."
        ),
        "advisory": (
            "You are the content and knowledge assistant for Harshwal Advisory, "
            "a strategic consulting practice focused on growth-stage companies, venture-backed startups, "
            "and founder-led businesses preparing for institutional investment or M&A transactions.\n\n"
            "Harshwal Advisory services: Series A/B/C audit readiness, due diligence preparation, "
            "revenue recognition under ASC 606, equity compensation (ASC 718), cap table clean-up, "
            "409A valuations, SAFE/convertible note structuring, financial model review, CFO-advisory, "
            "and sell-side / buy-side M&A support.\n\n"
            "Tone: strategic, investor-aware, sophisticated. Speak the language of VCs and founders. "
            "Reference ASC standards, SEC guidance, and PCAOB standards where relevant. "
            "Never discuss HCLLP SMB tax work or Blue Arrow CPA tribal compliance."
        ),
    }

    brand = req.brand if req.brand in BRAND_PROMPTS else None
    if brand:
        sys_msg = BRAND_PROMPTS[brand]
    else:
        sys_msg = (
            "You are the Harshwal Knowledge Assistant — an expert AI for Harshwal Group, "
            "which operates three brands: Harshwal & Company LLP (HCLLP) for SMB tax and CPA services, "
            "Blue Arrow CPA for tribal government accounting and federal grant compliance, and "
            "Harshwal Advisory for growth-stage company strategy and M&A readiness.\n\n"
            "Answer questions precisely and professionally. "
            "Cite specific regulations (e.g. 2 CFR Part 200, IRC Section numbers) when relevant."
        )
    if sources:
        sys_msg += (
            f"\n\nThe following knowledge base documents are relevant to this query: {', '.join(sources)}. "
            "Incorporate their context into your answer where appropriate."
        )

    user_msg = models.ChatMessage(id=str(uuid.uuid4()), session_id=session_id, role="user", content=req.message)
    reply_text = await generate_llm_response(sys_msg, req.message)

    try:
        if not req.session_id:
            new_session = models.ChatSession(id=session_id, title=req.message[:30], user_id="admin")
            db.add(new_session)

        db.add(user_msg)
        db.add(models.ChatMessage(id=str(uuid.uuid4()), session_id=session_id, role="assistant", content=reply_text))
        db.commit()
    except Exception as e:
        print(f"DB Error: {e}")
        db.rollback()

    return ChatResponse(
        reply=reply_text,
        session_id=session_id,
        sources=sources,
    )

@app.get("/api/chat/sessions")
def get_chat_sessions(db: Session = Depends(get_db)):
    try:
        sessions = db.query(models.ChatSession).order_by(models.ChatSession.created_at.desc()).all()
        return [
            {
                "id": s.id,
                "title": s.title,
                "ts": s.created_at.isoformat()
            } for s in sessions
        ]
    except Exception:
        return []

@app.get("/api/chat/sessions/{session_id}")
def get_chat_session_messages(session_id: str, db: Session = Depends(get_db)):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    messages = db.query(models.ChatMessage).filter(models.ChatMessage.session_id == session_id).order_by(models.ChatMessage.created_at.asc()).all()
    return {
        "id": session.id,
        "title": session.title,
        "ts": session.created_at.isoformat(),
        "messages": [
            {
                "id": m.id,
                "role": "ai" if m.role == "assistant" else "user",
                "content": m.content,
                "ts": m.created_at.isoformat()
            } for m in messages
        ]
    }

@app.post("/api/brand-voice/generate")
async def generate_brand_voice(req: BrandVoiceRequest, db: Session = Depends(get_db)):
    sys_prompt = f"You are a social media manager for {req.brand_name}. Write a {req.platform} post using a {req.tone} tone."
    user_prompt = f"Topic: {req.topic}"
    caption = await generate_llm_response(sys_prompt, user_prompt)
    
    try:
        record = models.BrandVoiceContent(
            brand_name=req.brand_name,
            platform=req.platform,
            tone=req.tone,
            topic=req.topic,
            generated_caption=caption
        )
        db.add(record)
        db.commit()
    except Exception as e:
        db.rollback()
        
    return {"caption": caption}

@app.get("/api/smo/posts")
def get_smo_posts(db: Session = Depends(get_db)):
    try:
        posts = db.query(models.SMOPost).order_by(models.SMOPost.created_at.desc()).all()
        return [{"id": p.id, "title": p.title, "platform": p.platform, "caption": p.caption, "tag": p.tag, "status": p.status, "age": "Just now"} for p in posts]
    except Exception:
        return []

@app.post("/api/smo/posts")
def create_smo_post(req: SMOPostRequest, db: Session = Depends(get_db)):
    try:
        new_post = models.SMOPost(
            title=req.title,
            platform=req.platform,
            caption=req.caption,
            tag=req.tag,
            status="designer_review"
        )
        db.add(new_post)
        db.commit()
        return {"status": "success", "id": new_post.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/smo/approve/{post_id}")
def approve_smo_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(models.SMOPost).filter(models.SMOPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status == "designer_review":
        post.status = "manager_review"
    elif post.status == "manager_review":
        post.status = "published"
    db.commit()
    return {"status": "success", "new_status": post.status}

@app.patch("/api/smo/edit/{post_id}")
def edit_smo_post(post_id: int, req: SMOPostEditRequest, db: Session = Depends(get_db)):
    post = db.query(models.SMOPost).filter(models.SMOPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.caption = req.caption
    db.commit()
    return {"status": "success"}

@app.patch("/api/smo/reject/{post_id}")
def reject_smo_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(models.SMOPost).filter(models.SMOPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.status = "rejected"
    db.commit()
    return {"message": "Post rejected"}

@app.get("/api/kb/stats")
def get_kb_stats(db: Session = Depends(get_db)):
    try:
        count = db.query(models.DocumentChunk).count()
    except Exception:
        count = 0
    return {
        "documents": count,
        "last_updated": "Just now",
        "model": CHAT_MODEL,
    }

from agents.pipeline import run_intelligence_pipeline, is_pipeline_running, pipeline_logs

@app.get("/api/status")
def get_agent_status():
    import agents.pipeline
    return {
        "is_running": agents.pipeline.is_pipeline_running,
        "last_run": "Just now" if agents.pipeline.pipeline_logs else "Never",
        "logs": agents.pipeline.pipeline_logs[-30:] # return last 30 logs for UI terminal
    }

@app.get("/api/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    try:
        # 1. Stats
        comp_count = db.query(models.Competitor).count()
        your_comp = db.query(models.Competitor).filter(models.Competitor.name == "Harshwal & Co.").first()
        presence_score = your_comp.presence_score if your_comp else 80
        approved_posts = db.query(models.SMOPost).filter(models.SMOPost.status == "published").count()
        doc_chunks = db.query(models.DocumentChunk).count()
        
        # 2. Activity (Synthesized from multiple tables)
        activity = []
        recent_posts = db.query(models.SMOPost).order_by(models.SMOPost.created_at.desc()).limit(3).all()
        for p in recent_posts:
            activity.append({"icon": "✓", "color": "var(--success)", "text": f"SMO post '{p.title}' added", "time": "Recently", "ts": p.created_at})
            
        recent_voices = db.query(models.BrandVoiceContent).order_by(models.BrandVoiceContent.created_at.desc()).limit(2).all()
        for v in recent_voices:
            activity.append({"icon": "✦", "color": "var(--primary)", "text": f"Brand Voice generated for {v.topic[:20]}", "time": "Recently", "ts": v.created_at})
            
        activity.sort(key=lambda x: x["ts"], reverse=True)
        activity = activity[:5]
        for a in activity:
            del a["ts"] # Cannot serialize datetime easily without custom encoder here, simple enough

        # 3. Competitors
        competitors_raw = db.query(models.Competitor).order_by(models.Competitor.presence_score.desc()).limit(5).all()
        competitors = [{"name": c.name, "score": c.presence_score, "yours": c.name == "Harshwal & Co."} for c in competitors_raw]
        if not competitors:
            # Fallback if DB empty
            competitors = [
                {"name": "Harshwal & Co.", "score": 80, "yours": True},
                {"name": "Blue Arrow CPA", "score": 72, "yours": False},
                {"name": "Moss Adams", "score": 68, "yours": False}
            ]

        # 4. Platforms
        from sqlalchemy import func
        platform_counts = db.query(models.SMOPost.platform, func.count(models.SMOPost.id)).group_by(models.SMOPost.platform).all()
        platforms = [{"platform": p[0], "count": p[1]} for p in platform_counts]
        if not platforms:
             platforms = [{"platform": "LinkedIn", "count": 0}, {"platform": "Facebook", "count": 0}, {"platform": "Instagram", "count": 0}]

        return {
            "stats": {
                "competitorsTracked": comp_count,
                "presenceScore": presence_score,
                "postsApproved": approved_posts,
                "contentDrafts": doc_chunks
            },
            "activity": activity if activity else [{"icon": "ℹ", "color": "var(--muted)", "text": "No recent activity", "time": ""}],
            "competitors": competitors,
            "platforms": platforms
        }
    except Exception as e:
        print(f"Error in stats: {e}")
        return {"error": str(e)}

@app.post("/api/agents/run")
async def run_agents(background_tasks: BackgroundTasks):
    import agents.pipeline
    if agents.pipeline.is_pipeline_running:
        return {"status": "already_running"}
    # Pass the coroutine function directly — FastAPI BackgroundTasks handles async
    background_tasks.add_task(run_intelligence_pipeline)
    return {"status": "started"}
