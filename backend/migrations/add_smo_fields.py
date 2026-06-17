# migrations/add_smo_fields.py
# Run once on first deployment
import os
import sys

# Add parent directory to path so we can import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mongo import db

print("Running migration: add_smo_fields...")

# 1. New fields on hcis.content_library
result = db.content_library.update_many(
    {},
    {"$set": {
        "smo_generated": False,               # True = came from Agent 1/2
        "designer_approved": False,           # Blue Arrow gate flag
        "ai_prescore": None,                  # {score, brand_voice, faq_verified, ...}
        "engagement_velocity_sent": False,    # 60-min post-publish alert fired?
        "live_url": None,                     # Populated by Agent 3 after publish
        "rejection_reason": None,             # DM Leader rejection text
        "cascade_parent_id": None,            # Blog ID if this is a cascade post
    }}
)

print(f"Updated {result.modified_count} existing content_library documents.")

# Note: In MongoDB, collections are created implicitly when you first insert a document.
# If you want to explicitly create them:
if "smo_briefs" not in db.list_collection_names():
    db.create_collection("smo_briefs")
    print("Created smo_briefs collection.")

if "agent1_brief_context" not in db.list_collection_names():
    db.create_collection("agent1_brief_context")
    print("Created agent1_brief_context collection.")

print("Migration complete.")
