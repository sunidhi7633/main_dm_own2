"""
Competitor Intelligence Publisher — Step 10
Publishes CIGeneratedContent rows to social platforms using the same
platform adapters as agent3_publisher, then updates the DB record.
"""
import json
import os
import threading
from datetime import datetime, timezone
from typing import Optional

from agents.agent3_publisher import (
    _publish_to_linkedin,
    _publish_to_facebook,
    _publish_to_instagram,
    _post_linkedin_comment,
    _post_facebook_comment,
    _register_with_agent7,
    _CTA_COMMENTS,
)

_PLATFORM_MAP = {
    "linkedin":  "LinkedIn",
    "facebook":  "Facebook",
    "instagram": "Instagram",
    "twitter":   "Twitter",
}

_PUBLISHERS = {
    "LinkedIn":  _publish_to_linkedin,
    "Facebook":  _publish_to_facebook,
    "Instagram": _publish_to_instagram,
}


def publish_ci_post(post, db_session) -> Optional[str]:
    """
    Publish one CIGeneratedContent ORM row to its platform.
    Updates post.status, post.live_url, post.published_at on success.
    Returns live_url or None.
    """
    import json as _json

    platform_key = _PLATFORM_MAP.get((post.platform or "").lower(), post.platform)
    publisher = _PUBLISHERS.get(platform_key)

    if not publisher:
        print(f"[CI Publisher] No publisher for '{platform_key}' — skipped (Twitter not yet supported).")
        return None

    hashtags = _json.loads(post.hashtags or "[]")
    hashtag_str = " ".join(f"#{h.lstrip('#')}" for h in hashtags)
    full_text = post.content or ""
    if post.cta:
        full_text += f"\n\n{post.cta}"
    if hashtag_str:
        full_text += f"\n\n{hashtag_str}"

    content_item = {
        "caption":      post.headline or "",
        "content_body": full_text,
        "brand":        post.brand or "",
        "image_url":    None,  # future: resolve from image_prompt via DALL-E
    }

    try:
        result = publisher(content_item)
    except Exception as e:
        print(f"[CI Publisher] {platform_key} error on post {post.id}: {e}")
        return None

    if isinstance(result, tuple):
        live_url, raw_id = result
    else:
        live_url, raw_id = result, None

    if not live_url:
        return None

    post.live_url = live_url
    post.status = "published"
    post.published_at = datetime.now(timezone.utc)
    db_session.commit()
    print(f"[CI Publisher] Post {post.id} → {platform_key}: {live_url}")

    _register_with_agent7(live_url)

    # First-comment CTA (30 s delay, non-blocking)
    brand = post.brand or "hcllp"
    cta_comment = _CTA_COMMENTS.get(brand, _CTA_COMMENTS["hcllp"])
    if raw_id:
        def _delayed():
            import time; time.sleep(30)
            if platform_key == "LinkedIn":
                _post_linkedin_comment(raw_id, cta_comment)
            elif platform_key == "Facebook":
                _post_facebook_comment(raw_id, cta_comment)
        threading.Thread(target=_delayed, daemon=True).start()

    return live_url
