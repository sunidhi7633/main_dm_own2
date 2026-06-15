ARSHWAL GROUP · NIVESH · SMO × DM Dashboard Integration
TECHNICAL BRIEFv1.0 · 2026⬇ Export PDF
Implementation brief · For Nivesh · Harshwal GroupSMO × DM Dashboard
Integration Spec
Everything you need to connect the SMO Growth Engine (Agents 1, 2, 3) to the existing DM Dashboard and Purnima's mandatory review pipeline. MongoDB schema changes, new FastAPI endpoints, Celery schedules, React dashboard UI, WhatsApp notification templates, and RBAC updates — all in one document.
🏗Stack: Python · FastAPI · MongoDB · React · Celery · Redis
🤖AI: Claude Haiku (pre-screen) · Claude Sonnet (content)
⚡Existing infra: Jaipur campus server + AWS
00
Overview — What you are building
7-layer automated pipeline that takes SMO content from generation to publication — with Purnima's mandatory review gate in the middle. Nothing publishes without her approval.
⛔
Prime directive — never auto-publish
The AI pre-screen is a quality filter to reduce Purnima's workload — it is not an auto-publisher. Every post must receive an explicit approval signal from DM Leader before Agent 3 fires. Build the system so that bypassing this gate is architecturally impossible, not just discouraged.
🏹
Blue Arrow cultural gate — hardcoded lock, not a reminder
If brand = blue_arrow_cpa and designer_approved = false, the approve button in the DM Leader UI must be physically disabled. This is a UI state driven by a database field — not a toast warning, not a confirmation dialog. The Designer sets the flag; without it, Purnima cannot proceed even if she wants to. No admin override. No test bypass.
🔗
Integration target — existing Trenoxa / HCIS system
This integrates into your existing hcis MongoDB database, FastAPI backend, and React dashboard. You are adding new collections, new API routes, and new dashboard views — not rebuilding what exists. The SMO agents write to the same MongoDB instance Trenoxa already uses.
01
Full integration flow
7 layers from agent generation to live post. Each layer maps to a specific code change below.
Agent 1 — SMO
Brief gen · Mon 8AM
→
Agent 2 — Creator
Post / Reel / Blog
→
hcis.content_library
status = pending
→
Claude Haiku
Pre-screen · score 0–100
↓
Score < 70
Auto-held
Score ≥ 70
Enters queue
↓
Blue Arrow?
Designer gate
→
DM Leader review
Approve / Edit / Reject
→
Agent 3
Publishes + cascade
L1
Generation — Agents 1 + 2 (fully automated)
Agent 1 runs Monday 8:00 AM via Celery. Pulls events (Perplexity), competitor gaps (hcis.content_prompts), top-performing themes from Agent 4. Generates 7–10 briefs and stores in hcis.smo_briefs with status = draft. Agent 2 picks up approved briefs and writes full content: post body, Reel script, carousel copy, caption variants, meta description. Output written to hcis.content_library with status = pending_prescore.
L2
Queue — MongoDB hcis.content_library
Each content item stored with: brand, platform[], content_body, faq_num, tagline_num, utm_params, scheduled_at, status, designer_approved, ai_prescore, smo_generated. This is the single source of truth for all content — both SMO-generated and Trenoxa-generated items live here.
L3
AI pre-screen — Claude Haiku (new, automated)
Celery task fires 30 minutes after each content batch is generated. Sends each item to Claude Haiku with a scoring prompt. Returns {score: 0-100, brand_voice_match: bool, faq_verified: bool, cultural_check: bool, flag_reason: string}. Score ≥ 70: update status = pending_review. Score < 70: update status = flagged + WhatsApp to DM Leader. Full pre-screen spec in Section 03.
L4
Blue Arrow gate — database field + UI lock
For any item where brand = blue_arrow_cpa: system checks designer_approved field. If false, item appears in DM Leader queue with approve button disabled. Designer sees a separate queue of Blue Arrow visuals — they click "Approve Visual" or "Override with Custom" — both set designer_approved = true. Only then does Purnima's approve button enable. PATCH endpoint: /api/review/designer-approve/{id}.
L5
DM Leader review — dashboard queue (mandatory)
New "Review Queue" tab in DM Leader React dashboard. Shows all status = pending_review items with: full rendered post preview, FAQ# and tagline# used, platform badges, proposed publish time, AI pre-screen score, and for Blue Arrow items — Designer confirmation badge. Three actions: Approve (→ Agent 3), Edit inline (edits body then approves), Reject (writes reason, returns to Agent 2).
L6
Agent 3 publish — triggered by approval signal only
When DM Leader approves, status updates to approved and a Celery task is created for the exact scheduled_at time. At publish time: Agent 3 posts to LinkedIn API + Meta Graph API + Python website CMS, appends UTM tags, logs live URL back to content_library, posts the CTA link as first comment, fires engagement velocity WhatsApp to DM Leader + 2 team members, and registers the blog URL with Agent 7's watchlist.
L7
Feedback loop — Agent 4 → Agent 1 (closes the loop)
Every Monday 7:30 AM, Agent 4 queries hcis.content_analytics for the top 5 posts by saves and engagement from the previous 7 days. Writes a performance summary to hcis.agent1_brief_context. Agent 1 reads this at 8:00 AM and includes top-performing topics and formats in the new brief generation prompt. The system learns what works without any human input.
02
MongoDB schema changes
New fields on existing hcis.content_library + two new collections. No existing fields modified.
🗄
Existing database: hcis · No breaking changes
All additions are additive. Existing Trenoxa documents will not have the new fields — handle with .get('smo_generated', False) defaults in all queries. Do not rename or remove any existing fields.
Python — PyMongomigrations/add_smo_fields.pyCopy
# Add new fields to all existing content_library documents # Run once on first deployment from pymongo import MongoClient db = MongoClient()["hcis"] # 1. New fields on hcis.content_library db.content_library.update_many( {}, {"$set": { "smo_generated": False, # True = came from Agent 1/2 "designer_approved": False, # Blue Arrow gate flag "ai_prescore": None, # {score, brand_voice, faq_verified, ...} "engagement_velocity_sent": False, # 60-min WhatsApp fired? "live_url": None, # Populated by Agent 3 after publish "rejection_reason": None, # DM Leader rejection text "cascade_parent_id": None, # Blog ID if this is a cascade post }} ) # 2. Create new collection: hcis.smo_briefs # Agent 1 writes here. Agent 2 reads here. # Schema per document: smo_brief_schema = { "_id": "ObjectId", "brand": "str", # hcllp | blue_arrow_cpa | advisory "topic": "str", "hook_suggestion": "str", "format": "str", # carousel | reel | text | blog "faq_num": "int", "tagline_num": "int", "target_hashtags": ["str"], "best_post_time": "str", # e.g. "Tuesday 07:30 IST" "competitor_gap": "str | None", # if sourced from competitor analysis "status": "str", # draft | approved_for_writing | written "created_at": "datetime", } # 3. Create new collection: hcis.agent1_brief_context # Agent 4 writes performance data here every Monday 7:30 AM # Agent 1 reads this at 8:00 AM before generating briefs brief_context_schema = { "week_start": "datetime", "top_topics": ["str"], # top 5 topics by engagement "top_formats": ["str"], # e.g. ["carousel", "text-only"] "worst_topics": ["str"], # avoid these this week "top_faq_nums": ["int"], # FAQ numbers that drove most saves "notes": "str", # plain-text summary for Agent 1 prompt }
📋
Status field values for hcis.content_library
pending_prescore → generated, waiting for Claude Haiku pre-screen
pending_review → passed pre-screen, in DM Leader queue
flagged → failed pre-screen, on hold, DM Leader alerted
designer_pending → Blue Arrow, awaiting Designer visual approval
approved → DM Leader approved, Celery task created
published → Agent 3 successfully published, live_url logged
rejected → DM Leader rejected, rejection_reason logged
regenerating → sent back to Agent 2 after rejection
Python — PyMongo Indexmigrations/create_indexes.pyCopy
# Required indexes for performance — run once db.content_library.create_index([("status", 1), ("brand", 1)]) db.content_library.create_index([("scheduled_at", 1)]) db.content_library.create_index([("smo_generated", 1)]) db.smo_briefs.create_index([("status", 1), ("brand", 1)]) db.agent1_brief_context.create_index([("week_start", -1)])
03
Claude AI pre-screen
Haiku call that scores every generated post before it reaches Purnima. Reduces her review queue by ~60%. Score threshold: 70.
Pythonagents/prescore_agent.pyCopy
import anthropic from datetime import datetime client = anthropic.Anthropic() def prescore_content(content_item: dict) -> dict: """ Score a content item against brand voice, FAQ accuracy, and cultural sensitivity (Blue Arrow only). Returns: {score, brand_voice_match, faq_verified, cultural_check, passed, flag_reason} """ brand = content_item["brand"] body = content_item["content_body"] faq_num = content_item.get("faq_num") tagline_num = content_item.get("tagline_num") # Load FAQ + brand voice from your existing bank faq_text = load_faq(faq_num) voice_guide = load_brand_voice(brand) tagline_text = load_tagline(tagline_num) cultural_instruction = "" if brand == "blue_arrow_cpa": cultural_instruction = """ Extra check required — Blue Arrow CPA serves tribal governments. Verify: no generalised "Native American" language (use specific sovereignty terms), no stereotyped imagery descriptions, SEFA and 2 CFR Part 200 references are accurate, tone is respectful and community-first. Score cultural_check True/False. """ prompt = f"""You are a content quality reviewer for {brand}. BRAND VOICE GUIDE: {voice_guide} FAQ #{faq_num}: {faq_text} TAGLINE #{tagline_num}: {tagline_text} CONTENT TO REVIEW: {body} {cultural_instruction} Review this content and respond ONLY with valid JSON: {{ "score": 0-100, "brand_voice_match": true/false, "faq_verified": true/false, "cultural_check": true/false, "flag_reason": "string or null if no issues", "brief_notes": "max 1 sentence of feedback" }} Scoring guide: - 90-100: publish-ready, strong voice, verified facts - 70-89: acceptable, minor improvements possible - 50-69: brand voice issues or unverified claims — hold for DM review - Below 50: clear problems — auto-flag """ response = client.messages.create( model="claude-haiku-4-5-20251001", max_tokens=256, messages=[{"role": "user", "content": prompt}] ) import json result = json.loads(response.content[0].text) result["passed"] = result["score"] >= 70 result["scored_at"] = datetime.utcnow() return result def run_prescore_batch(): """Celery task — score all pending_prescore items""" items = db.content_library.find({"status": "pending_prescore"}) for item in items: result = prescore_content(item) new_status = "pending_review" if result["passed"] else "flagged" # Blue Arrow: override to designer_pending if passed but needs visual review if result["passed"] and item["brand"] == "blue_arrow_cpa": new_status = "designer_pending" db.content_library.update_one( {"_id": item["_id"]}, {"$set": { "status": new_status, "ai_prescore": result, }} ) if not result["passed"]: send_whatsapp_flag_alert(item, result["flag_reason"]) elif new_status == "designer_pending": notify_designer_visual_queue(item)
04
FastAPI endpoints — new routes
Add all of these to your existing FastAPI app. Prefix: /api/review and /api/smo.
GET
/api/review/queue
Returns all status = pending_review items for DM Leader dashboard. Include: full content body, ai_prescore object, brand, platform[], scheduled_at, designer_approved flag. Sort by scheduled_at ascending. Requires DM Leader role.
Used by: React Review Queue tab · Called on page load and every 5 min via polling
POST
/api/review/approve/{content_id}
DM Leader approves a post. Updates status = approved, records approved_by + approved_at. Creates Celery task for scheduled_at time. Returns {"status": "ok", "celery_task_id": "..."}. Must reject if Blue Arrow and designer_approved = false — return 403 with message.
Body: {"scheduled_at": "ISO datetime"} (DM Leader can adjust time)
POST
/api/review/reject/{content_id}
DM Leader rejects a post. Updates status = rejected, stores rejection_reason. Triggers Agent 2 regeneration task with the reason injected into the brief prompt. Returns {"status": "ok", "regeneration_queued": true}.
Body: {"reason": "string"}
PUT
/api/review/edit/{content_id}
DM Leader edits post body inline before approving. Updates content_body and sets dm_edited = true. Does not change status — DM Leader must still click Approve separately. Keeps original body in original_content_body for audit.
Body: {"content_body": "updated text"}
POST
/api/review/designer-approve/{content_id}
Designer sets visual approval for Blue Arrow content. Sets designer_approved = true, records designer_approved_by + timestamp. Updates status = pending_review. Triggers WhatsApp to DM Leader: "Blue Arrow item ready for your review." Designer role only — 403 for all other roles.
Body: {"action": "approve" | "override_with_custom", "asset_url": "optional"}
POST
/api/smo/generate
Manually trigger Agent 1 brief generation (in addition to Monday 8AM Celery schedule). DM Leader can trigger ad-hoc. Queues the brief generation Celery task. Returns {"task_id": "...", "expected_completion": "..."}. DM Leader role required.
No body required · Optional: {"brand": "hcllp" | "blue_arrow_cpa" | "advisory"}
GET
/api/analytics/performance-summary
Returns performance summary for Agent 1 brief context. Aggregates hcis.content_analytics: top 5 posts by saves, top 3 formats by engagement, top FAQ numbers, underperforming topics. Agent 4 writes to hcis.agent1_brief_context — this endpoint reads the latest document.
Called by Agent 1 every Monday 7:55 AM before brief generation
GET
/api/review/cascade-preview/{content_id}
For blog posts — returns the cascade schedule: which social posts will auto-fire on Day 0, +3, +7, +14, +21 after this blog publishes. DM Leader sees this in the review panel before approving. Returns an array of {day_offset, platform, content_summary}.
Used in Review Queue UI to show cascade timeline panel
05
Celery schedule additions
Add these to your existing celery_config.py beat schedule. Do not modify existing tasks.
Python — Celery Beatcelery_config.py — add to CELERYBEAT_SCHEDULECopy
from celery.schedules import crontab CELERYBEAT_SCHEDULE = { # ── EXISTING TASKS (do not modify) ────────────────── # ... your existing tasks ... # ── NEW SMO INTEGRATION TASKS ─────────────────────── "smo-agent1-brief-gen": { "task": "agents.smo_agent.generate_weekly_briefs", "schedule": crontab(hour=8, minute=0, day_of_week="mon"), # IST = UTC+5:30, so UTC 02:30 Monday }, "smo-agent4-performance-pull": { "task": "agents.analytics_agent.write_brief_context", "schedule": crontab(hour=7, minute=30, day_of_week="mon"), # Must run BEFORE brief gen at 8:00 AM }, "smo-prescore-batch": { "task": "agents.prescore_agent.run_prescore_batch", "schedule": crontab(hour=8, minute=30, day_of_week="mon"), # 30 min after Agent 2 has written content }, "smo-review-reminder": { "task": "notifications.whatsapp.send_review_reminder", "schedule": crontab(hour=9, minute=0, day_of_week="wed"), # Wednesday 9AM — content batch ready WhatsApp to DM Leader }, "smo-check-approval-timeout": { "task": "agents.review_monitor.check_72h_timeout", "schedule": crontab(hour=9, minute=0), # daily 9AM # If any item has been pending_review > 72h, send Teams escalation }, # Dynamic per-post publish tasks are created via: # agent3_publish_task.apply_async(args=[content_id], eta=scheduled_at) # These are NOT beat tasks — created on DM Leader approval } # Engagement velocity task — created at publish time # Add this in your publish_content() function: def publish_content(content_id): # ... your publish logic ... # Fire engagement velocity WhatsApp immediately after publish send_engagement_velocity_whatsapp.apply_async( args=[content_id, live_url], countdown=60 # 60 seconds after publish )
06
Dashboard UI changes — React
New Review Queue tab + cascade preview panel in the existing DM Leader dashboard. Add to your React frontend.
Review Queue TabCRITICAL
New tab in DM Leader dashboard. Fetches GET /api/review/queue every 5 minutes.
Each item shows:
• Full post preview (exact LinkedIn/IG/FB render)
• FAQ# · Tagline# used
• Platform badges (LinkedIn / IG / FB)
• AI pre-screen score (with green/amber/red indicator)
• Proposed publish date/time (editable)
• For Blue Arrow: Designer approval status badge
• 3 action buttons: Approve · Edit · Reject
Blue Arrow Approve Button LockCRITICAL
The Approve button for Blue Arrow items must be disabled (disabled={!item.designer_approved}) when designer_approved = false.
Show a status badge: "⏳ Waiting for Designer review" when locked.
Show: "✅ Designer approved" when unlocked.
Do not use a tooltip or warning — the button must be physically unclickable. This is not optional.
Inline Edit ModeHIGH
DM Leader can click "Edit" on any post to enter inline edit mode. A <textarea> replaces the preview with the post body. On save: PUT /api/review/edit/{id}.
After editing, Approve button becomes active. The preview re-renders with the edited text before DM Leader approves.
Cascade Timeline PanelHIGH
For blog post items: expand to show the cascade schedule. Calls GET /api/review/cascade-preview/{id}.
Renders a small timeline: Day 0 (blog publish) → Day +3 (stat post) → Day +7 (quote card) → Day +14 (did you know) → Day +21 (re-share).
DM Leader approves the blog once — all cascade posts are created automatically.
Designer Visual QueueHIGH
Designer role sees a separate tab: "Visual Review" — shows all Blue Arrow items with status = designer_pending.
Two buttons: "Approve Visual" and "Upload Custom Asset". Both call POST /api/review/designer-approve/{id}. On approval, WhatsApp auto-sends to DM Leader.
This tab is hidden from all other roles.
Agent Health IndicatorsMEDIUM
Small status bar in DM Leader dashboard header: live dot per agent (green = last run OK, amber = last run >24h ago, red = last run failed).
Poll GET /api/agents/health every 2 minutes. Show: Agent 1 · Agent 2 · Agent 3 · Agent 4 · Agent 7.
Red status = DM Leader sees alert immediately without opening a separate view.
07
Approval gate enforcement — code-level
These checks must exist in the API layer — not just the UI. A direct API call must also be blocked.
Python — FastAPIapi/review_routes.pyCopy
from fastapi import HTTPException @router.post("/api/review/approve/{content_id}") async def approve_content(content_id: str, current_user = Depends(get_current_user)): # Gate 1: DM Leader role only if current_user.role != "dm_leader": raise HTTPException(403, "Only DM Leader can approve content") item = db.content_library.find_one({"_id": content_id}) if not item: raise HTTPException(404, "Content item not found") # Gate 2: Must be in pending_review status if item["status"] != "pending_review": raise HTTPException(400, f"Cannot approve item with status: {item['status']}") # Gate 3: Blue Arrow cultural gate — HARD BLOCK if item["brand"] == "blue_arrow_cpa" and not item.get("designer_approved", False): raise HTTPException( 403, "Blue Arrow CPA content requires Designer cultural review approval first. " "designer_approved must be True before this item can be approved." ) # All gates passed — proceed with approval scheduled_at = request.scheduled_at or item["scheduled_at"] db.content_library.update_one( {"_id": content_id}, {"$set": { "status": "approved", "approved_by": current_user.id, "approved_at": datetime.utcnow(), "scheduled_at": scheduled_at, }} ) # Create Celery task for exact publish time task = agent3_publish.apply_async( args=[content_id], eta=scheduled_at ) return {"status": "ok", "celery_task_id": task.id}
08
WhatsApp notification templates
Add all of these to your WhatsApp Business API integration. Trigger points are listed for each.
Trigger: Monday 8:45 AM — Agent 1 brief gen complete
📋 Weekly briefs ready — {brief_count} topics across 3 brands. SEO Exec review: complete. ⚠️ Flagged items: {flag_count} Open dashboard by 10 AM: {dashboard_url}
→ TO: DM Leader (Purnima)Celery task: smo-review-reminder
Trigger: Wednesday 9:00 AM — content batch ready
✅ Content batch ready — {post_count} posts + visuals. Brands: HCLLP {hcllp_count} · Blue Arrow {ba_count} · Advisory {adv_count} Designer check: COMPLETE Open dashboard to approve: {dashboard_url}
→ TO: DM LeaderCelery beat: Wednesday 9AM IST
Trigger: Content flagged by AI pre-screen (immediate)
⚠️ Content held — AI quality check. Brand: {brand} · Platform: {platform} Reason: {flag_reason} Score: {score}/100 Review now: {dashboard_url}
→ TO: DM LeaderFires from: prescore_agent.py on status=flagged
Trigger: Blue Arrow Designer approval complete
🏹 Blue Arrow visual approved by Designer. Item: {content_summary} Platform: {platform} Your approval is now unlocked. Review: {dashboard_url}
→ TO: DM LeaderFires from: POST /api/review/designer-approve
Trigger: T+60 seconds after post goes live (engagement velocity)
🚀 Post live — please engage NOW (algorithm window). "{post_title}" Brand: {brand} · Platform: {platform} Link: {live_url} First 60 min = 3× reach. Comment something meaningful.
→ TO: DM Leader + 2 team membersCelery: apply_async countdown=60
Trigger: Any item pending_review > 72 hours without action
⏰ Action needed — {item_count} posts awaiting your approval. Oldest item: {oldest_item_hours}h in queue. Scheduled publish in: {hours_until_publish}h. Open dashboard: {dashboard_url}
→ TO: DM LeaderCelery daily: check_72h_timeout · also send Teams message
09
RBAC changes — new Designer role
One new role added: Designer. All existing roles unchanged. Add to your existing RBAC implementation.
Permission	DM Leader	Designer	SEO Exec	Nivesh	CEO
View Review Queue	✓	—	—	—	—
Approve content	✓	—	—	—	—
Reject content	✓	—	—	—	—
Edit content inline	✓	—	—	—	—
View Designer visual queue	—	✓	—	—	—
Set designer_approved flag	—	✓	—	—	—
Upload custom visual asset	—	✓	—	—	—
View SEO brief queue	✓	—	✓	—	—
Trigger SMO generation	✓	—	—	✓	—
View agent health panel	Summary	—	—	✓	—
View analytics dashboard	✓	—	SEO only	Errors	Read only
Python — RBACauth/roles.py — add Designer roleCopy
# Add to your existing roles enum / constants ROLES = { "dm_leader": { "permissions": [ "review:read", "review:approve", "review:reject", "review:edit", "smo:trigger", "analytics:read", "agents:health:summary", ] }, # NEW ROLE ────────────────────────────────────────── "designer": { "permissions": [ "visual_queue:read", # See Blue Arrow visual queue only "designer_approved:write", # Set the flag "assets:upload", # Upload custom visual assets ] }, # ────────────────────────────────────────────────── "seo_executive": { "permissions": [ "brief_queue:read", "brief_queue:annotate", "analytics:seo_read", ] }, "developer": { "permissions": [ "agents:health:full", "smo:trigger", "analytics:errors", ] }, "ceo": { "permissions": ["analytics:read_only"] }, }
10
Sprint plan — Nivesh build order
4 sprints. Each sprint is a shippable unit. Do not start Sprint 2 until Sprint 1 is tested end-to-end.
SPRINT 1
Now
MongoDB + FastAPI foundation + Blue Arrow gate
The plumbing. Nothing visible yet but everything depends on this. Must be done first and tested with dummy data before any UI work starts.
Run MongoDB migrationCreate content_library indexesBuild GET /api/review/queueBuild POST /api/review/approve with all 3 gatesBuild POST /api/review/rejectBuild POST /api/review/designer-approveBlue Arrow gate enforcement (API-level 403)RBAC: add Designer role
SPRINT 2
Next
Claude pre-screen + Celery schedules
The intelligence layer. Pre-screen reduces Purnima's workload. Celery schedules automate the Monday/Wednesday triggers.
prescore_agent.py with Claude HaikuFAQ bank loader (existing data)Brand voice loader per brandCelery: smo-agent1-brief-gen (Mon 8AM)Celery: smo-agent4-performance-pull (Mon 7:30AM)Celery: smo-prescore-batch (Mon 8:30AM)Celery: smo-review-reminder (Wed 9AM)Celery: check_72h_timeout (daily)WhatsApp: flag alert + Blue Arrow designer alert
SPRINT 3
After S2
React dashboard UI — Review Queue + Designer Queue
The visible layer. DM Leader and Designer get their interfaces. Polish and test with Purnima before Sprint 4.
Review Queue tab (DM Leader)Post preview renderer (LinkedIn/IG/FB)Approve button with disabled stateInline edit modeBlue Arrow designer badgeVisual Review queue (Designer role)Cascade timeline panel (blogs)Agent health indicator barWhatsApp: engagement velocity alertWhatsApp: Wednesday batch ready
SPRINT 4
Final
Feedback loop + Agent 3 cascade + performance analytics
Closes the loop. System learns. Blog cascade automates 30 days of content from one approval.
Agent 4 performance summary writeragent1_brief_context collection + endpointAgent 1 reads performance context on Mon 8AMBlog cascade: Day 0/+3/+7/+14/+21 auto-creationGET /api/review/cascade-previewAgent 3 → Agent 7 URL registration on publishFirst comment auto-post after publishhcis.content_analytics populationEnd-to-end test: Mon brief → Wed approve → publish → analytics
11
Non-negotiables
These are fixed requirements. Do not negotiate, simplify, or find workarounds for any of these.
⛔
1 — Nothing publishes without DM Leader approval signal
Agent 3 publish task must check status = approved before executing. If status is anything other than approved, the task returns immediately and logs an error. The Celery task itself must never auto-approve. This check must exist in the Agent 3 code, not just the API.
⛔
2 — Blue Arrow gate is API-enforced, not UI-only
The POST /api/review/approve endpoint returns 403 if brand = blue_arrow_cpa and designer_approved = false. This is not a UI warning. A developer calling the API directly must also be blocked. Test this explicitly: make a direct POST with Postman, verify 403 is returned.
⛔
3 — No test bypass for the Blue Arrow gate in production
During development you may use a BYPASS_CULTURAL_GATE=true env var. This env var must not exist on the production server. Remove it before deploying Sprint 3 to production. Purnima must confirm via WhatsApp that the gate is working before Sprint 3 goes live.
⚠️
4 — Time metric exclusions
Do not include time-savings metrics or cost/salary figures anywhere in the dashboard UI. These were explicitly removed from all views by Sanwar. Do not add them back even if they seem useful for context.
⚠️
5 — Rejection reasons are permanent
When DM Leader rejects a post, the rejection_reason field must be stored permanently — it is never deleted. These are fed back into Agent 2's regeneration prompt to improve future content. Monthly: aggregate top rejection reasons into a brand voice improvement report for Purnima.
ℹ️
6 — Coordinate with Mayank before Sprint 3
Agent 3 needs to write blog posts to Mayank's Python CMS endpoint. Get the endpoint spec from Mayank before starting Sprint 3. Also confirm Agent 7's URL registration endpoint spec — you need to call it from Agent 3 on every successful blog publish.
✅
7 — Test sign-off required from Purnima before Sprint 4
Before starting Sprint 4, do a live walkthrough with Purnima: show her the Review Queue, have her approve one test post, show the Blue Arrow gate lock in action, show the Designer queue. Get her explicit sign-off. Sprint 4 builds on top of Sprint 3 — if Sprint 3 UI needs changes, better to know before Sprint 4 starts.
12
DM Asset Library
Centralised media store inside the dashboard — logos, photos, brand assets, reports, PDFs, and any file type. Upload directly from system. Available to all agents and team members by role.
📁
What this replaces
Currently brand assets (logos, Blue Arrow visuals, campaign images) are stored in local folders or shared via WhatsApp. This gives every team member — DM Leader, Designer, SEO Exec, agents — a single structured store inside the dashboard. Agent 3 reads approved visuals from here instead of local paths. Agent 2 references brand logos from here when describing visual specs.
MongoDB collection — hcis.dm_librarySCHEMA
Each uploaded file gets one document:
file_id ObjectId · filename str · original_name str
file_type str (logo | photo | visual | report | pdf | video | other)
brand str (hcllp | blue_arrow_cpa | advisory | shared)
tags [str] · size_bytes int · mime_type str
storage_path str (AWS S3 path or local server path)
uploaded_by str · uploaded_at datetime
approved_for_use bool · approved_by str
used_in_posts [ObjectId] (content_library refs)
is_deleted bool · thumbnail_url str (images only)
File type support — all typesSPEC
Accept all common types via accept="*/*" on the file input.
Images: PNG, JPG, JPEG, WEBP, SVG, GIF
Documents: PDF, DOCX, XLSX, PPTX, TXT, CSV
Video: MP4, MOV, AVI (for Reels source files)
Brand: AI, EPS, PSD (raw design files)
Archives: ZIP (for bulk asset uploads)
Max file size: 50MB per upload. Bulk upload: up to 20 files at once via multi-select. Store on AWS S3 bucket harshwal-dm-library.
Python — FastAPIapi/library_routes.pyCopy
from fastapi import UploadFile, File, Form import boto3, uuid from PIL import Image import io s3 = boto3.client('s3') BUCKET = "harshwal-dm-library" # ── UPLOAD ───────────────────────────────────────────── @router.post("/api/library/upload") async def upload_asset( files: list[UploadFile] = File(...), # multi-file support brand: str = Form(...), # hcllp | blue_arrow_cpa | advisory | shared file_type: str = Form(...), # logo | photo | visual | report | pdf | video | other tags: str = Form(""), # comma-separated current_user = Depends(get_current_user) ): results = [] for file in files: content = await file.read() file_id = str(uuid.uuid4()) ext = file.filename.split(".")[-1].lower() s3_key = f"{brand}/{file_type}/{file_id}.{ext}" # Upload to S3 s3.put_object( Bucket=BUCKET, Key=s3_key, Body=content, ContentType=file.content_type, ) # Generate thumbnail for images thumbnail_url = None if file.content_type.startswith("image/"): img = Image.open(io.BytesIO(content)) img.thumbnail((320, 320)) buf = io.BytesIO() img.save(buf, format="WEBP", quality=85) thumb_key = f"thumbs/{file_id}.webp" s3.put_object(Bucket=BUCKET, Key=thumb_key, Body=buf.getvalue()) thumbnail_url = f"https://{BUCKET}.s3.amazonaws.com/{thumb_key}" # Save to MongoDB doc = { "file_id": file_id, "filename": s3_key, "original_name": file.filename, "file_type": file_type, "brand": brand, "tags": [t.strip() for t in tags.split(",") if t.strip()], "size_bytes": len(content), "mime_type": file.content_type, "storage_path": s3_key, "uploaded_by": current_user.id, "uploaded_at": datetime.utcnow(), "approved_for_use": True, # DM Leader uploads = auto-approved "thumbnail_url": thumbnail_url, "is_deleted": False, "used_in_posts": [], } db.dm_library.insert_one(doc) results.append({"file_id": file_id, "url": f"https://{BUCKET}.s3.amazonaws.com/{s3_key}"}) return {"uploaded": len(results), "files": results} # ── LIST / SEARCH ────────────────────────────────────── @router.get("/api/library/assets") async def list_assets( brand: str = None, file_type: str = None, search: str = None, # searches original_name + tags page: int = 1, per_page: int = 40 ): query = {"is_deleted": False} if brand: query["brand"] = brand if file_type: query["file_type"] = file_type if search: query["$or"] = [ {"original_name": {"$regex": search, "$options": "i"}}, {"tags": {"$in": [search.lower()]}}, ] total = db.dm_library.count_documents(query) assets = list(db.dm_library.find(query) .sort("uploaded_at", -1) .skip((page-1) * per_page) .limit(per_page)) return {"total": total, "page": page, "assets": assets} # ── DELETE (soft delete) ─────────────────────────────── @router.delete("/api/library/assets/{file_id}") async def delete_asset(file_id: str, current_user = Depends(get_current_user)): if current_user.role not in ["dm_leader", "designer"]: raise HTTPException(403, "Only DM Leader or Designer can delete assets") db.dm_library.update_one( {"file_id": file_id}, {"$set": {"is_deleted": True, "deleted_by": current_user.id}} ) return {"status": "deleted"}
React UI — Library TabFRONTEND
New "📁 DM Library" tab in left sidebar. Layout:
Top bar: Filter chips — All · Logos · Photos · Visuals · Reports · PDFs · Videos + Brand filter (HCLLP / Blue Arrow / Advisory / Shared) + Search input + Upload button
Main grid: Masonry/grid of asset cards. Image thumbnails for media. File icon + filename for docs. Each card shows: filename, brand tag, upload date, "Copy URL" button, "Use in post" button, delete (DM Leader / Designer only)
Upload zone: Drag-and-drop area + "Browse Files" button. Multi-select enabled. Shows upload progress bar per file. After upload: toast "3 files added to library"
Library → Review Queue IntegrationINTEGRATION
When Designer is in the Visual Review queue (Blue Arrow), they can:
1. Click "Upload Custom Asset" → opens Library upload modal in-context
2. Uploaded asset auto-links to the content item's visual_asset_id
3. Asset marked approved_for_use = true + designer_approved = true fires together
Agent 3 reads visual_asset_id on publish → fetches S3 URL → attaches image to LinkedIn/IG/FB post automatically. No more manual image upload at publish time.
Library → Agent 3 ConnectionAGENT INTEGRATION
In agents/agent3_publisher.py:
visual_asset_id on the content item → query hcis.dm_library → get storage_path → pre-sign S3 URL → attach to API call (LinkedIn image param, Meta source param)
After publish: write back post_id to dm_library.used_in_posts[] so DM Leader can see "this logo has been used in 14 posts" in the Library view.
RBAC for LibraryACCESS
DM Leader: Upload, view, delete, tag, use in post — all brands
Designer: Upload, view, delete own uploads — all brands
SEO Exec: View only — reports and PDFs only
Nivesh/Mayank: View only — read storage paths for agent use
CEO: No access to library
Add library:read, library:write, library:delete permissions to RBAC roles map in Section 09.
💡
AWS S3 bucket structure
Organise the bucket by brand and type: hcllp/logo/ · hcllp/photo/ · blue_arrow_cpa/visual/ · blue_arrow_cpa/logo/ · advisory/photo/ · shared/report/ · thumbs/ (auto-generated). Use AWS Secrets Manager for the S3 credentials — same pattern as all other API keys. Set S3 bucket policy to private — all access via pre-signed URLs only, never public bucket.
13
Share Reports to Management
One-click sharing of any dashboard report — weekly performance, monthly CEO PDF, brand analytics — directly from the DM dashboard to management. No email client needed. Share via email, WhatsApp, or a secure shareable link.
📤
What can be shared
Any report generated by the system: Weekly HTML performance report (Agent 4), Monthly CEO PDF (Agent 4 auto-generates), Brand-specific analytics snapshot (HCLLP / Blue Arrow / Advisory), SEO keyword ranking report (Agent 5), Lead gen summary (Agent 6 → Monday.com export), Custom date-range report (DM Leader selects range → Agent 4 generates on demand). DM Leader can also share any file from the DM Library directly.
Share via Email (AWS SES)METHOD 1
DM Leader clicks "Share" on any report. A modal opens:
1. To: field (pre-filled with management email list from settings — Sanwar, any added recipient)
2. Report type badge shown (Weekly / Monthly / SEO / Leads)
3. Optional personal note (3 lines max)
4. "Send" button → POST /api/reports/share/email
Backend: Agent 4 generates/retrieves the report → attaches as PDF to AWS SES email → sends. Confirmation WhatsApp to DM Leader: "Report shared with management via email."
Recipients are stored in hcis.report_recipients — DM Leader can manage this list in Settings.
Share via WhatsAppMETHOD 2
Share button triggers WhatsApp Business API send to a specific number or group.
Message format:
📊 [Report Type] — [Brand] · [Period]
[DM Leader optional note]
Full report: [secure link]
Secure link = POST /api/reports/share/link which generates a time-limited signed URL (48 hours) hosted on your server. Anyone with the link can view the HTML report in their browser — no login required. Link expires automatically.
Secure Shareable LinkMETHOD 3
Generates a one-time URL valid for 48 hours:
https://dashboard.harshwal.com/report/[token]
Token stored in hcis.report_shares: {token, report_id, created_at, expires_at, accessed_count, created_by}
No login needed to view — management opens on any device. Shows the report in a clean read-only view (no dashboard sidebar, no edit controls). Automatically marks accessed_count++ when opened so DM Leader can see "CEO opened this report."
On-demand Report GenerationFEATURE
DM Leader can generate any report on demand before sharing:
1. Select: Weekly / Monthly / Brand-specific / Custom date range
2. Select brand(s): HCLLP / Blue Arrow / Advisory / All
3. Select format: HTML (view in browser) / PDF (download + email)
4. "Generate" → Celery task → POST /api/reports/generate
5. On complete: report appears in "Recent Reports" panel in Share tab
6. DM Leader clicks "Share" next to any recent report
All generated reports stored in hcis.reports for 90 days.
Python — FastAPIapi/report_routes.pyCopy
import secrets from datetime import datetime, timedelta import boto3 from botocore.config import Config ses = boto3.client('ses', region_name='ap-south-1') # ── GENERATE REPORT ON DEMAND ──────────────────────── @router.post("/api/reports/generate") async def generate_report( report_type: str, # weekly | monthly | brand | custom brand: str = "all", date_from: str = None, date_to: str = None, format: str = "html", # html | pdf current_user = Depends(get_current_user) ): if current_user.role != "dm_leader": raise HTTPException(403, "DM Leader only") # Queue Agent 4 to generate the report task = generate_report_task.apply_async(args=[{ "type": report_type, "brand": brand, "date_from": date_from, "date_to": date_to, "format": format, "requested_by": current_user.id, }]) return {"task_id": task.id, "status": "generating"} # ── SHARE VIA EMAIL ────────────────────────────────── @router.post("/api/reports/share/email") async def share_via_email( report_id: str, to_emails: list[str], personal_note: str = "", current_user = Depends(get_current_user) ): report = db.reports.find_one({"_id": report_id}) if not report: raise HTTPException(404, "Report not found") # Send via AWS SES with PDF attached ses.send_raw_email( Source="reports@harshwal.com", Destinations=to_emails, RawMessage={"Data": build_email_with_pdf(report, personal_note)} ) # Log share event db.report_shares.insert_one({ "report_id": report_id, "method": "email", "recipients": to_emails, "shared_by": current_user.id, "shared_at": datetime.utcnow(), }) # Confirm via WhatsApp to DM Leader send_whatsapp( to=DM_LEADER_PHONE, msg=f"✅ Report shared via email to {len(to_emails)} recipients." ) return {"status": "sent", "recipients": len(to_emails)} # ── GENERATE SECURE SHARE LINK ─────────────────────── @router.post("/api/reports/share/link") async def generate_share_link( report_id: str, expires_hours: int = 48, current_user = Depends(get_current_user) ): token = secrets.token_urlsafe(32) expires_at = datetime.utcnow() + timedelta(hours=expires_hours) db.report_shares.insert_one({ "token": token, "report_id": report_id, "method": "link", "created_by": current_user.id, "created_at": datetime.utcnow(), "expires_at": expires_at, "accessed_count": 0, }) share_url = f"https://dashboard.harshwal.com/report/{token}" return {"url": share_url, "expires_at": expires_at.isoformat()} # ── PUBLIC REPORT VIEWER (no auth) ────────────────── @router.get("/report/{token}") async def view_shared_report(token: str): share = db.report_shares.find_one({"token": token, "method": "link"}) if not share: raise HTTPException(404) if datetime.utcnow() > share["expires_at"]: raise HTTPException(410, "This report link has expired") # Increment access counter db.report_shares.update_one( {"token": token}, {"$inc": {"accessed_count": 1}, "$set": {"last_accessed": datetime.utcnow()}} ) report = db.reports.find_one({"_id": share["report_id"]}) return HTMLResponse(content=report["html_content"]) # clean read-only HTML
React UI — Share TabFRONTEND
New "📤 Share Reports" tab in left sidebar. Layout:
Recent Reports panel (left): List of all generated reports sorted by date. Each row: report type icon, title, brand, date, format badge (HTML/PDF). "Share" and "Download" buttons per row.
Share modal: Opens on "Share" click. Three method tabs: Email · WhatsApp · Copy Link. Email tab: To field (multi-email), personal note textarea, Send button. Link tab: shows generated URL with "Copy" button and expiry countdown.
Management Recipient ListSETTINGS
DM Leader manages a recipient list in Settings (new Settings tab or inline in Share tab):
Default recipients: Sanwar Harshwal (CEO) — email + WhatsApp pre-seeded.
Add recipient: Name + Email + WhatsApp number. Role tag: CEO / Partner / Advisor.
Stored in: hcis.report_recipients
When DM Leader clicks Share → Email, the To field auto-populates with all active recipients. She can remove recipients per-send without deleting from the list.
MongoDB collections neededSCHEMA
hcis.reports: _id, type, brand, date_from, date_to, format, html_content, pdf_s3_path, generated_at, generated_by, status
hcis.report_shares: _id, report_id, method, token, recipients, created_by, created_at, expires_at, accessed_count, last_accessed
hcis.report_recipients: _id, name, email, whatsapp, role, active, added_by, added_at
WhatsApp template — report sharedNOTIFICATION
On email send confirmation to DM Leader:
✅ Report shared — [type] [period]
Recipients: [N] · Method: Email
Reply if resend needed.
When management opens the link (optional):
👁 [Recipient name] opened your report.
[type] · [date]
Only fires if notify_on_open = true in recipient settings.
✅
Sprint 4 addition — Library and Share in same sprint
Both DM Library and Share Reports are relatively self-contained — they don't depend on the pre-screen or Celery pipeline. Add them as Sprint 4 tasks alongside the feedback loop work. DM Library backend (MongoDB + S3 + FastAPI) can start as early as Sprint 2 since it has no dependencies. React UI for both comes in Sprint 3 alongside the Review Queue UI.