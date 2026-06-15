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
    region = Column(String) # e.g., 'India', 'USA'
    status = Column(String, default="pending") # pending, approved, published
    created_at = Column(DateTime(timezone=True), server_default=func.now())

