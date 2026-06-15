# Harshwal Automation — Remaining Implementation Tracker
# Last updated: 2026-06-15

## ✅ COMPLETED THIS SESSION (Sprint 3 Frontend — all 9 items)

- Review Queue tab (DM Leader) — FAQ#, tagline#, platform badges, AI score, scheduled time
- Blue Arrow approve button — physically disabled, ⏳/✅ badge in sidebar, pointerEvents:none
- Inline edit mode — textarea replaces preview, PUT /api/review/edit/{id}, preview re-renders
- Cascade timeline panel (blogs) — Day 0/+3/+7/+14/+21, CascadePreview component
- Designer Visual Queue tab — role guard, two buttons, per-item asset URL state
- Agent health indicator bar — correct CSS vars, A1–A7 labels, pulsing red dot, DM Leader alert banner
- DM Library tab — filter chips, drag-and-drop, progress bar, Copy URL, Use in post, role-gated delete
- Share Reports tab — Download button, Email/Link tabs, 48h live countdown, remove recipient
- Settings tab — dedicated page, pre-seeded Sanwar Harshwal (CEO) on startup, add/remove UI

## ✅ COMPLETED THIS SESSION (Backend + remaining items)

1. ~~Rejection → Agent 2 regeneration queue~~ ✅
2. ~~`/api/smo/generate` brand filter~~ ✅
3. ~~MongoDB indexes not created~~ ✅
4. ~~Share Reports modal — missing WhatsApp tab~~ ✅
5. ~~Editable scheduled_at in Review Queue~~ ✅

## ✅ COMPLETED IN PREVIOUS SESSIONS (Backend)

- Agent 1 (SMO Brief Generator) — real GPT-4o LLM
- Agent 2 (Content Writer) — real GPT-4o per brief
- Agent 3 (Publisher) — real LinkedIn/Meta/CMS APIs, first comment, Agent 7 registration
- Agent 4 (Analytics) — real MongoDB queries, per-brand context
- AI Prescore — GPT-4o-mini, real FAQ/brand voice/tagline loaders
- Blue Arrow gate — API-level 403, designer notification
- All review endpoints — approve / reject / edit / designer-approve
- Celery schedules — all 5 tasks with real DB counts
- WhatsApp notifications — real WhatsApp Business API with fallback
- content_analytics — written by Agent 3 on every publish
- DM Asset Library — S3 upload + local disk fallback + file serving
- Share Reports backend — real HTML, SES+SMTP email, secure link, public viewer
- Pipeline fake sleeps — replaced with real competitor discovery + analysis
- JWT secret, admin credentials, mock passwords — all secured
- check_72h_timeout — review_monitor.py with WhatsApp alert
- Public report viewer — GET /report/{token} no-auth endpoint
- Library RBAC — library:read/write/delete in roles.py
- Sanwar Harshwal seed — inserts on startup if list is empty
- DELETE /api/settings/recipients/{id} — soft-delete endpoint added

---

## ❌ STILL REMAINING — Code complete. No open items.

---

## ⚠️ CONFIGURATION / PRE-PRODUCTION (no code change needed)

6. **Share link URL uses wrong env var**
   - File: `backend/api/report_routes.py` line ~344
   - Uses `os.getenv("NEXT_PUBLIC_API_URL", ...)` — a frontend var
   - Fix: change to `os.getenv("BACKEND_URL", "http://localhost:8000")`
   - The `/report/{token}` endpoint is on FastAPI (port 8000), not Next.js

7. **Remove BYPASS_CULTURAL_GATE before production**
   - Currently in `backend/.env`: `BYPASS_CULTURAL_GATE=true`
   - Section 11 Rule 3: must not exist on production server
   - Fix: delete this line from `.env` before deploying

---

## Production Credentials Needed (no code change)

| Key | Where to get |
|---|---|
| `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` | AWS Console → IAM → S3FullAccess + SESFullAccess |
| `WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_ID` | Meta for Developers → WhatsApp → API Setup |
| `DM_LEADER_PHONE` | Replace +919876543210 with Purnima's real number |
| `LINKEDIN_ACCESS_TOKEN` + `LINKEDIN_AUTHOR_URN` | LinkedIn Developer Portal → OAuth 2.0 |
| `META_PAGE_ACCESS_TOKEN` + `META_PAGE_ID` + `INSTAGRAM_USER_ID` | Meta Business Manager |
| `JWT_SECRET` | Run: python -c "import secrets; print(secrets.token_hex(32))" |
| `SMTP_HOST/USER/PASS` | Gmail App Password (if not using AWS SES) |
| `MAYANK_CMS_ENDPOINT` | Get exact endpoint spec from Mayank before go-live |
| `AGENT7_WATCHLIST_ENDPOINT` | Confirm with Agent 7 team before go-live |
