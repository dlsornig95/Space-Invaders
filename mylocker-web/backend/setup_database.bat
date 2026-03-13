@echo off
echo ========================================
echo MyLocker Database Setup
echo ========================================
echo.
echo This will create the Access database file
echo and initialize all tables.
echo.

cd /d "%~dp0"
python -m db.setup_database

echo.
pause
