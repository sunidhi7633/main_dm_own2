import os
import sys
import json
from datetime import datetime, timedelta
import random

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from mongo import db
from notifications.whatsapp import send_batch_ready_alert

try:
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage, SystemMessage
    llm = ChatOpenAI(model="gpt-4o", temperature=0.8)
except Exception:
    llm = None

BRANDS = ["hcllp", "blue_arrow_cpa", "advisory"]

BRAND_DESCRIPTIONS = {
    "hcllp": "Harshwal & Company LLP — a full-service CPA and advisory firm serving SMBs, individuals, and corporations with tax, audit, and financial advisory services.",
    "blue_arrow_cpa": "Blue Arrow CPA — a specialized CPA firm serving tribal governments and Native American entities. Experts in SEFA, 2 CFR Part 200, tribal sovereignty compliance, and government audits.",
    "advisory": "Harshwal Advisory — strategic business consulting for growth-stage companies, covering financial planning, M&A advisory, and operational efficiency."
}

PLATFORM_SCHEDULE = {
    "LinkedIn":  {"days_ahead": 2, "time": "09:00"},
    "Instagram": {"days_ahead": 3, "time": "11:00"},
    "Facebook":  {"days_ahead": 4, "time": "10:00"},
}

def _call_llm(system_prompt: str, user_prompt: str) -> str:
    if not llm:
        raise RuntimeError("OpenAI LLM not configured — check OPENAI_API_KEY")
    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ])
    return response.content.strip()

def _parse_json(text: str) -> any:
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    return json.loads(text)

def _generate_briefs_for_brand(brand: str, context: dict) -> list:
    brand_desc = BRAND_DESCRIPTIONS.get(brand, brand)
    top_topics = context.get("top_topics", []) if context else []
    top_formats = context.get("top_formats", ["carousel", "text"]) if context else ["carousel", "text"]
    worst_topics = context.get("worst_topics", []) if context else []

    # Pull competitor gaps from MongoDB if available
    gaps = list(db.gaps.find({"brand": brand}).sort("created_at", -1).limit(3))
    gap_text = "; ".join([g.get("gap", "") for g in gaps]) if gaps else "No recent gaps found"

    system_prompt = f"""You are a senior social media strategist for {brand_desc}.
Your job is to generate creative, specific, high-engagement content briefs for the upcoming week.
Always respond with valid JSON only — no explanation, no markdown outside the JSON block."""

    user_prompt = f"""Generate 3 content briefs for {brand} based on this context:

TOP PERFORMING TOPICS LAST WEEK: {top_topics}
TOP PERFORMING FORMATS: {top_formats}
TOPICS TO AVOID (underperforming): {worst_topics}
COMPETITOR GAPS TO EXPLOIT: {gap_text}

Return a JSON array of exactly 3 briefs. Each brief must follow this exact structure:
[
  {{
    "topic": "specific topic title",
    "hook_suggestion": "opening line to grab attention (1 sentence)",
    "format": "carousel | reel | text | blog",
    "faq_num": 1,
    "tagline_num": 1,
    "target_hashtags": ["hashtag1", "hashtag2", "hashtag3"],
    "best_post_time": "Day HH:MM IST",
    "competitor_gap": "gap this post addresses or null"
  }}
]

Make topics timely, specific, and relevant to {brand_desc}.
Vary formats across the 3 briefs. Make hook_suggestion punchy and platform-native."""

    raw = _call_llm(system_prompt, user_prompt)
    briefs = _parse_json(raw)

    now = datetime.utcnow()
    for brief in briefs:
        brief["brand"] = brand
        brief["status"] = "draft"
        brief["created_at"] = now
        brief["faq_num"] = int(brief.get("faq_num", 1))
        brief["tagline_num"] = int(brief.get("tagline_num", 1))

    return briefs

def _generate_content_for_brief(brief: dict, rejection_reason: str = "") -> dict:
    brand = brief["brand"]
    brand_desc = BRAND_DESCRIPTIONS.get(brand, brand)
    fmt = brief.get("format", "text")
    topic = brief.get("topic", "")
    hook = brief.get("hook_suggestion", "")
    hashtags = brief.get("target_hashtags", [])

    platform_map = {
        "carousel": "LinkedIn",
        "reel": "Instagram",
        "blog": "LinkedIn",
        "text": random.choice(["LinkedIn", "Facebook"])
    }
    platform = platform_map.get(fmt, "LinkedIn")

    system_prompt = f"""You are a professional social media copywriter for {brand_desc}.
Write compelling, publish-ready content. Be specific, use real terminology, and match the brand voice exactly.
Respond with valid JSON only."""

    format_instructions = {
        "carousel": "Write a 5-slide carousel. Each slide: title + 2-3 bullet points. Keep slides punchy.",
        "reel":     "Write a 30-second Reel script with hook (0-3s), main content (4-25s), and CTA (26-30s).",
        "blog":     "Write a 400-word blog post with H1 title, 3 H2 sections, and a CTA paragraph.",
        "text":     "Write a 150-200 word LinkedIn/Facebook post with the hook line first, then value, then CTA.",
    }

    rejection_block = ""
    if rejection_reason:
        rejection_block = f"\n\nPREVIOUS VERSION WAS REJECTED — DO NOT REPEAT THESE ISSUES:\n{rejection_reason}\nWrite a completely different angle that addresses this feedback.\n"

    user_prompt = f"""Write {fmt} content for {brand} on this topic: "{topic}"

HOOK LINE TO USE: {hook}
HASHTAGS TO INCLUDE: {" ".join(["#" + h.lstrip("#") for h in hashtags])}
FORMAT INSTRUCTIONS: {format_instructions.get(fmt, format_instructions["text"])}{rejection_block}

Return JSON:
{{
  "content_body": "the full post/script/blog content",
  "caption": "short 1-2 line caption for the post preview",
  "platform": "{platform}"
}}"""

    raw = _call_llm(system_prompt, user_prompt)
    content_data = _parse_json(raw)

    sched_info = PLATFORM_SCHEDULE.get(platform, {"days_ahead": 2, "time": "09:00"})
    scheduled_dt = datetime.utcnow() + timedelta(days=sched_info["days_ahead"])
    h, m = sched_info["time"].split(":")
    scheduled_dt = scheduled_dt.replace(hour=int(h), minute=int(m), second=0, microsecond=0)

    return {
        "brand": brand,
        "platform": [platform],
        "format": fmt,
        "content_body": content_data.get("content_body", ""),
        "caption": content_data.get("caption", ""),
        "faq_num": brief.get("faq_num", 1),
        "tagline_num": brief.get("tagline_num", 1),
        "target_hashtags": hashtags,
        "scheduled_at": scheduled_dt,
        "utm_params": f"utm_source=agent2&utm_medium={platform.lower()}&utm_campaign={brand}",
        "status": "pending_prescore",
        "smo_generated": True,
        "designer_approved": False,
        "ai_prescore": None,
        "live_url": None,
        "rejection_reason": None,
        "cascade_parent_id": None,
        "engagement_velocity_sent": False,
        "created_at": datetime.utcnow(),
    }


def generate_weekly_briefs(brand: str = None):
    """
    Celery task: smo-agent1-brief-gen
    Runs Mon 8AM. Reads Agent 4 context, generates real briefs via GPT-4o,
    then runs Agent 2 to write full content for each brief.
    Pass brand to restrict to a single brand; omit to run all 3.
    """
    brands_to_run = [brand] if brand in BRANDS else BRANDS
    print(f"Running Agent 1: Generating weekly briefs via GPT-4o for: {brands_to_run}...")

    if not llm:
        print("ERROR: OpenAI LLM not available. Check OPENAI_API_KEY.")
        return

    # Read performance context written by Agent 4
    context = db.agent1_brief_context.find_one(sort=[("week_start", -1)])
    if context:
        print(f"Agent 4 context loaded — top topics: {context.get('top_topics')}")
    else:
        print("No Agent 4 context found. Generating briefs from scratch.")

    all_briefs = []
    all_content = []

    for brand in brands_to_run:
        print(f"  Generating briefs for {brand}...")
        try:
            briefs = _generate_briefs_for_brand(brand, context)
            all_briefs.extend(briefs)
            print(f"  {len(briefs)} briefs generated for {brand}")

            # Agent 2: write full content for each brief
            print(f"  Agent 2: Writing content for {brand} briefs...")
            for brief in briefs:
                try:
                    content_item = _generate_content_for_brief(brief)
                    all_content.append(content_item)
                    print(f"    Content written: [{content_item['format']}] {brief['topic'][:50]}")
                except Exception as e:
                    print(f"    Agent 2 failed for brief '{brief.get('topic')}': {e}")

        except Exception as e:
            print(f"  Agent 1 failed for {brand}: {e}")

    # Save briefs to MongoDB
    if all_briefs:
        db.smo_briefs.insert_many(all_briefs)
        print(f"Saved {len(all_briefs)} briefs to smo_briefs.")

    # Save content to MongoDB for prescore
    if all_content:
        db.content_library.insert_many(all_content)
        print(f"Saved {len(all_content)} content items to content_library (status: pending_prescore).")

    # WhatsApp alert to DM Leader
    hcllp_count  = sum(1 for c in all_content if c["brand"] == "hcllp")
    ba_count     = sum(1 for c in all_content if c["brand"] == "blue_arrow_cpa")
    adv_count    = sum(1 for c in all_content if c["brand"] == "advisory")
    send_batch_ready_alert(len(all_content), hcllp_count, ba_count, adv_count)

    print(f"Agent 1 + Agent 2 complete. {len(all_briefs)} briefs, {len(all_content)} content items queued for prescore.")


def regenerate_after_rejection(content_id: str, rejection_reason: str):
    """
    Agent 2 re-run triggered by DM Leader rejection.
    Reconstructs a brief from the rejected item's fields, injects the
    rejection_reason as negative guidance, and saves a new content item.
    """
    from bson import ObjectId
    try:
        obj_id = ObjectId(content_id)
    except Exception:
        obj_id = content_id

    item = db.content_library.find_one({"_id": obj_id})
    if not item:
        print(f"Regeneration: content {content_id} not found.")
        return

    # Mark original as regenerating
    db.content_library.update_one({"_id": obj_id}, {"$set": {"status": "regenerating"}})
    print(f"Regenerating content for {content_id} — reason: {rejection_reason[:80]}")

    if not llm:
        print("ERROR: OpenAI LLM not configured — cannot regenerate.")
        return

    # Reconstruct brief from rejected item
    brief = {
        "brand":            item["brand"],
        "format":           item.get("format", "text"),
        "faq_num":          item.get("faq_num", 1),
        "tagline_num":      item.get("tagline_num", 1),
        "target_hashtags":  item.get("target_hashtags", []),
        "topic":            item.get("caption") or item.get("content_body", "")[:80],
        "hook_suggestion":  "",
    }

    try:
        new_content = _generate_content_for_brief(brief, rejection_reason=rejection_reason)
        new_content["previous_version_id"] = str(item["_id"])
        new_content["regeneration_reason"]  = rejection_reason
        db.content_library.insert_one(new_content)
        print(f"Regeneration complete. New content item created for brand={brief['brand']}.")
    except Exception as e:
        print(f"Regeneration failed: {e}")
        # Roll back status so DM Leader sees it hasn't disappeared
        db.content_library.update_one({"_id": obj_id}, {"$set": {"status": "rejected"}})
