"""
Competitor Intelligence — Step 2: Social Media Data Collection
Pluggable adapter per platform. Default uses realistic mock data so the full
pipeline runs immediately. Swap _mock_adapter with a real API adapter
(Apify, official SDK) without changing anything else.
"""
import json
import random
from datetime import datetime, timedelta, timezone

PLATFORMS = ["linkedin", "facebook", "instagram", "twitter", "youtube"]

_MOCK_POSTS = {
    "linkedin": [
        "Tax season is here — are you maximizing your deductions?\n\nMost business owners leave money on the table because they don't know these 5 strategies:\n\n1. Home office deduction — even partial use qualifies\n2. Vehicle mileage — track every business mile\n3. Retirement contributions — reduce taxable income today\n4. Section 179 — expense equipment immediately\n5. Health insurance premiums — often fully deductible\n\nWhich one surprised you most? Drop a comment below.\n\n#TaxPlanning #SmallBusiness #CPA #TaxTips",
        "We helped a client save $47,000 in taxes last year.\n\nNot through loopholes. Not through tricks.\n\nJust proper structuring, timing, and strategy.\n\nThe difference between a good accountant and a great one isn't the forms they file — it's the conversations they have in September, not April.\n\nIf your CPA only calls you during tax season, it might be time to talk.\n\n#TaxAdvisory #BusinessOwner #CFOServices",
        "S-Corp vs LLC — which is better for your business?\n\nThe honest answer: it depends.\n\nS-Corp ✅\n— Saves self-employment tax above ~$40k profit\n— Requires reasonable salary\n— More admin overhead\n\nLLC ✅\n— Simpler to run\n— Flexible profit distribution\n— Pass-through taxation\n\nThe crossover point is usually $50–80k net profit.\n\nBook a free 30-min call to find out which fits you.\n\n#SCorp #LLC #BusinessStructure #TaxStrategy",
        "3 things your CPA should be doing that they probably aren't:\n\n1. Proactive tax planning — not just filing\n2. Entity structure review every 2–3 years\n3. Quarterly check-ins, not just April calls\n\nAdvisory-level service is the standard. Not the exception.\n\n#CPA #TaxAdvisory #SmallBusiness",
        "The IRS audited 0.4% of individual returns last year.\n\nBut for S-Corps with $1M+ in revenue? That number jumps significantly.\n\nAre you audit-ready?\n\nHere's what we check for every client before year-end:\n✅ Reasonable compensation documented\n✅ Business expenses properly categorized\n✅ Minutes and resolutions up to date\n✅ Shareholder loans documented\n\n#AuditReady #SCorp #IRS #TaxPlanning",
    ],
    "facebook": [
        "Quick reminder: Q2 estimated tax payment is due June 15th! Don't get caught with a penalty. Reach out if you need help calculating your payment. 💼 #TaxDeadline #EstimatedTax",
        "Did you start a new business this year? Make sure you're set up correctly from Day 1 — entity structure, EIN, accounting system, and payroll. Getting it right now saves thousands later. DM us! #StartupCPA #NewBusiness",
        "Proud to share that we just helped our 500th client this year! Thank you for trusting us with your financial future. 🎉 #Milestone #CPAFirm #ClientAppreciation",
        "It's not too early to think about year-end tax planning. In fact, September is the perfect time to review your estimated payments, deductions, and retirement contributions. Let's chat! #YearEndPlanning",
    ],
    "instagram": [
        "Tax tip Tuesday 💡 Did you know you can deduct up to $1,160,000 of equipment this year under Section 179? Swipe to learn more. #TaxTips #Section179 #CPA",
        "Behind the scenes at our team offsite 🤝 A team that grows together delivers better results for our clients. #TeamCulture #CPALife #WorkCulture",
        "Q: When should you start working with a CPA?\nA: Before you need one.\n\nProactive planning > reactive filing. 📊 #FinancialPlanning #Accounting #CPATips",
        "5 documents every business owner should have ready at year-end 📋 Save this post! #BusinessTips #YearEnd #Accounting",
    ],
    "twitter": [
        "Most business owners pay too much in taxes — not because of bad luck, but because of bad timing. Strategy built in January beats scrambling in April every time. #TaxPlanning",
        "Unpopular opinion: your accountant should be telling you what to do, not just reporting what happened. Advisory > compliance. #CPA",
        "3 signs you've outgrown your accountant:\n1. They only call during tax season\n2. They've never mentioned entity structure\n3. You don't know your tax rate for next year\n\nThere's a better way. #BusinessGrowth",
        "The S-Corp election deadline most people miss: you have 75 days from formation OR by March 15 for the prior year. Miss it and you wait another full year. #SCorp #TaxTip",
    ],
    "youtube": [
        "New video: How to reduce your 2026 tax bill — 7 strategies every business owner should know. Watch now! #TaxTips #YouTube #CPA",
        "LIVE Q&A recap: Your top 20 tax questions answered. Timestamps in the comments! #CPA #TaxHelp #LiveQA",
        "Case study: How we restructured a $2M revenue business and saved them $83k in taxes. Full breakdown in the video. #CaseStudy #TaxSavings",
    ],
}


def _mock_adapter(competitor, platform: str, days_back: int, run_id: int) -> list[dict]:
    handle = getattr(competitor, f"{platform}_handle", None)
    if not handle:
        return []

    templates = _MOCK_POSTS.get(platform, _MOCK_POSTS["linkedin"])
    count = random.randint(1, min(4, len(templates)))
    posts = []

    for i in range(count):
        days_ago = random.randint(0, days_back - 1)
        pub_date = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=random.randint(0, 23))
        likes    = random.randint(20, 2500)
        comments = random.randint(2, 300)
        shares   = random.randint(0, 200)
        reposts  = random.randint(0, 100)
        views    = random.randint(300, 60000)

        posts.append({
            "competitor_id": competitor.id,
            "run_id": run_id,
            "platform": platform,
            "post_id": f"mock_{platform}_{competitor.id}_{i}_{random.randint(10000,99999)}",
            "post_url": f"https://{platform}.com/{handle}/posts/{random.randint(100000,999999)}",
            "content": templates[i % len(templates)],
            "media_urls": json.dumps([]),
            "published_at": pub_date,
            "likes": likes,
            "comments": comments,
            "shares": shares,
            "reposts": reposts,
            "views": views,
        })
    return posts


def collect_posts(competitors: list, run_id: int, days_back: int = 7) -> list[dict]:
    all_posts = []
    for competitor in competitors:
        if not competitor.is_active:
            continue
        for platform in PLATFORMS:
            all_posts.extend(_mock_adapter(competitor, platform, days_back, run_id))
    return all_posts
