@echo off
start "Backend"        cmd /k "cd backend && uvicorn main:app --reload --port 8000"
start "Celery Worker"  cmd /k "cd backend && celery -A celery_config worker --loglevel=info"
start "Celery Beat"    cmd /k "cd backend && celery -A celery_config beat --loglevel=info"
start "Frontend"       cmd /k "cd dashboard && npm run dev"
