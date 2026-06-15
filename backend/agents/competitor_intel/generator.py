"""
Competitor Intelligence — Steps 6 & 7: Brand Adaptation + Content Generation (OpenAI GPT-4o)
Generates 30 branded posts per brand: 10 LinkedIn, 5 Facebook, 10 Twitter, 5 Instagram.
"""
import json, os

try:
    from openai import OpenAI
    _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    _model  = os.getenv("CHAT_MODEL", "gpt-4o")
except Exception:
    _client = None

BRAND_PROFILES = {
    "hcllp": {
        "name": "Harshwal & Company LLP",
        "industry": "CPA / Tax & Accounting",
        "services": "Tax preparation, tax planning, bookkeeping, payroll, IRS representation, S-Corp/LLC structuring, estate planning",
        "audience": "Small and mid-size business owners, S-Corp owners, high-net-worth individuals, self-employed professionals",
        "tone": "Professional, approachable, practical. Plain English. Cite IRS/IRC sections when helpful.",
        "avoid": "tribal government accounting, venture capital / M&A topics",
    },
    "blue_arrow_cpa": {
        "name": "Blue Arrow CPA",
        "industry": "Government & Tribal Accounting",
        "services": "Single Audit (2 CFR Part 200), SEFA preparation, federal grant compliance, IGRA compliance, GASB standards, tribal financial governance",
        "audience": "Tribal governments, tribal enterprises, Native American nonprofits, BIA-funded programs",
        "tone": "Authoritative, compliance-focused, respectful of tribal sovereignty. Cite 2 CFR Part 200, GASB, IGRA precisely.",
        "avoid": "SMB tax tips, startup/VC finance",
    },
    "advisory": {
        "name": "Harshwal Advisory",
        "industry": "Strategic Business Advisory",
        "services": "Series A/B audit readiness, ASC 606 revenue recognition, ASC 718 equity comp, 409A valuations, cap table management, CFO advisory, M&A support",
        "audience": "Venture-backed founders, growth-stage companies (Series A-C), CFOs, investors",
        "tone": "Strategic, investor-aware, sophisticated. Speak VC language. Reference ASC and SEC standards.",
        "avoid": "SMB tax tips, tribal government topics",
    },
}

PLATFORM_SPECS = {
    "linkedin":  {"count": 10, "max_chars": 3000, "style": "professional long-form, line breaks, numbered lists OK"},
    "facebook":  {"count": 5,  "max_chars": 500,  "style": "conversational, warm, community-focused, 1-2 emojis"},
    "twitter":   {"count": 10, "max_chars": 280,  "style": "punchy, hook-first, opinionated, minimal hashtags"},
    "instagram": {"count": 5,  "max_chars": 400,  "style": "visual caption, emoji-friendly, 5-10 hashtags at end"},
}

_SYSTEM = """You are a senior social media content strategist for a professional services firm.
Generate ONE branded post. Extract ideas from competitor trends but rewrite completely — do NOT copy.
Return ONLY valid JSON:
{
  "headline": "max 10 words",
  "content": "full post body",
  "cta": "clear call to action",
  "hashtags": ["tag1", "tag2"],
  "image_prompt": "detailed visual description for DALL-E/Midjourney: style, colors, subject, mood (2-3 sentences)"
}
No markdown fences. JSON only."""


def _call_openai(prompt: str) -> dict:
    resp = _client.chat.completions.create(
        model=_model,
        messages=[{"role": "system", "content": _SYSTEM},
                  {"role": "user",   "content": prompt}],
        temperature=0.85,
    )
    raw = resp.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json").strip()
    return json.loads(raw)


def _format_calendar_context(events: list) -> str:
    if not events:
        return ""
    lines = ["UPCOMING CALENDAR EVENTS (generate content relevant to these):"]
    for e in events:
        date = e.get("event_date", "")[:10] if isinstance(e, dict) else (e.event_date.strftime("%Y-%m-%d") if e.event_date else "")
        name = e.get("event_name", "") if isinstance(e, dict) else e.event_name
        etype = e.get("event_type", "") if isinstance(e, dict) else (e.event_type or "")
        notes = e.get("notes", "") if isinstance(e, dict) else (e.notes or "")
        line = f"- {date}: {name} [{etype}]"
        if notes:
            line += f" — {notes}"
        lines.append(line)
    return "\n".join(lines)


def generate_content(run_id: int, trend_report: dict, brands: list = None,
                     top_post_ids: list = None, calendar_events: list = None) -> list[dict]:
    if brands is None:
        brands = list(BRAND_PROFILES.keys())

    trend_ctx = (
        f"Trending themes: {', '.join(trend_report.get('themes', [])[:4])}\n"
        f"Effective writing styles: {', '.join(trend_report.get('writing_styles', [])[:3])}\n"
        f"Hook patterns that work: {'; '.join(trend_report.get('hook_patterns', [])[:3])}\n"
        f"CTA patterns: {', '.join(trend_report.get('cta_patterns', [])[:2])}"
    )
    calendar_ctx = _format_calendar_context(calendar_events or [])

    results = []
    for brand_key in brands:
        bp = BRAND_PROFILES.get(brand_key)
        if not bp:
            continue
        for platform, specs in PLATFORM_SPECS.items():
            for i in range(specs["count"]):
                prompt = (
                    f"BRAND: {bp['name']}\n"
                    f"Industry: {bp['industry']}\n"
                    f"Services: {bp['services']}\n"
                    f"Audience: {bp['audience']}\n"
                    f"Tone: {bp['tone']}\n"
                    f"DO NOT mention: {bp['avoid']}\n\n"
                    f"PLATFORM: {platform.upper()} | Style: {specs['style']} | Max chars: {specs['max_chars']}\n\n"
                    f"TREND INTELLIGENCE:\n{trend_ctx}\n\n"
                    + (f"{calendar_ctx}\n\n" if calendar_ctx else "")
                    + f"VARIATION #{i+1}: Fresh angle, do not repeat previous variations."
                    + (" Where relevant, tie the content to one of the upcoming calendar events above." if calendar_ctx else "")
                )

                if _client:
                    try:
                        post = _call_openai(prompt)
                    except Exception as e:
                        print(f"[Generator] OpenAI error {brand_key}/{platform}#{i}: {e}")
                        post = _fallback_post(bp["name"], platform, i)
                else:
                    post = _fallback_post(bp["name"], platform, i)

                results.append({
                    "run_id": run_id,
                    "brand": brand_key,
                    "platform": platform,
                    "headline": post.get("headline", ""),
                    "content": post.get("content", ""),
                    "cta": post.get("cta", ""),
                    "hashtags": json.dumps(post.get("hashtags", [])),
                    "image_prompt": post.get("image_prompt", ""),
                    "inspiration_post_ids": json.dumps((top_post_ids or [])[:5]),
                    "status": "draft",
                })
    return results


def _fallback_post(brand_name: str, platform: str, i: int) -> dict:
    headlines = ["The Tax Strategy Most Owners Miss", "What Strong Financials Look Like",
                 "5 Questions to Ask Your CPA", "Stop Filing. Start Planning.",
                 "Why Entity Structure Matters More Than Rate"]
    return {
        "headline": headlines[i % len(headlines)],
        "content": f"[{brand_name}] {platform} variation {i+1}. Set OPENAI_API_KEY to generate real content.",
        "cta": "Book a free consultation today.",
        "hashtags": ["#CPA", "#TaxPlanning", "#BusinessAdvisory"],
    }
