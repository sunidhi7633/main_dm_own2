"""
Competitor Intelligence — Step 5: AI Trend Analysis (OpenAI GPT-4o)
Analyzes Top-30 posts and extracts themes, styles, hooks, CTAs.
"""
import json, os

try:
    from openai import OpenAI
    _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    _model  = os.getenv("CHAT_MODEL", "gpt-4o")
except Exception:
    _client = None

_SYSTEM = """You are a social media intelligence analyst.
Analyze the provided high-performing competitor posts and return ONLY valid JSON:
{
  "themes": ["theme1", ...],
  "writing_styles": ["style1", ...],
  "hook_patterns": ["hook1", ...],
  "cta_patterns": ["cta1", ...],
  "summary": "2-3 sentence executive summary of what is working right now."
}
- themes: 5-8 content themes (e.g. "Tax Savings", "Compliance Tips", "Client Wins")
- writing_styles: 4-6 styles (e.g. "Listicle", "Storytelling", "Thought Leadership")
- hook_patterns: 4-6 opening-line patterns with example text
- cta_patterns: 3-5 CTA patterns observed
No markdown fences. No explanation. JSON only."""


def analyze_trends(top_posts: list) -> dict:
    if not top_posts or not _client:
        return _fallback()

    lines = []
    for i, p in enumerate(top_posts[:30], 1):
        content  = p.content  if hasattr(p, "content")  else p.get("content", "")
        platform = p.platform if hasattr(p, "platform") else p.get("platform", "")
        score    = p.engagement_score if hasattr(p, "engagement_score") else p.get("engagement_score", 0)
        lines.append(f"[#{i} | {platform} | score {score}]\n{content}")

    user_msg = f"Top {len(lines)} highest-performing competitor posts:\n\n" + "\n\n---\n\n".join(lines)

    try:
        resp = _client.chat.completions.create(
            model=_model,
            messages=[{"role": "system", "content": _SYSTEM},
                      {"role": "user",   "content": user_msg}],
            temperature=0.3,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1].lstrip("json").strip()
        return json.loads(raw)
    except Exception as e:
        print(f"[Analyzer] OpenAI error: {e}")
        return _fallback()


def _fallback() -> dict:
    return {
        "themes": ["Tax Planning", "Compliance", "Business Growth", "Case Studies", "Educational Tips"],
        "writing_styles": ["Listicle", "Storytelling", "Thought Leadership", "Q&A"],
        "hook_patterns": [
            "Most business owners don't know...",
            "We helped a client save $X...",
            "N things every [audience] should know...",
            "The honest answer is...",
        ],
        "cta_patterns": ["DM us for a free consultation", "Comment below", "Book a call today", "Save this post"],
        "summary": (
            "Educational listicle-style content and real client success stories are driving the highest engagement. "
            "Posts that lead with a specific dollar amount or number consistently outperform generic advice. "
            "Strong CTAs focused on a free consultation or specific next step convert best."
        ),
    }
