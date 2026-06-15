# migrations/create_indexes.py
# Required indexes for performance — run once
import os
import sys

# Add parent directory to path so we can import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mongo import db
import pymongo

print("Running migration: create_indexes...")

# Indexes for content_library
db.content_library.create_index([("status", pymongo.ASCENDING), ("brand", pymongo.ASCENDING)])
db.content_library.create_index([("scheduled_at", pymongo.ASCENDING)])
db.content_library.create_index([("smo_generated", pymongo.ASCENDING)])
print("Indexes created for content_library.")

# Indexes for smo_briefs
db.smo_briefs.create_index([("status", pymongo.ASCENDING), ("brand", pymongo.ASCENDING)])
print("Indexes created for smo_briefs.")

# Indexes for agent1_brief_context
db.agent1_brief_context.create_index([("week_start", pymongo.DESCENDING)])
print("Indexes created for agent1_brief_context.")

print("Index migration complete.")
