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

from mongo import db

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
import notifications.whatsapp

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
def smo_review_reminder():
    brief_count = db.content_library.count_documents({"status": "pending_review"})
    flag_count = db.content_library.count_documents({"status": "flagged"})
    notifications.whatsapp.send_review_reminder(brief_count=brief_count, flag_count=flag_count)

@app.task
def smo_check_approval_timeout():
    agents.review_monitor.check_72h_timeout()

@app.task
def agent3_publish(content_id: str):
    live_url = agents.agent3_publisher.publish_content(content_id)
    if live_url:
        item = db.content_library.find_one({"_id": content_id})
        if not item:
            try:
                from bson import ObjectId
                item = db.content_library.find_one({"_id": ObjectId(content_id)})
            except:
                pass
                
        if item:
            post_title = str(item.get("content_body", ""))[:30] + "..."
            brand = item.get("brand", "Unknown")
            platform = ", ".join(item.get("platform", []))
            send_engagement_velocity_whatsapp.apply_async(
                args=[post_title, brand, platform, live_url],
                countdown=60
            )

@app.task
def send_engagement_velocity_whatsapp(post_title: str, brand: str, platform: str, live_url: str):
    notifications.whatsapp.send_engagement_velocity_whatsapp(post_title, brand, platform, live_url)

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
    "smo-review-reminder": {
        "task": "celery_config.smo_review_reminder",
        "schedule": crontab(hour=9, minute=0, day_of_week="wed"),
    },
    "smo-check-approval-timeout": {
        "task": "celery_config.smo_check_approval_timeout",
        "schedule": crontab(hour=9, minute=0),
    },
}
