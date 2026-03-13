@echo off
echo Stopping MyLocker Web HMI...
taskkill /FI "WINDOWTITLE eq MyLocker Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq MyLocker Frontend*" /F >nul 2>&1
echo Stopped.
