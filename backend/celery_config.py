import os
from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

app = Celery(
    "harshwal_automation",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
)

import agents.smo_agent
import agents.analytics_agent
import agents.prescore_agent
import agents.review_monitor
import agents.agent3_publisher

@app.task
def smo_agent1_brief_gen(brand: str = None):
    agents.smo_agent.generate_weekly_briefs(brand=brand)

@app.task
def smo_agent2_regenerate(content_id: str, rejection_reason: str):
    agents.smo_agent.regenerate_after_rejection(content_id, rejection_reason)

@app.task
def smo_agent4_performance_pull():
    agents.analytics_agent.write_brief_context()

@app.task
def smo_prescore_batch():
    agents.prescore_agent.run_prescore_batch()

@app.task
def smo_check_approval_timeout():
    agents.review_monitor.check_72h_timeout()

@app.task
def agent3_publish(content_id: str):
    agents.agent3_publisher.publish_content(content_id)

@app.task
def ci_pipeline_auto():
    """Called by Celery beat — creates its own CIPipelineRun, then dispatches run_ci_pipeline."""
    from dotenv import load_dotenv
    load_dotenv()
    from database import SessionLocal
    import models

    db_sess = SessionLocal()
    try:
        cfg = db_sess.query(models.CIScheduleConfig).first()
        if cfg and cfg.is_enabled == 0:
            print("[CI Auto] Schedule disabled — skipping.")
            return
        run = models.CIPipelineRun(triggered_by="auto_scheduler", status="pending", step="queued")
        db_sess.add(run)
        db_sess.commit()
        db_sess.refresh(run)
        run_ci_pipeline.apply_async(kwargs={"run_id": run.id})
        print(f"[CI Auto] Dispatched pipeline run_id={run.id}")
    finally:
        db_sess.close()


@app.task
def publish_ci_scheduled():
    """Publish all CI content whose scheduled_at has passed (runs every 10 min)."""
    from dotenv import load_dotenv
    load_dotenv()
    from database import SessionLocal
    import models
    from datetime import datetime, timezone

    db_sess = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        due = db_sess.query(models.CIGeneratedContent).filter(
            models.CIGeneratedContent.status == "scheduled",
            models.CIGeneratedContent.scheduled_at <= now,
        ).all()

        if not due:
            return

        print(f"[CI Publish] {len(due)} post(s) due for publishing.")
        from agents.competitor_intel_publisher import publish_ci_post
        for post in due:
            try:
                publish_ci_post(post, db_sess)
            except Exception as e:
                print(f"[CI Publish] Error on post {post.id}: {e}")
    finally:
        db_sess.close()


@app.task
def run_ci_pipeline(run_id: int, brands: list = None):
    """Full Competitor Intelligence pipeline — runs all 8 steps in sequence."""
    from dotenv import load_dotenv
    load_dotenv()

    from database import SessionLocal
    import models
    from datetime import datetime, timezone

    db_sess = SessionLocal()

    def _log(run, msg):
        run.logs = (run.logs or "") + f"\n{msg}"
        run.step = msg
        db_sess.commit()
        print(f"[CI Pipeline run={run_id}] {msg}")

    try:
        run = db_sess.query(models.CIPipelineRun).filter(models.CIPipelineRun.id == run_id).first()
        if not run:
            return

        run.status = "running"
        db_sess.commit()

        # Step 1 — Load config
        cfg = db_sess.query(models.CIScheduleConfig).first()

        # Step 2 — Collect posts
        _log(run, "Step 2: Collecting competitor posts...")
        competitors = db_sess.query(models.CICompetitor).filter(models.CICompetitor.is_active == 1).all()
        if not competitors:
            _log(run, "No active competitors found. Add competitors first.")
            run.status = "failed"; db_sess.commit(); return

        from agents.competitor_intel.collector import collect_posts
        post_dicts = collect_posts(competitors, run_id, days_back=getattr(cfg, "days_back", 7))

        for pd in post_dicts:
            db_sess.add(models.CISocialPost(**pd))
        db_sess.commit()
        run.posts_collected = len(post_dicts)
        _log(run, f"Step 2 done: {len(post_dicts)} posts collected.")

        # Step 3 — Score
        _log(run, "Step 3: Scoring posts...")
        from agents.competitor_intel.scorer import score_and_rank, select_top_n
        all_posts = db_sess.query(models.CISocialPost).filter(models.CISocialPost.run_id == run_id).all()
        scored = score_and_rank(all_posts, cfg)
        db_sess.commit()
        run.posts_scored = len(scored)
        _log(run, f"Step 3 done: {len(scored)} posts scored.")

        # Step 4 — Top N
        top_n = getattr(cfg, "top_n", 30)
        top_posts = select_top_n(scored, top_n)
        run.posts_top = len(top_posts)
        _log(run, f"Step 4 done: Top {len(top_posts)} posts selected.")

        # Step 5 — Trend analysis
        _log(run, "Step 5: Analyzing trends with OpenAI...")
        from agents.competitor_intel.analyzer import analyze_trends
        trend_data = analyze_trends(top_posts)
        import json
        trend_row = models.CITrendReport(
            run_id=run_id,
            themes=json.dumps(trend_data.get("themes", [])),
            writing_styles=json.dumps(trend_data.get("writing_styles", [])),
            hook_patterns=json.dumps(trend_data.get("hook_patterns", [])),
            cta_patterns=json.dumps(trend_data.get("cta_patterns", [])),
            summary=trend_data.get("summary", ""),
        )
        db_sess.add(trend_row)
        db_sess.commit()
        _log(run, "Step 5 done: Trend report saved.")

        # Pull upcoming calendar events (next 30 days)
        _log(run, "Fetching calendar events for the next 30 days...")
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        upcoming_events = (
            db_sess.query(models.CICalendarEvent)
            .filter(
                models.CICalendarEvent.is_active == 1,
                models.CICalendarEvent.event_date >= now,
                models.CICalendarEvent.event_date <= now + timedelta(days=30),
            )
            .order_by(models.CICalendarEvent.event_date)
            .all()
        )
        _log(run, f"Found {len(upcoming_events)} upcoming calendar events.")

        # Steps 6 & 7 — Generate content
        _log(run, "Steps 6-7: Generating branded content with OpenAI...")
        from agents.competitor_intel.generator import generate_content
        top_ids = [p.id for p in top_posts]
        generated_dicts = generate_content(
            run_id, trend_data, brands=brands,
            top_post_ids=top_ids, calendar_events=upcoming_events
        )

        generated_rows = []
        for gd in generated_dicts:
            row = models.CIGeneratedContent(**gd)
            db_sess.add(row)
            generated_rows.append(row)
        db_sess.commit()
        _log(run, f"Steps 6-7 done: {len(generated_rows)} posts generated.")

        # Step 8 — Quality review
        _log(run, "Step 8: Running quality review with OpenAI...")
        from agents.competitor_intel.quality_reviewer import bulk_review
        bulk_review(generated_rows)
        db_sess.commit()
        run.content_generated = len(generated_rows)
        _log(run, f"Step 8 done: Quality scores assigned.")

        run.status = "completed"
        run.completed_at = datetime.now(timezone.utc)
        _log(run, "Pipeline completed successfully.")

    except Exception as e:
        import traceback
        err = traceback.format_exc()
        print(f"[CI Pipeline] FAILED: {err}")
        try:
            run = db_sess.query(models.CIPipelineRun).filter(models.CIPipelineRun.id == run_id).first()
            if run:
                run.status = "failed"
                run.logs = (run.logs or "") + f"\nERROR: {e}"
                db_sess.commit()
        except Exception:
            pass
    finally:
        db_sess.close()


app.conf.beat_schedule = {
    "smo-agent1-brief-gen": {
        "task": "celery_config.smo_agent1_brief_gen",
        "schedule": crontab(hour=8, minute=0, day_of_week="mon"),
    },
    "smo-agent4-performance-pull": {
        "task": "celery_config.smo_agent4_performance_pull",
        "schedule": crontab(hour=7, minute=30, day_of_week="mon"),
    },
    "smo-prescore-batch": {
        "task": "celery_config.smo_prescore_batch",
        "schedule": crontab(hour=8, minute=30, day_of_week="mon"),
    },
    "smo-check-approval-timeout": {
        "task": "celery_config.smo_check_approval_timeout",
        "schedule": crontab(hour=9, minute=0),
    },
    "ci-pipeline-daily": {
        "task": "celery_config.ci_pipeline_auto",
        "schedule": crontab(hour=3, minute=0),
    },
    "ci-publish-scheduled": {
        "task": "celery_config.publish_ci_scheduled",
        "schedule": crontab(minute="*/10"),  # every 10 minutes
    },
}
