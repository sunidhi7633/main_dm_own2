from dotenv import load_dotenv
load_dotenv()
from mongo import db

docs = list(db.content_library.find({"status": "pending_review"}, {"brand": 1, "format": 1, "platform": 1, "ai_prescore": 1}))
print("Found %d posts in Review Queue:" % len(docs))
for d in docs:
    score = d.get("ai_prescore", {}).get("score", "?")
    print("  - [%s] %s on %s  Score: %s/100" % (d["brand"], d["format"], d["platform"], score))
