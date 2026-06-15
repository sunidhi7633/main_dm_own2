import os
from pymongo import MongoClient

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

# Initialize MongoDB client
client = MongoClient(MONGODB_URI)

# Access the specific database mentioned in workflow.md
db = client["hcis"]
