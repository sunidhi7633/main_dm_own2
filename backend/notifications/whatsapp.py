import os
import requests

WHATSAPP_API_TOKEN = os.getenv("WHATSAPP_API_TOKEN", "")
WHATSAPP_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID", "")
DM_LEADER_PHONE = os.getenv("DM_LEADER_PHONE", "")

def _send(to_phone: str, message: str):
    """Send via WhatsApp Business API, fall back to console log when credentials not set."""
    if not WHATSAPP_API_TOKEN or "your_" in WHATSAPP_API_TOKEN or not WHATSAPP_PHONE_ID or not to_phone:
        print("=" * 50)
        print(f"[WHATSAPP] To: {to_phone or 'DM_LEADER'}")
        print(message)
        print("=" * 50)
        return

    try:
        resp = requests.post(
            f"https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_ID}/messages",
            headers={
                "Authorization": f"Bearer {WHATSAPP_API_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "to": to_phone,
                "type": "text",
                "text": {"body": message},
            },
            timeout=10,
        )
        resp.raise_for_status()
        print(f"[WHATSAPP] Sent to {to_phone} — message_id: {resp.json().get('messages', [{}])[0].get('id')}")
    except Exception as e:
        print(f"[WHATSAPP] Send failed ({e}) — logging message instead:")
        print(message)

def send_review_reminder(brief_count: int = 0, flag_count: int = 0):
    dashboard_url = "https://dashboard.harshwal.com/review"
    msg = f"""📋 Weekly briefs ready — {brief_count} topics across 3 brands.
SEO Exec review: complete.
⚠️ Flagged items: {flag_count}

Open dashboard by 10 AM: {dashboard_url}"""
    _send(DM_LEADER_PHONE, msg)

def send_batch_ready_alert(post_count: int, hcllp_count: int, ba_count: int, adv_count: int):
    dashboard_url = "https://dashboard.harshwal.com/review"
    msg = f"""✅ Content batch ready — {post_count} posts + visuals.
Brands: HCLLP {hcllp_count} · Blue Arrow {ba_count} · Advisory {adv_count}
Designer check: COMPLETE

Open dashboard to approve: {dashboard_url}"""
    _send(DM_LEADER_PHONE, msg)

def send_whatsapp_flag_alert(item: dict, flag_reason: str):
    dashboard_url = "https://dashboard.harshwal.com/review"
    brand = item.get("brand", "Unknown")
    platform = ", ".join(item.get("platform", []))
    score = item.get("ai_prescore", {}).get("score", 0)
    
    msg = f"""⚠️ Content held — AI quality check.
Brand: {brand} · Platform: {platform}
Reason: {flag_reason}
Score: {score}/100

Review now: {dashboard_url}"""
    _send(DM_LEADER_PHONE, msg)

def notify_designer_visual_queue(item: dict):
    # This triggers the DM Leader when Designer is done, but the function name in workflow.md
    # is `notify_designer_visual_queue` - wait, the brief says "Triggers WhatsApp to DM Leader"
    dashboard_url = "https://dashboard.harshwal.com/review"
    content_summary = str(item.get("content_body", ""))[:30] + "..."
    platform = ", ".join(item.get("platform", []))
    
    msg = f"""🏹 Blue Arrow visual approved by Designer.
Item: {content_summary}
Platform: {platform}

Your approval is now unlocked.
Review: {dashboard_url}"""
    _send(DM_LEADER_PHONE, msg)

def send_engagement_velocity_whatsapp(post_title: str, brand: str, platform: str, live_url: str):
    msg = f"""🚀 Post live — please engage NOW (algorithm window).
"{post_title}"
Brand: {brand} · Platform: {platform}
Link: {live_url}

First 60 min = 3x reach. Comment something meaningful."""
    _send(DM_LEADER_PHONE, msg)

def send_72h_timeout_alert(item_count: int, oldest_item_hours: int, hours_until_publish: int):
    dashboard_url = "https://dashboard.harshwal.com/review"
    msg = f"""⏰ Action needed — {item_count} posts awaiting your approval.
Oldest item: {oldest_item_hours}h in queue.
Scheduled publish in: {hours_until_publish}h.

Open dashboard: {dashboard_url}"""
    _send(DM_LEADER_PHONE, msg)

def send_report_shared_alert(report_type: str, period: str, recipient_count: int):
    msg = f"""✅ Report shared — {report_type} {period}
Recipients: {recipient_count} · Method: Email

Reply if resend needed."""
    _send(DM_LEADER_PHONE, msg)

def send_report_opened_alert(recipient_name: str, report_type: str, date_str: str):
    msg = f"""👁 {recipient_name} opened your report.
{report_type} · {date_str}"""
    _send(DM_LEADER_PHONE, msg)
