@echo off
cd /d "%~dp0backend"
call venv\Scripts\activate.bat
celery -A celery_config worker --loglevel=info --pool=solo
pause
