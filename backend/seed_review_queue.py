"""
Run once to seed the Review Queue with realistic test posts.
Usage: python seed_review_queue.py
"""
from dotenv import load_dotenv
load_dotenv()

from datetime import datetime, timedelta
from mongo import db

posts = [
    {
        "brand": "hcllp",
        "platform": ["LinkedIn"],
        "format": "carousel",
        "content_body": (
            "Tax season doesn't have to be stressful. Here are 5 things every small business owner "
            "should do before April 15th:\n\n"
            "✅ Slide 1 — Separate business & personal expenses NOW\n"
            "✅ Slide 2 — Review your estimated tax payments\n"
            "✅ Slide 3 — Maximise deductions: home office, mileage, equipment\n"
            "✅ Slide 4 — Check payroll tax deposits are up to date\n"
            "✅ Slide 5 — Book a free consultation with Harshwal & Company\n\n"
            "At Harshwal & Company LLP, we help SMBs stay ahead of deadlines with proactive planning — "
            "not last-minute panic. DM us today.\n\n"
            "#TaxPlanning #SmallBusiness #CPA #HarshwalConsulting #TaxSeason2026"
        ),
        "caption": "5 tax season tips every small business owner must know before April 15th.",
        "faq_num": 2,
        "tagline_num": 1,
        "target_hashtags": ["TaxPlanning", "SmallBusiness", "CPA", "HarshwalConsulting"],
        "scheduled_at": (datetime.utcnow() + timedelta(days=2)).replace(hour=9, minute=0, second=0, microsecond=0),
        "ai_prescore": {"score": 88, "breakdown": {"brand_voice": 28, "faq_match": 18, "tagline_match": 17, "length": 13, "hashtags": 12}},
        "status": "pending_review",
        "smo_generated": True,
        "designer_approved": False,
        "utm_params": "utm_source=agent2&utm_medium=linkedin&utm_campaign=hcllp",
        "live_url": None,
        "rejection_reason": None,
        "cascade_parent_id": None,
        "engagement_velocity_sent": False,
        "created_at": datetime.utcnow(),
    },
    {
        "brand": "hcllp",
        "platform": ["LinkedIn", "Facebook"],
        "format": "text",
        "content_body": (
            "Did you know? The IRS introduced 5 major tax law changes in 2026 that directly affect "
            "S-Corp owners.\n\n"
            "Here's what changed:\n"
            "🔹 Reasonable compensation threshold updated\n"
            "🔹 Built-in gains tax period shortened\n"
            "🔹 Pass-through deduction (Section 199A) extended\n"
            "🔹 New audit triggers for distributions vs. salary\n"
            "🔹 Updated basis tracking requirements\n\n"
            "If you run an S-Corp and haven't reviewed your structure this year, now is the time.\n"
            "Schedule a free 30-minute call with our team at Harshwal & Company LLP.\n\n"
            "#SCorp #TaxLaw2026 #BusinessOwners #CPA #TaxAdvisory"
        ),
        "caption": "5 IRS tax changes in 2026 every S-Corp owner must know about.",
        "faq_num": 3,
        "tagline_num": 2,
        "target_hashtags": ["SCorp", "TaxLaw2026", "BusinessOwners", "CPA"],
        "scheduled_at": (datetime.utcnow() + timedelta(days=3)).replace(hour=10, minute=0, second=0, microsecond=0),
        "ai_prescore": {"score": 76, "breakdown": {"brand_voice": 24, "faq_match": 16, "tagline_match": 14, "length": 12, "hashtags": 10}},
        "status": "pending_review",
        "smo_generated": True,
        "designer_approved": False,
        "utm_params": "utm_source=agent2&utm_medium=linkedin&utm_campaign=hcllp",
        "live_url": None,
        "rejection_reason": None,
        "cascade_parent_id": None,
        "engagement_velocity_sent": False,
        "created_at": datetime.utcnow(),
    },
    {
        "brand": "blue_arrow_cpa",
        "platform": ["LinkedIn"],
        "format": "text",
        "content_body": (
            "Tribal governments face unique audit requirements under 2 CFR Part 200 that most "
            "CPA firms simply aren't equipped to handle.\n\n"
            "At Blue Arrow CPA, we specialise in:\n"
            "🏛️ Single Audit / SEFA preparation\n"
            "🏛️ Federal grant compliance under Uniform Guidance\n"
            "🏛️ Tribal sovereignty and governmental accounting standards\n"
            "🏛️ Indian Gaming Regulatory Act (IGRA) compliance\n\n"
            "We don't just audit — we partner with tribal nations to build long-term financial "
            "governance that honours sovereignty and satisfies federal requirements.\n\n"
            "Reach out to discuss your tribe's upcoming audit cycle.\n\n"
            "#TribalGovernment #2CFRPart200 #SingleAudit #SEFA #BlueArrowCPA"
        ),
        "caption": "Tribal governments deserve a CPA firm that truly understands sovereignty and federal compliance.",
        "faq_num": 1,
        "tagline_num": 1,
        "target_hashtags": ["TribalGovernment", "2CFRPart200", "SingleAudit", "BlueArrowCPA"],
        "scheduled_at": (datetime.utcnow() + timedelta(days=2)).replace(hour=11, minute=0, second=0, microsecond=0),
        "ai_prescore": {"score": 91, "breakdown": {"brand_voice": 29, "faq_match": 20, "tagline_match": 18, "length": 14, "hashtags": 10}},
        "status": "pending_review",
        "smo_generated": True,
        "designer_approved": True,   # already designer-approved so Approve button is unlocked
        "utm_params": "utm_source=agent2&utm_medium=linkedin&utm_campaign=blue_arrow_cpa",
        "live_url": None,
        "rejection_reason": None,
        "cascade_parent_id": None,
        "engagement_velocity_sent": False,
        "created_at": datetime.utcnow(),
    },
    {
        "brand": "advisory",
        "platform": ["LinkedIn"],
        "format": "blog",
        "content_body": (
            "# How Growth-Stage Companies Can Prepare for a Series B Audit\n\n"
            "## Why the audit matters more than you think\n"
            "Investors at Series B don't just look at your numbers — they look at how clean your "
            "financial controls are. A messy audit signals operational risk, not just accounting risk.\n\n"
            "## The 3 areas VCs flag most often\n"
            "Revenue recognition under ASC 606 is the number one audit finding in SaaS companies. "
            "If your contracts have variable consideration, milestone billing, or bundled performance "
            "obligations, you need a clear revenue recognition policy documented before the audit starts.\n\n"
            "Equity and cap table management is the second most common issue. Stock option expensing "
            "under ASC 718, 409A valuations, and SAFEs converting to equity all need clean documentation.\n\n"
            "Related-party transactions are scrutinised heavily. Any transactions between founders, "
            "family members, or affiliated entities must be at arm's length and properly disclosed.\n\n"
            "## What to do 90 days before your Series B\n"
            "Work with an advisor who has done this before. Harshwal Advisory has guided 12 companies "
            "through Series B audit preparation in the last 3 years — we know exactly what investors "
            "and auditors look for.\n\n"
            "Book a free readiness assessment today.\n\n"
            "#SeriesB #StartupFinance #VentureCapital #AuditReadiness #HarshwalAdvisory"
        ),
        "caption": "Your Series B audit will make or break investor confidence. Here is how to prepare.",
        "faq_num": 4,
        "tagline_num": 3,
        "target_hashtags": ["SeriesB", "StartupFinance", "VentureCapital", "HarshwalAdvisory"],
        "scheduled_at": (datetime.utcnow() + timedelta(days=4)).replace(hour=9, minute=0, second=0, microsecond=0),
        "ai_prescore": {"score": 94, "breakdown": {"brand_voice": 30, "faq_match": 20, "tagline_match": 18, "length": 15, "hashtags": 11}},
        "status": "pending_review",
        "smo_generated": True,
        "designer_approved": False,
        "utm_params": "utm_source=agent2&utm_medium=linkedin&utm_campaign=advisory",
        "live_url": None,
        "rejection_reason": None,
        "cascade_parent_id": None,
        "engagement_velocity_sent": False,
        "created_at": datetime.utcnow(),
    },
]

result = db.content_library.insert_many(posts)
print(f"\n✅ Seeded {len(result.inserted_ids)} posts into content_library (status: pending_review)")
print("\nPosts added:")
for post in posts:
    print(f"  • [{post['brand']}] {post['format'].upper()} — {post['platform']} — Score: {post['ai_prescore']['score']}/100")

print("\nGo to: http://localhost:3000/review")
print("You should see all 4 posts in the Review Queue.\n")
