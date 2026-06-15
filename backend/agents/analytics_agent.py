import os
import sys
from datetime import datetime, timedelta
from collections import defaultdict

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from mongo import db


def _get_published_analytics(since_days: int = 14) -> list:
    """Pull published content with their analytics from the last N days."""
    since = datetime.utcnow() - timedelta(days=since_days)

    # Get analytics records
    analytics = list(db.content_analytics.find({"published_at": {"$gte": since}}))
    if not analytics:
        return []

    # Join with content_library to get topic/format/brand/faq_num
    results = []
    for rec in analytics:
        from bson import ObjectId
        try:
            content_id = rec.get("content_id")
            try:
                content = db.content_library.find_one({"_id": ObjectId(content_id)})
            except Exception:
                content = db.content_library.find_one({"_id": content_id})

            if not content:
                continue

            # Build a combined record with all fields we need
            results.append({
                "brand": rec.get("brand") or content.get("brand"),
                "platform": rec.get("platform", []),
                "format": content.get("format", "text"),
                "topic": content.get("caption") or content.get("content_body", "")[:80],
                "faq_num": content.get("faq_num", 1),
                "tagline_num": content.get("tagline_num", 1),
                "engagement": rec.get("engagement", 0),
                "saves": rec.get("saves", 0),
                "prescore": content.get("ai_prescore", {}).get("score", 0) if content.get("ai_prescore") else 0,
                "hashtags": content.get("target_hashtags", []),
            })
        except Exception:
            continue

    return results


def _get_prescore_proxy(since_days: int = 14) -> list:
    """
    Fallback when no published analytics exist yet.
    Uses ai_prescore scores from recently generated content as a quality proxy.
    """
    since = datetime.utcnow() - timedelta(days=since_days)
    items = list(db.content_library.find({
        "created_at": {"$gte": since},
        "ai_prescore": {"$ne": None},
        "status": {"$in": ["published", "approved", "pending_review"]}
    }))

    results = []
    for item in items:
        prescore = item.get("ai_prescore") or {}
        results.append({
            "brand": item.get("brand"),
            "platform": item.get("platform", []),
            "format": item.get("format", "text"),
            "topic": item.get("caption") or item.get("content_body", "")[:80],
            "faq_num": item.get("faq_num", 1),
            "tagline_num": item.get("tagline_num", 1),
            "engagement": prescore.get("score", 0),  # score as proxy for engagement
            "saves": 0,
            "prescore": prescore.get("score", 0),
            "hashtags": item.get("target_hashtags", []),
        })
    return results


def _analyze(records: list, brand: str) -> dict:
    """Compute top/worst topics, top formats, top faq_nums for a brand."""
    brand_recs = [r for r in records if r.get("brand") == brand]

    if not brand_recs:
        return None

    # Sort by engagement descending
    sorted_recs = sorted(brand_recs, key=lambda r: r.get("engagement", 0), reverse=True)

    top_half = sorted_recs[: max(1, len(sorted_recs) // 2)]
    bottom_half = sorted_recs[max(1, len(sorted_recs) // 2):]

    top_topics = list({r["topic"][:60] for r in top_half if r.get("topic")})[:5]
    worst_topics = list({r["topic"][:60] for r in bottom_half if r.get("topic")})[:3]

    # Best formats by average engagement
    format_scores = defaultdict(list)
    for r in brand_recs:
        format_scores[r["format"]].append(r.get("engagement", 0))
    avg_by_format = {fmt: sum(scores) / len(scores) for fmt, scores in format_scores.items()}
    top_formats = sorted(avg_by_format, key=avg_by_format.get, reverse=True)[:3]

    # Top FAQ nums used in high-scoring content
    top_faq_nums = list({r["faq_num"] for r in top_half})[:3]

    # Most-used hashtags in top performers
    hashtag_counts = defaultdict(int)
    for r in top_half:
        for tag in r.get("hashtags", []):
            hashtag_counts[tag.lower().lstrip("#")] += 1
    top_hashtags = sorted(hashtag_counts, key=hashtag_counts.get, reverse=True)[:10]

    avg_engagement = sum(r.get("engagement", 0) for r in brand_recs) / len(brand_recs)

    return {
        "top_topics": top_topics,
        "worst_topics": worst_topics,
        "top_formats": top_formats if top_formats else ["carousel", "text"],
        "top_faq_nums": top_faq_nums if top_faq_nums else [1],
        "top_hashtags": top_hashtags,
        "avg_engagement": round(avg_engagement, 2),
        "total_posts_analyzed": len(brand_recs),
    }


def write_brief_context():
    """
    Celery task: smo-agent4-performance-pull
    Runs Mon 7:30AM. Reads content_analytics (real) or prescore proxy (early-stage).
    Writes brand-specific performance context to agent1_brief_context for Agent 1.
    """
    print("Running Agent 4: Analyzing real performance data...")

    records = _get_published_analytics(since_days=14)
    data_source = "content_analytics"

    if not records:
        print("No published analytics yet — falling back to ai_prescore as quality proxy.")
        records = _get_prescore_proxy(since_days=14)
        data_source = "prescore_proxy"

    if not records:
        print("No data available at all. Skipping Agent 4 context write.")
        return

    print(f"Agent 4: {len(records)} records from '{data_source}'.")

    BRANDS = ["hcllp", "blue_arrow_cpa", "advisory"]
    now = datetime.utcnow()

    contexts_written = 0
    for brand in BRANDS:
        analysis = _analyze(records, brand)
        if not analysis:
            print(f"  No data for brand '{brand}' — skipping.")
            continue

        context = {
            "week_start": now,
            "brand": brand,
            "data_source": data_source,
            "top_topics": analysis["top_topics"],
            "top_formats": analysis["top_formats"],
            "worst_topics": analysis["worst_topics"],
            "top_faq_nums": analysis["top_faq_nums"],
            "top_hashtags": analysis["top_hashtags"],
            "avg_engagement": analysis["avg_engagement"],
            "total_posts_analyzed": analysis["total_posts_analyzed"],
            "notes": (
                f"Analyzed {analysis['total_posts_analyzed']} posts via {data_source}. "
                f"Avg engagement: {analysis['avg_engagement']}. "
                f"Top formats: {', '.join(analysis['top_formats'])}."
            ),
        }

        db.agent1_brief_context.insert_one(context)
        print(
            f"  Agent 4 wrote context for {brand}: "
            f"top_topics={analysis['top_topics'][:2]}, "
            f"top_formats={analysis['top_formats']}"
        )
        contexts_written += 1

    print(f"Agent 4 complete. Wrote {contexts_written} brand contexts to agent1_brief_context.")
