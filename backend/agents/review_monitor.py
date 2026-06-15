import os
import sys
from datetime import datetime, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from mongo import db
from notifications.whatsapp import send_72h_timeout_alert

def check_72h_timeout():
    """
    Celery task: smo-check-approval-timeout
    Runs Daily 9AM. Checks for pending_review items > 72 hours.
    """
    print("Running Review Monitor: Checking 72h timeouts...")
    
    threshold_time = datetime.utcnow() - timedelta(hours=72)
    
    stale_items = list(db.content_library.find({
        "status": "pending_review",
        # Assuming prescore sets an updated_at or we check created_at
        # We will use created_at for this mock as an approximation
        "created_at": {"$lt": threshold_time}
    }).sort("created_at", 1))
    
    if not stale_items:
        print("No stale items found.")
        return
        
    oldest_item = stale_items[0]
    oldest_hours = int((datetime.utcnow() - oldest_item.get("created_at")).total_seconds() / 3600)
    
    # Calculate hours until publish for the oldest item if it has a scheduled_at
    scheduled_at = oldest_item.get("scheduled_at")
    hours_until_publish = 0
    if scheduled_at:
        hours_until_publish = int((scheduled_at - datetime.utcnow()).total_seconds() / 3600)
        
    send_72h_timeout_alert(
        item_count=len(stale_items),
        oldest_item_hours=oldest_hours,
        hours_until_publish=hours_until_publish
    )
    print(f"Sent 72h timeout alert for {len(stale_items)} items.")
