# Harshwal Automation - Backend

This is the Python FastAPI backend for the Harshwal Automation project. It powers the 7-layer Social Media Optimization (SMO) pipeline, integrates multiple autonomous AI agents (Claude Haiku, OpenAI), and manages strict Role-Based Access Control (RBAC) across the review system.

## Key Architecture
- **API Framework**: FastAPI & Uvicorn
- **State Database**: MongoDB (`hcis` database) for content library, asset library, and analytics.
- **Relational / Knowledge Base**: PostgreSQL + `pgvector` for legacy RAG integrations.
- **Background Jobs**: Celery + Redis for asynchronous scheduling, batch generation, and AI pre-scoring.
- **Cloud Infrastructure**: AWS S3 (Asset Storage) & AWS SES (Report Emailing).
- **Notifications**: Mocked WhatsApp Business API alerts.

## Pipeline Highlights
- **AI Pre-screen (Agent 2)**: Automatically scores draft content using Claude Haiku before it reaches human review.
- **Strict Approval Gates**: Hardcoded API blocks (e.g., the Blue Arrow Cultural Gate) prevent unauthorized publishing.
- **Cascading Logic (Agent 3)**: Approving a single blog automatically spawns a 30-day social media cascade timeline.

## Environment Variables
Create a `.env` file in the `backend/` directory using `.env.example` as a template. Key variables include:

```env
# Core DBs
MONGODB_URI=mongodb://localhost:27017
REDIS_URL=redis://localhost:6379/0
DATABASE_URL=postgresql://harshwal_user:harshwal_password@localhost:5433/harshwal_automation
JWT_SECRET=super-secret-harshwal-key

# AI Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# AWS
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=ap-south-1
S3_BUCKET_NAME=harshwal-dm-library

# Dev Flags
BYPASS_CULTURAL_GATE=true # REMOVE FOR PRODUCTION
```

## How to Run Locally

1. **Start Core Services (Docker)**
   Ensure your MongoDB, Redis, and PostgreSQL containers are running:
   ```bash
   cd ..
   docker-compose up -d
   ```

2. **Activate the Virtual Environment & Install Deps**
   ```bash
   cd backend
   source venv312/bin/activate
   pip install -r requirements.txt
   ```

3. **Start the FastAPI Server**
   ```bash
   uvicorn main:app --port 8000 --reload
   ```

4. **Start the Celery Worker & Beat** (In separate terminals)
   ```bash
   # Terminal A: Task execution
   celery -A celery_config app worker --loglevel=info

   # Terminal B: CRON scheduling
   celery -A celery_config app beat --loglevel=info
   ```

## API Documentation
Interactive Swagger API documentation is available at `http://localhost:8000/docs`.
