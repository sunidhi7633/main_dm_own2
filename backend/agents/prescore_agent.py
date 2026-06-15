import os
import json
from datetime import datetime
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from mongo import db
from notifications.whatsapp import send_whatsapp_flag_alert, notify_designer_visual_queue

try:
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage, SystemMessage
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
except Exception:
    llm = None

# ---------------------------------------------------------------------------
# Per-brand defaults — used when MongoDB collections aren't seeded yet.
# Seed db.faqs / db.brand_guides / db.taglines to override these.
# ---------------------------------------------------------------------------

_FAQ_DEFAULTS = {
    "hcllp": {
        1: "Harshwal & Company LLP is a full-service CPA firm offering tax preparation, audit, and advisory for SMBs and individuals.",
        2: "Tax deadlines: April 15 for individuals, March 15 for S-Corps and partnerships. Extensions available on request.",
        3: "We offer flat-fee pricing for most individual returns. Business returns are priced by complexity.",
    },
    "blue_arrow_cpa": {
        1: "Blue Arrow CPA specialises in audits under SEFA (Schedule of Expenditures of Federal Awards) and 2 CFR Part 200 for tribal governments.",
        2: "Tribal sovereignty gives each nation the right to self-governance. Financial reporting must respect tribal jurisdiction.",
        3: "2 CFR Part 200 (Uniform Guidance) governs federal grants for tribal entities. Compliance is mandatory for all federal award recipients.",
    },
    "advisory": {
        1: "Harshwal Advisory provides strategic financial planning, M&A advisory, and operational consulting for growth-stage companies.",
        2: "Our M&A process covers financial due diligence, valuation analysis, deal structuring, and post-merger integration.",
        3: "Engagements run on a retainer or project basis, typically 3–12 months depending on scope.",
    },
}

_BRAND_VOICE_DEFAULTS = {
    "hcllp": (
        "Tone: Professional, trustworthy, approachable. "
        "Language: Plain English — explain tax/financial terms when used. "
        "CTA: Always invite clients to schedule a consultation. "
        "Avoid: Fear-mongering about IRS audits, exaggerated savings claims."
    ),
    "blue_arrow_cpa": (
        "Tone: Respectful, community-first, sovereignty-aware. "
        "Language: Use specific tribal nation names when possible — never generic 'Native American'. "
        "Always reference 2 CFR Part 200 and SEFA by name for compliance topics. "
        "Avoid: Stereotypes, cultural generalizations, imagery descriptions that could be seen as cultural appropriation."
    ),
    "advisory": (
        "Tone: Strategic, confident, forward-looking. "
        "Language: Business-oriented and data-driven — cite real metrics and growth outcomes. "
        "CTA: Invite a strategy session or discovery call. "
        "Avoid: Vague promises, generic business advice without specifics."
    ),
}

_TAGLINE_DEFAULTS = {
    "hcllp": {
        1: "Your finances, simplified.",
        2: "Expert advice. Trusted results.",
        3: "Accounting that works for you.",
    },
    "blue_arrow_cpa": {
        1: "Honouring sovereignty through financial excellence.",
        2: "Tribal compliance, handled with respect.",
        3: "Where integrity meets tribal governance.",
    },
    "advisory": {
        1: "Strategy that drives growth.",
        2: "Your next move, backed by data.",
        3: "Advisory that delivers results.",
    },
}


# ---------------------------------------------------------------------------
# Loaders — MongoDB first, per-brand defaults as fallback
# ---------------------------------------------------------------------------

def load_faq(brand: str, faq_num: int) -> str:
    doc = db.faqs.find_one({"brand": brand, "faq_num": faq_num})
    if doc and doc.get("content"):
        return doc["content"]
    return _FAQ_DEFAULTS.get(brand, {}).get(faq_num, f"FAQ #{faq_num} for {brand} not seeded.")


def load_brand_voice(brand: str) -> str:
    doc = db.brand_guides.find_one({"brand": brand})
    if doc and doc.get("voice_guide"):
        return doc["voice_guide"]
    return _BRAND_VOICE_DEFAULTS.get(brand, f"Brand voice guide for {brand} not seeded.")


def load_tagline(brand: str, tagline_num: int) -> str:
    doc = db.taglines.find_one({"brand": brand, "tagline_num": tagline_num})
    if doc and doc.get("text"):
        return doc["text"]
    return _TAGLINE_DEFAULTS.get(brand, {}).get(tagline_num, f"Tagline #{tagline_num} for {brand} not seeded.")


# ---------------------------------------------------------------------------
# Core scoring
# ---------------------------------------------------------------------------

def prescore_content(content_item: dict) -> dict:
    brand = content_item.get("brand", "unknown")
    body = content_item.get("content_body", "")
    faq_num = content_item.get("faq_num", 1)
    tagline_num = content_item.get("tagline_num", 1)

    faq_text = load_faq(brand, faq_num)
    voice_guide = load_brand_voice(brand)
    tagline_text = load_tagline(brand, tagline_num)

    cultural_instruction = ""
    if brand == "blue_arrow_cpa":
        cultural_instruction = """
Extra check required — Blue Arrow CPA serves tribal governments.
Verify: no generalised "Native American" language (use specific sovereignty terms),
no stereotyped imagery descriptions, SEFA and 2 CFR Part 200 references are accurate,
tone is respectful and community-first. Score cultural_check True/False."""

    prompt = f"""You are a content quality reviewer for {brand}.

BRAND VOICE GUIDE: {voice_guide}
FAQ #{faq_num}: {faq_text}
TAGLINE #{tagline_num}: {tagline_text}

CONTENT TO REVIEW:
{body}

{cultural_instruction}

Review this content and respond ONLY with valid JSON in this exact structure:
{{
    "score": 0-100,
    "brand_voice_match": true/false,
    "faq_verified": true/false,
    "cultural_check": true/false,
    "flag_reason": "string or null if no issues",
    "brief_notes": "max 1 sentence of feedback"
}}

Scoring guide:
- 90-100: publish-ready, strong voice, verified facts
- 70-89: acceptable, minor improvements possible
- 50-69: brand voice issues or unverified claims — hold for DM review
- Below 50: clear problems — auto-flag
"""

    if not llm:
        print(f"Skipping prescore for {brand} — OPENAI_API_KEY not set.")
        result = {
            "score": 0,
            "brand_voice_match": False,
            "faq_verified": False,
            "cultural_check": False,
            "flag_reason": "LLM not configured — check OPENAI_API_KEY",
            "brief_notes": "",
        }
    else:
        try:
            response = llm.invoke([
                SystemMessage(content="You are a strict content quality reviewer. Respond ONLY with valid JSON."),
                HumanMessage(content=prompt),
            ])
            response_text = response.content.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            result = json.loads(response_text)
        except Exception as e:
            print(f"Error calling GPT-4o-mini prescore: {e}")
            result = {
                "score": 0,
                "brand_voice_match": False,
                "faq_verified": False,
                "cultural_check": False,
                "flag_reason": f"API Error: {str(e)}",
                "brief_notes": "",
            }

    result["passed"] = result.get("score", 0) >= 70
    result["scored_at"] = datetime.utcnow().isoformat()
    return result


# ---------------------------------------------------------------------------
# Batch runner (Celery task)
# ---------------------------------------------------------------------------

def run_prescore_batch():
    """Celery task — score all pending_prescore items."""
    print("Running prescore batch...")
    items = list(db.content_library.find({"status": "pending_prescore"}))

    if not items:
        print("No pending_prescore items found.")
        return

    for item in items:
        result = prescore_content(item)
        new_status = "pending_review" if result["passed"] else "flagged"

        # Blue Arrow: passed content needs visual designer review before DM approval
        if result["passed"] and item.get("brand") == "blue_arrow_cpa":
            new_status = "designer_pending"

        db.content_library.update_one(
            {"_id": item["_id"]},
            {"$set": {
                "status": new_status,
                "ai_prescore": result,
            }}
        )

        print(f"Scored item {item['_id']} -> {new_status} (Score: {result.get('score')})")

        if not result["passed"]:
            send_whatsapp_flag_alert(item, result.get("flag_reason", "Failed prescore"))

        # Notify designer immediately when Blue Arrow content enters their queue
        if new_status == "designer_pending":
            notify_designer_visual_queue(item)
            print(f"  Designer notified for Blue Arrow item {item['_id']}")
