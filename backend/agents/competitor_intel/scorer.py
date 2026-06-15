"""
Competitor Intelligence — Step 3 & 4: Scoring + Top-N Selection
Score = (w_likes × likes) + (w_comments × comments)
      + (w_shares × (shares + reposts)) + (w_views × views)
"""


def compute_score(likes, comments, shares, views, reposts=0,
                  w_likes=1.0, w_comments=3.0, w_shares=5.0, w_views=0.1):
    return int(w_likes * likes + w_comments * comments
               + w_shares * (shares + reposts) + w_views * views)


def score_and_rank(posts: list, config=None) -> list:
    w_l = float(getattr(config, "weight_likes",    1) if config else 1)
    w_c = float(getattr(config, "weight_comments", 3) if config else 3)
    w_s = float(getattr(config, "weight_shares",   5) if config else 5)
    w_v = float(getattr(config, "weight_views",    0) if config else 0) * 0.1

    for p in posts:
        if hasattr(p, "__setattr__"):
            p.engagement_score = compute_score(p.likes, p.comments, p.shares, p.views, p.reposts, w_l, w_c, w_s, w_v)
        else:
            p["engagement_score"] = compute_score(p.get("likes",0), p.get("comments",0), p.get("shares",0), p.get("views",0), p.get("reposts",0), w_l, w_c, w_s, w_v)

    posts.sort(key=lambda p: (p.engagement_score if hasattr(p,"engagement_score") else p["engagement_score"]), reverse=True)

    for i, p in enumerate(posts):
        if hasattr(p, "__setattr__"):
            p.rank = i + 1
        else:
            p["rank"] = i + 1

    return posts


def select_top_n(posts: list, n: int = 30) -> list:
    return posts[:n]
