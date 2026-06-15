import os
import sys
import requests
import threading
from datetime import datetime, timedelta
from bson import ObjectId

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from mongo import db
from notifications.whatsapp import send_engagement_velocity_whatsapp


# ---------------------------------------------------------------------------
# Platform publishers — each returns a live_url string or None on skip/fail
# ---------------------------------------------------------------------------

def _publish_to_linkedin(content_item: dict) -> str | None:
    token = os.getenv("LINKEDIN_ACCESS_TOKEN")
    author_urn = os.getenv("LINKEDIN_AUTHOR_URN")  # e.g. urn:li:organization:12345
    if not token or not author_urn:
        print("  LinkedIn: credentials not set (LINKEDIN_ACCESS_TOKEN / LINKEDIN_AUTHOR_URN) — skipped.")
        return None

    caption = content_item.get("caption", "")
    body = content_item.get("content_body", "")
    post_text = f"{caption}\n\n{body}".strip() if caption else body

    payload = {
        "author": author_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": post_text[:3000]},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }

    resp = requests.post(
        "https://api.linkedin.com/v2/ugcPosts",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    post_id = resp.headers.get("x-restli-id") or resp.json().get("id", "")
    urn_encoded = post_id.replace(":", "%3A")
    return f"https://www.linkedin.com/feed/update/{urn_encoded}/", post_id


def _publish_to_facebook(content_item: dict) -> str | None:
    token = os.getenv("META_PAGE_ACCESS_TOKEN")
    page_id = os.getenv("META_PAGE_ID")
    if not token or not page_id:
        print("  Facebook: credentials not set (META_PAGE_ACCESS_TOKEN / META_PAGE_ID) — skipped.")
        return None

    caption = content_item.get("caption", "")
    body = content_item.get("content_body", "")
    message = f"{caption}\n\n{body}".strip() if caption else body

    resp = requests.post(
        f"https://graph.facebook.com/v19.0/{page_id}/feed",
        params={"access_token": token},
        json={"message": message[:63206]},
        timeout=15,
    )
    resp.raise_for_status()
    post_id = resp.json().get("id", "")
    return f"https://www.facebook.com/{post_id}", post_id


def _publish_to_instagram(content_item: dict) -> str | None:
    token = os.getenv("META_PAGE_ACCESS_TOKEN")
    ig_user_id = os.getenv("INSTAGRAM_USER_ID")
    if not token or not ig_user_id:
        print("  Instagram: credentials not set (META_PAGE_ACCESS_TOKEN / INSTAGRAM_USER_ID) — skipped.")
        return None

    image_url = content_item.get("image_url")
    if not image_url:
        print("  Instagram: no image_url on content item — skipped (Instagram requires media).")
        return None

    caption = content_item.get("caption", "")
    body = content_item.get("content_body", "")
    full_caption = f"{caption}\n\n{body}".strip() if caption else body

    # Step 1: create media container
    media_resp = requests.post(
        f"https://graph.facebook.com/v19.0/{ig_user_id}/media",
        params={"access_token": token},
        json={"image_url": image_url, "caption": full_caption[:2200]},
        timeout=15,
    )
    media_resp.raise_for_status()
    container_id = media_resp.json().get("id")

    # Step 2: publish the container
    pub_resp = requests.post(
        f"https://graph.facebook.com/v19.0/{ig_user_id}/media_publish",
        params={"access_token": token},
        json={"creation_id": container_id},
        timeout=15,
    )
    pub_resp.raise_for_status()
    media_id = pub_resp.json().get("id", "")
    return f"https://www.instagram.com/p/{media_id}/"


def _post_linkedin_comment(post_urn: str, comment_text: str):
    token = os.getenv("LINKEDIN_ACCESS_TOKEN")
    author_urn = os.getenv("LINKEDIN_AUTHOR_URN")
    if not token or not author_urn or not post_urn:
        return
    try:
        requests.post(
            f"https://api.linkedin.com/v2/socialActions/{post_urn}/comments",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Restli-Protocol-Version": "2.0.0",
                "Content-Type": "application/json",
            },
            json={"actor": author_urn, "message": {"text": comment_text}},
            timeout=10,
        ).raise_for_status()
        print("  LinkedIn: first comment posted.")
    except Exception as e:
        print(f"  LinkedIn comment failed: {e}")


def _post_facebook_comment(post_id: str, comment_text: str):
    token = os.getenv("META_PAGE_ACCESS_TOKEN")
    if not token or not post_id:
        return
    try:
        requests.post(
            f"https://graph.facebook.com/v19.0/{post_id}/comments",
            params={"access_token": token},
            json={"message": comment_text},
            timeout=10,
        ).raise_for_status()
        print("  Facebook: first comment posted.")
    except Exception as e:
        print(f"  Facebook comment failed: {e}")


def _register_with_agent7(live_url: str):
    endpoint = os.getenv("AGENT7_WATCHLIST_ENDPOINT", "")
    if not endpoint or "your_" in endpoint or not endpoint.startswith("http"):
        print("  Agent 7: endpoint not configured (AGENT7_WATCHLIST_ENDPOINT) — skipped.")
        return
    try:
        requests.post(
            endpoint,
            json={"url": live_url, "registered_at": datetime.utcnow().isoformat()},
            timeout=10,
        ).raise_for_status()
        print(f"  Agent 7: URL registered -> {live_url}")
    except Exception as e:
        print(f"  Agent 7: registration failed — {e}")


def _publish_to_cms(content_item: dict) -> str | None:
    cms_endpoint = os.getenv("MAYANK_CMS_ENDPOINT", "")
    if not cms_endpoint or "your_" in cms_endpoint or not cms_endpoint.startswith("http"):
        print("  CMS: endpoint not configured (MAYANK_CMS_ENDPOINT) — skipped.")
        return None

    payload = {
        "title": (content_item.get("caption") or "Blog Post")[:100],
        "body": content_item.get("content_body", ""),
        "brand": content_item.get("brand"),
        "utm_params": content_item.get("utm_params", ""),
        "published_at": datetime.utcnow().isoformat(),
    }

    resp = requests.post(cms_endpoint, json=payload, timeout=15)
    resp.raise_for_status()
    return resp.json().get("live_url")


# ---------------------------------------------------------------------------
# Cascade generator
# ---------------------------------------------------------------------------

def generate_cascade_posts(parent_item: dict):
    parent_id = str(parent_item["_id"])
    brand = parent_item.get("brand")
    base_date = datetime.utcnow()

    cascade_schedule = [
        {"day_offset": 3,  "platform": ["LinkedIn"],               "type": "Stat post",   "text": "Did you know? [Stat from blog]"},
        {"day_offset": 7,  "platform": ["Instagram", "Facebook"],  "type": "Quote card",  "text": "Quote: [Insight from blog]"},
        {"day_offset": 14, "platform": ["LinkedIn"],               "type": "Did you know","text": "Deep dive into [Topic]..."},
        {"day_offset": 21, "platform": ["LinkedIn", "Facebook"],   "type": "Re-share",    "text": "In case you missed it..."},
    ]

    new_items = []
    for sched in cascade_schedule:
        item = {
            "brand": brand,
            "platform": sched["platform"],
            "content_body": f"[Cascade: {sched['type']}] {sched['text']}",
            "status": "pending_prescore",
            "smo_generated": True,
            "cascade_parent_id": parent_id,
            "scheduled_at": base_date + timedelta(days=sched["day_offset"]),
            "created_at": datetime.utcnow(),
        }
        new_items.append(item)

    if new_items:
        db.content_library.insert_many(new_items)
        print(f"Generated {len(new_items)} cascade posts for blog {parent_id}")


# ---------------------------------------------------------------------------
# Main publish function
# ---------------------------------------------------------------------------

PLATFORM_PUBLISHERS = {
    "LinkedIn":  _publish_to_linkedin,   # returns (url, post_urn)
    "Facebook":  _publish_to_facebook,   # returns (url, post_id)
    "Instagram": _publish_to_instagram,  # returns url string only
}

_CTA_COMMENTS = {
    "hcllp":        "Follow Harshwal & Company LLP for weekly tax tips, audit insights, and financial planning strategies. Drop a question below — we respond to every comment.",
    "blue_arrow_cpa":"Follow Blue Arrow CPA for specialised insights on tribal government finance, SEFA compliance, and 2 CFR Part 200. We're here for your questions.",
    "advisory":     "Follow Harshwal Advisory for growth strategy insights and M&A updates. What challenges is your business facing? Let's talk below.",
}


def publish_content(content_id: str):
    """Agent 3 Publish task."""
    print(f"Agent 3: Publishing {content_id}")

    try:
        item = db.content_library.find_one({"_id": ObjectId(content_id)})
    except Exception:
        item = db.content_library.find_one({"_id": content_id})

    if not item:
        print(f"Error: Content {content_id} not found.")
        return

    if item.get("status") != "approved":
        print(f"Error: Refusing to publish {content_id} — status is '{item.get('status')}', must be 'approved'.")
        return

    platforms = item.get("platform", [])
    print(f"Publishing to platforms: {platforms}")

    live_urls = {}
    raw_post_ids = {}   # platform -> raw API post ID, used for first-comment step
    format_val = item.get("format", "text")
    brand = item.get("brand", "")
    cta_comment = _CTA_COMMENTS.get(brand, _CTA_COMMENTS["hcllp"])

    for platform in platforms:
        publisher = PLATFORM_PUBLISHERS.get(platform)
        if not publisher:
            print(f"  Unknown platform '{platform}' — skipped.")
            continue

        # Blog format also goes to CMS
        if format_val.lower() == "blog" and platform == "LinkedIn":
            try:
                cms_url = _publish_to_cms(item)
                if cms_url:
                    live_urls["CMS"] = cms_url
                    print(f"  CMS: published OK -> {cms_url}")
                    _register_with_agent7(cms_url)
            except Exception as e:
                print(f"  CMS publish error: {e}")

        try:
            result = publisher(item)
            # LinkedIn and Facebook return (url, raw_id); Instagram returns url string
            if isinstance(result, tuple):
                url, raw_id = result
                raw_post_ids[platform] = raw_id
            else:
                url = result
            if url:
                live_urls[platform] = url
                print(f"  {platform}: published OK -> {url}")
        except Exception as e:
            print(f"  {platform} publish error: {e}")

    # Use first successful URL as the canonical live_url
    primary_url = next(iter(live_urls.values()), None)

    # DM Library — attach visual asset if present
    visual_asset_id = item.get("visual_asset_id")
    if visual_asset_id:
        db.dm_library.update_one(
            {"file_id": visual_asset_id},
            {"$push": {"used_in_posts": str(item["_id"])}}
        )
        print(f"Attached visual asset {visual_asset_id} to post.")

    # Update content_library
    db.content_library.update_one(
        {"_id": item["_id"]},
        {"$set": {
            "status": "published",
            "live_url": primary_url,
            "live_urls": live_urls,
            "published_at": datetime.utcnow(),
        }}
    )

    # Create analytics record
    db.content_analytics.insert_one({
        "content_id": str(item["_id"]),
        "brand": item.get("brand"),
        "platform": platforms,
        "live_url": primary_url,
        "saves": 0,
        "engagement": 0,
        "published_at": datetime.utcnow(),
    })
    print(f"Created analytics record for {content_id}")

    # First comment CTA — post 30s after publish so algorithm registers it as early engagement
    if raw_post_ids:
        def _delayed_comments():
            import time
            time.sleep(30)
            if "LinkedIn" in raw_post_ids:
                _post_linkedin_comment(raw_post_ids["LinkedIn"], cta_comment)
            if "Facebook" in raw_post_ids:
                _post_facebook_comment(raw_post_ids["Facebook"], cta_comment)
        threading.Thread(target=_delayed_comments, daemon=True).start()
        print("First comment CTA scheduled (30s delay).")

    # Agent 7 — register published social URLs for SEO watchlist
    for platform, url in live_urls.items():
        if platform != "CMS":  # CMS URL already registered above
            _register_with_agent7(url)

    # Blog cascade generation
    if format_val.lower() == "blog":
        generate_cascade_posts(item)

    # WhatsApp engagement velocity alert — send after 60s so the post has settled
    if primary_url:
        post_title = (item.get("caption") or item.get("content_body", ""))[:60]
        platform_str = ", ".join(platforms)

        def _delayed_alert():
            import time
            time.sleep(60)
            send_engagement_velocity_whatsapp(post_title, brand, platform_str, primary_url)

        threading.Thread(target=_delayed_alert, daemon=True).start()
        print("WhatsApp velocity alert scheduled (60s delay).")

    return primary_url
