import os
from pymongo import MongoClient
from sqlalchemy.orm import Session
from database import engine, Base
from models import Competitor

# Ensure tables exist
Base.metadata.create_all(bind=engine)

# Configuration: Update these with your old MongoDB details
MONGO_URI = os.getenv("LEGACY_MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = "hcis"
MONGO_COLLECTION_NAME = "competitors"

def migrate_competitors():
    print(f"Connecting to MongoDB at {MONGO_URI}...")
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.admin.command('ping') # Test connection
        db = client[MONGO_DB_NAME]
        collection = db[MONGO_COLLECTION_NAME]
    except Exception as e:
        print(f"Failed to connect to MongoDB. Is it running? Error: {e}")
        return

    legacy_competitors = list(collection.find({}))
    if not legacy_competitors:
        print("No competitors found in the legacy database.")
        return

    print(f"Found {len(legacy_competitors)} competitors. Migrating to PostgreSQL...")

    migrated_count = 0
    with Session(engine) as session:
        for old_comp in legacy_competitors:
            # Check if it already exists
            website_url = old_comp.get("website") or old_comp.get("url")
            if not website_url:
                continue
                
            exists = session.query(Competitor).filter(Competitor.website_url == website_url).first()
            if not exists:
                new_comp = Competitor(
                    name=old_comp.get("name", "Unknown Competitor"),
                    website_url=website_url,
                    presence_score=old_comp.get("presence_score", 0),
                    is_active=1 if old_comp.get("status") != "dead" else 0
                )
                session.add(new_comp)
                migrated_count += 1
        
        session.commit()
    
    print(f"Migration Complete! Inserted {migrated_count} new competitors into PostgreSQL.")

if __name__ == "__main__":
    migrate_competitors()
