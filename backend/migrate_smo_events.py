import os
import pandas as pd
from sqlalchemy.orm import Session
from database import engine, Base
from models import SMOEvent

# Ensure tables exist
Base.metadata.create_all(bind=engine)

# Configuration: Update these with the paths to your old Excel files
LEGACY_INDIA_FILE = os.getenv("LEGACY_INDIA_EVENTS", "../SERVER-DM/SMO/SMO_Project-main/SMO_Project-main/storage/data/events_india.xlsx")
LEGACY_USA_FILE = os.getenv("LEGACY_USA_EVENTS", "../SERVER-DM/SMO/SMO_Project-main/SMO_Project-main/storage/data/events_usa.xlsx")

def migrate_excel(file_path: str, region: str):
    if not os.path.exists(file_path):
        print(f"Could not find legacy file: {file_path}")
        return 0

    print(f"Reading {file_path} for {region} region...")
    try:
        # Assumes the old excel files had columns like 'Date', 'Event Name', 'Category'
        df = pd.read_excel(file_path)
    except Exception as e:
        print(f"Failed to read Excel file. Error: {e}")
        return 0

    migrated_count = 0
    with Session(engine) as session:
        for _, row in df.iterrows():
            # Adjust column names below to match your actual legacy Excel columns
            event_name = row.get("Event Name", row.get("title", "Unknown Event"))
            
            # Basic deduplication check
            exists = session.query(SMOEvent).filter(
                SMOEvent.title == event_name, 
                SMOEvent.region == region
            ).first()
            
            if not exists:
                new_event = SMOEvent(
                    title=event_name,
                    category=row.get("Category", "General"),
                    # Pandas usually parses dates automatically if formatted well
                    event_date=pd.to_datetime(row.get("Date", row.get("date"))) if pd.notnull(row.get("Date")) else None,
                    region=region,
                    status="pending"
                )
                session.add(new_event)
                migrated_count += 1
        
        session.commit()
    return migrated_count

def migrate_smo_events():
    print("Starting SMO Event Migration...")
    india_count = migrate_excel(LEGACY_INDIA_FILE, "India")
    usa_count = migrate_excel(LEGACY_USA_FILE, "USA")
    
    total = india_count + usa_count
    print(f"Migration Complete! Inserted {total} new events into PostgreSQL.")

if __name__ == "__main__":
    migrate_smo_events()
