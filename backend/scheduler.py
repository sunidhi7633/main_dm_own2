import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()


async def _run_weekly_discovery():
    print("\n--- [CRON] Triggering Weekly Intelligence Pipeline ---")
    try:
        from agents.pipeline import run_intelligence_pipeline
        await run_intelligence_pipeline()
    except Exception as e:
        print(f"[CRON] Pipeline error: {e}")


def run_weekly_discovery():
    asyncio.create_task(_run_weekly_discovery())


def setup_scheduler():
    scheduler.add_job(
        run_weekly_discovery,
        trigger=CronTrigger(day_of_week="mon", hour=3, minute=0),
        id="weekly_competitor_discovery",
        replace_existing=True,
    )
    print("APScheduler configured: Intelligence pipeline scheduled every Monday at 03:00.")
