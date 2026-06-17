from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    source_url = Column(String, index=True)
    content = Column(Text)
    embedding = Column(Text)  # Text for local dev; use pgvector Vector(1536) in production
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True) # UUID
    title = Column(String)
    user_id = Column(String, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, index=True) # UUID
    session_id = Column(String, ForeignKey("chat_sessions.id"))
    role = Column(String) # 'user' or 'assistant'
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    session = relationship("ChatSession", back_populates="messages")

class SMOPost(Base):
    __tablename__ = "smo_posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    platform = Column(String) # LinkedIn, Facebook, Instagram
    caption = Column(Text)
    tag = Column(String)
    status = Column(String, default="designer_review") # designer_review, manager_review, published, rejected
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class BrandVoiceContent(Base):
    __tablename__ = "brand_voice_contents"

    id = Column(Integer, primary_key=True, index=True)
    brand_name = Column(String, index=True)
    platform = Column(String)
    tone = Column(String)
    topic = Column(Text)
    generated_caption = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Competitor(Base):
    __tablename__ = "competitors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    website_url = Column(String, unique=True, index=True)
    presence_score = Column(Integer, default=0)
    is_active = Column(Integer, default=1) # 1=active, 0=parked/dead
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class SMOEvent(Base):
    __tablename__ = "smo_events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    category = Column(String)
    event_date = Column(DateTime(timezone=True))
    region = Column(String)
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── Competitor Intelligence ───────────────────────────────────────────────────

class CICompetitor(Base):
    __tablename__ = "ci_competitors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    industry = Column(String, default="CPA / Accounting")
    website = Column(String)
    linkedin_handle = Column(String)
    facebook_handle = Column(String)
    instagram_handle = Column(String)
    twitter_handle = Column(String)
    youtube_handle = Column(String)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    posts = relationship("CISocialPost", back_populates="competitor", cascade="all, delete-orphan")


class CISocialPost(Base):
    __tablename__ = "ci_social_posts"

    id = Column(Integer, primary_key=True, index=True)
    competitor_id = Column(Integer, ForeignKey("ci_competitors.id"), index=True)
    run_id = Column(Integer, ForeignKey("ci_pipeline_runs.id"), index=True)
    platform = Column(String, index=True)
    post_id = Column(String)
    post_url = Column(String)
    content = Column(Text)
    media_urls = Column(Text)
    published_at = Column(DateTime(timezone=True))
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    reposts = Column(Integer, default=0)
    views = Column(Integer, default=0)
    engagement_score = Column(Integer, default=0)
    rank = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    competitor = relationship("CICompetitor", back_populates="posts")


class CIPipelineRun(Base):
    __tablename__ = "ci_pipeline_runs"

    id = Column(Integer, primary_key=True, index=True)
    triggered_by = Column(String, default="manual")
    status = Column(String, default="pending")   # pending / running / completed / failed
    step = Column(String, default="")
    posts_collected = Column(Integer, default=0)
    posts_scored = Column(Integer, default=0)
    posts_top = Column(Integer, default=0)
    content_generated = Column(Integer, default=0)
    logs = Column(Text, default="")
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))


class CITrendReport(Base):
    __tablename__ = "ci_trend_reports"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("ci_pipeline_runs.id"), index=True, unique=True)
    themes = Column(Text)
    writing_styles = Column(Text)
    hook_patterns = Column(Text)
    cta_patterns = Column(Text)
    summary = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CIGeneratedContent(Base):
    __tablename__ = "ci_generated_content"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("ci_pipeline_runs.id"), index=True)
    brand = Column(String, index=True)
    platform = Column(String, index=True)
    headline = Column(String)
    content = Column(Text)
    cta = Column(String)
    hashtags = Column(Text)
    inspiration_post_ids = Column(Text)
    quality_brand_score = Column(Integer, default=0)
    quality_originality_score = Column(Integer, default=0)
    quality_readability_score = Column(Integer, default=0)
    image_prompt = Column(Text)
    live_url = Column(String)
    status = Column(String, default="draft", index=True)
    source_type = Column(String, default="competitor_intel", index=True)  # competitor_intel | calendar_event
    calendar_event_id = Column(Integer, nullable=True)
    calendar_event_name = Column(String, nullable=True)
    rejection_reason = Column(Text)
    scheduled_at = Column(DateTime(timezone=True))
    published_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CIScheduleConfig(Base):
    __tablename__ = "ci_schedule_config"

    id = Column(Integer, primary_key=True, index=True)
    cron_hour = Column(Integer, default=3)
    cron_minute = Column(Integer, default=0)
    is_enabled = Column(Integer, default=0)
    days_back = Column(Integer, default=7)
    top_n = Column(Integer, default=30)
    weight_likes = Column(Integer, default=1)
    weight_comments = Column(Integer, default=3)
    weight_shares = Column(Integer, default=5)
    weight_views = Column(Integer, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CICalendarEvent(Base):
    __tablename__ = "ci_calendar_events"

    id = Column(Integer, primary_key=True, index=True)
    event_date = Column(DateTime(timezone=True), index=True)   # exact date of the event
    event_name = Column(String)                                 # e.g. "Tax Filing Deadline"
    event_type = Column(String, default="general")             # general / deadline / campaign / holiday / webinar
    brand = Column(String, default="all")                      # hcllp / blue_arrow_cpa / advisory / all
    platforms = Column(Text, default="linkedin,facebook")       # comma-separated
    notes = Column(Text)                                        # extra context for AI
    days_before = Column(Integer, default=3)                    # generate content N days before event
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

