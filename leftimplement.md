# Harshwal Automation — Remaining Implementation Roadmap

Last updated: 2026-06-15

---

## PRIORITY 1 — Broken / 404 Pages (fix immediately)

### 1.1 Competitor Intel — Competitors Page
- **Route:** `/competitor-intel/competitors`
- **Status:** Nav links to it but the page folder does not exist → 404
- **What to build:**
  - `dashboard/src/app/competitor-intel/competitors/page.tsx`
  - List all active competitors (from `GET /api/ci/competitors`)
  - Add / Edit / Deactivate competitor form (name, industry, website, social handles)
  - "Posts collected" count per competitor from latest pipeline run

### 1.2 Competitor Intel — Analytics Page
- **Route:** `/competitor-intel/analytics`
- **Status:** Planned in nav spec but page folder + backend endpoint both missing
- **What to build:**
  - `dashboard/src/app/competitor-intel/analytics/page.tsx`
  - Top themes chart (from `CITrendReport.themes`)
  - Platform breakdown (LinkedIn vs Facebook vs Instagram)
  - Engagement score histogram for collected posts
  - Approval rate of generated content over time
  - Backend: `GET /api/ci/analytics` — aggregates across runs

---

## PRIORITY 2 — Pipeline Completion (core product)

### 2.1 Agent 7 — Social Media Analytics (post-publish tracking)
- **File to create:** `backend/agents/agent7_analytics.py`
- **What it does:**
  - After a post is published (`live_url` set on `CIGeneratedContent`), polls LinkedIn/Facebook/Instagram APIs for engagement
  - Stores likes, comments, shares, reach back on `CIGeneratedContent`
  - Compares our post performance vs competitor posts collected in same run
- **Celery task** in `celery_config.py`:
  ```python
  @app.task
  def pull_post_analytics():
      """Runs every 24h — pulls engagement for all published posts < 7 days old."""
  ```
- **Beat schedule entry:** `"pull-post-analytics": { "task": "celery_config.pull_post_analytics", "schedule": crontab(hour=6, minute=0) }`
- **DB:** Add columns to `CIGeneratedContent`: `post_likes`, `post_comments`, `post_shares`, `post_reach`

### 2.2 Publishing — OAuth Token Setup
- **Status:** `competitor_intel_publisher.py` and `agent3_publisher.py` exist but tokens are missing → publishing is a no-op
- **What's needed in `.env`:**
  ```
  LINKEDIN_ACCESS_TOKEN=...
  LINKEDIN_ORGANIZATION_ID=...
  FACEBOOK_PAGE_ID=...
  FACEBOOK_PAGE_TOKEN=...
  INSTAGRAM_BUSINESS_ACCOUNT_ID=...
  INSTAGRAM_PAGE_TOKEN=...
  ```
- **Test endpoint to add:** `GET /api/ci/publishing/test` — checks each token is valid, returns status per platform

### 2.3 SMO Weekly Brief → Publish Loop (fix broken mid-section)
- **Status:** Brief generation works, review queue works, but after approval the Celery publish task (`agent3_publish`) never gets triggered from the frontend
- **Fix:** In `review_routes.py` approve endpoint, after setting `status = "approved"`, dispatch `agent3_publish.apply_async(args=[content_id])`
- **Test:** Approve an SMO item → verify it appears as "published" with a `live_url`

---

## PRIORITY 3 — Dashboard & Reports (stakeholder-facing)

### 3.1 Dashboard Stats — Replace Mock Data
- **File:** `backend/api/` — whichever route serves `/api/dashboard/stats`
- **Status:** Returns hardcoded numbers
- **Real data to aggregate:**
  - Total posts published (MongoDB `content_library` where `status=published` + `CIGeneratedContent` where `status=published`)
  - Pending review count (both pipelines)
  - Latest CI pipeline run status + step
  - Agent health summary
  - Top performing post this week (highest engagement)
- **Frontend:** `dashboard/src/app/page.tsx` — wire stats cards to real API

### 3.2 Reports Page — Complete HTML Builder
- **File:** `backend/api/report_routes.py`
- **Status:** `GenerateReportRequest` model exists, HTML builder is a stub
- **What to build:**
  - `POST /api/reports/generate` — builds HTML report with:
    - Pipeline run summary (posts collected, scored, generated, approved)
    - Top 5 content pieces (headline + quality scores)
    - Trend themes from `CITrendReport`
    - Platform engagement breakdown
  - `GET /api/reports/list` — list past reports
  - PDF export option (use `weasyprint` or return HTML for browser print)
- **Frontend:** `dashboard/src/app/reports/page.tsx` — "Generate Report" button + report history list

### 3.3 WhatsApp Notifications — Wire Twilio
- **File:** `backend/notifications/whatsapp.py`
- **Status:** Stub — all functions are no-ops
- **Needs in `.env`:**
  ```
  TWILIO_ACCOUNT_SID=...
  TWILIO_AUTH_TOKEN=...
  TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
  WHATSAPP_NOTIFY_NUMBER=whatsapp:+91XXXXXXXXXX
  ```
- **Functions to implement:**
  - `send_review_reminder(brief_count, flag_count)` — fires Wednesday 9 AM (beat already scheduled)
  - `send_engagement_velocity_whatsapp(post_title, brand, platform, live_url)` — fires 60s after publish

---

## PRIORITY 4 — Missing Features (product completeness)

### 4.1 Brand Voice — List & Browse Page
- **Route:** `/brand-voice`
- **Status:** Generation works but saved brand voices can't be listed/recalled
- **Backend to add:**
  - `GET /api/brand-voice/list` — returns all saved brand voice profiles (from MongoDB `brand_voice` collection or PostgreSQL)
  - `GET /api/brand-voice/{id}` — fetch single profile
  - `DELETE /api/brand-voice/{id}`
- **Frontend:** Update `dashboard/src/app/brand-voice/page.tsx` to show saved voices as cards + ability to activate one per brand

### 4.2 Designer Queue — Dedicated Approval Flow
- **Route:** `/designer-queue`
- **Status:** Page is a filtered view of review queue — no designer-specific workflow
- **What's needed:**
  - "Cultural Gate" approval step: designer marks visual/cultural fit before DM leader final approve
  - Backend: add `designer_approved: bool` field to `content_library`
  - `PATCH /api/review/designer-approve/{id}` — only accessible by `role=designer`
  - Notify DM leader via WhatsApp when designer approves

### 4.3 Chat / Knowledge Base
- **Status:** `ChatSession`, `ChatMessage`, `DocumentChunk` models exist in PostgreSQL but no frontend or registered routes
- **What to build:**
  - `backend/api/chat_routes.py` — `POST /api/chat/message`, `GET /api/chat/history`
  - Document upload endpoint: `POST /api/kb/upload` — chunks PDF/DOCX and stores in `DocumentChunk` with pgvector embeddings
  - `dashboard/src/app/chat/page.tsx` — simple chat UI, RAG over uploaded documents
  - Register routes in `main.py`

---

## PRIORITY 5 — Infrastructure & Security

### 5.1 Environment Variables — Complete `.env`
All missing values that cause silent failures:
```env
# AI
OPENAI_API_KEY=sk-...

# Social Publishing
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_ORGANIZATION_ID=
FACEBOOK_PAGE_ID=
FACEBOOK_PAGE_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
INSTAGRAM_PAGE_TOKEN=

# Notifications
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
WHATSAPP_NOTIFY_NUMBER=

# Storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
S3_BUCKET=

# Security
JWT_SECRET=change-this-to-a-random-64-char-string

# Database
DATABASE_URL=postgresql://...
MONGO_URI=mongodb://localhost:27017/harshwal
REDIS_URL=redis://localhost:6379/0
```

### 5.2 Process Management — Windows Services
- **Status:** Backend, Celery worker, and Celery beat are started manually in terminal windows
- **Fix:** Create `start_all.bat` in project root:
  ```bat
  start "Backend"        cmd /k "cd backend && uvicorn main:app --reload --port 8000"
  start "Celery Worker"  cmd /k "cd backend && celery -A celery_config worker --loglevel=info"
  start "Celery Beat"    cmd /k "cd backend && celery -A celery_config beat --loglevel=info"
  start "Frontend"       cmd /k "cd dashboard && npm run dev"
  ```
- Long-term: use PM2 or NSSM to run as Windows services

### 5.3 Role-Based Access — Tighten Up
- `dm_leader` should not see Designer Queue
- `designer` should only see Designer Queue + Library
- Verify all API routes call `check_permission()` — some endpoints may be unprotected
- Add middleware-level route guard in Next.js (`middleware.ts`) to redirect unauthorized users

---

## PRIORITY 6 — Quality of Life

### 6.1 CI Pipeline — Real-time Progress UI
- **Status:** Pipeline runs in background; user has to manually check logs
- **What to build:** Poll `GET /api/ci/runs/{run_id}` every 5s while run is active, show step progress bar in the Generated Content page or a toast notification

### 6.2 Mobile Responsiveness
- Calendar page, Generated Content review cards, and Reports page are not mobile-friendly
- Add responsive breakpoints for screens < 768px

### 6.3 Error Boundaries
- Wrap all major pages in a React error boundary so one broken component doesn't blank the whole page

### 6.4 Pagination
- `GET /api/ci/generated` returns up to 100 records — needs cursor/page pagination for large runs
- `GET /api/library/assets` same issue

---

## Summary Count

| Priority | Items | Effort |
|---|---|---|
| P1 — Broken pages | 2 | 1–2 days |
| P2 — Pipeline completion | 3 | 3–5 days |
| P3 — Dashboard & Reports | 3 | 2–3 days |
| P4 — Missing features | 3 | 3–4 days |
| P5 — Infrastructure | 3 | 1 day |
| P6 — Quality of life | 4 | 2–3 days |
| **Total** | **18** | **~2–3 weeks** |
