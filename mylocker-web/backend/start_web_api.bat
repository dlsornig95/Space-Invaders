@echo off
title MyLocker Web API
echo ========================================
echo MyLocker Web API
echo ========================================
echo.
echo This web server reads from the Access database.
echo Make sure the PLC Service is running for live data.
echo.
echo API will be available at: http://localhost:8000
echo.

cd /d "%~dp0"
python main.py

pause
