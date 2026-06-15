"""
Competitor Intelligence — Step 8: AI Quality Review (OpenAI GPT-4o)
Scores each post: Brand Alignment, Originality, Readability (0-100 each).
"""
import json, os

try:
    from openai import OpenAI
    _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    _model  = os.getenv("CHAT_MODEL", "gpt-4o")
except Exception:
    _client = None

_SYSTEM = """You are a content quality reviewer for a professional services firm.
Score this social media post on three dimensions (0-100 each):
- brand_score: tone, audience fit, brand positioning
- originality_score: original ideas, avoids clichés, not generic
- readability_score: clear, well-structured, grammatically correct

Return ONLY valid JSON: {"brand_score": 85, "originality_score": 78, "readability_score": 92}
No explanation. No markdown."""


def review_post(brand: str, platform: str, headline: str, content: str) -> tuple:
    if not _client:
        return _heuristic(content)
    try:
        resp = _client.chat.completions.create(
            model=_model,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": f"Brand: {brand}\nPlatform: {platform}\nHeadline: {headline}\n\n{content}"},
            ],
            temperature=0.1,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1].lstrip("json").strip()
        s = json.loads(raw)
        return int(s.get("brand_score", 75)), int(s.get("originality_score", 75)), int(s.get("readability_score", 75))
    except Exception as e:
        print(f"[QualityReviewer] Error: {e}")
        return _heuristic(content)


def _heuristic(content: str) -> tuple:
    length = len(content)
    has_numbers  = any(c.isdigit() for c in content)
    has_hashtags = "#" in content
    readability  = min(95, 60 + (length // 50))
    originality  = 78 if has_numbers else 65
    brand        = 80 if has_hashtags else 72
    return brand, originality, readability


def bulk_review(posts: list) -> list:
    for p in posts:
        b, o, r = review_post(p.brand, p.platform, p.headline or "", p.content or "")
        p.quality_brand_score        = b
        p.quality_originality_score  = o
        p.quality_readability_score  = r
    return posts
