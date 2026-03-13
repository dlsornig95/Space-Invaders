@echo off
title MyLocker PLC Service
echo ========================================
echo MyLocker PLC Service
echo ========================================
echo.
echo This service maintains the PLC connection
echo and updates the Access database every 5 seconds.
echo.
echo Press Ctrl+C to stop.
echo.

cd /d "%~dp0"
python plc_service.py

pause
