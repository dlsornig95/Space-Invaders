@echo off
echo ========================================
echo MyLocker Web HMI - Installation
echo ========================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.10+ first.
    pause
    exit /b 1
)

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install Node.js 18+ first.
    pause
    exit /b 1
)

echo Installing backend dependencies...
cd /d "%~dp0..\backend"
pip install fastapi uvicorn pycomm3

echo.
echo Installing frontend dependencies...
cd /d "%~dp0..\frontend"
call npm install

echo.
echo ========================================
echo Installation complete!
echo.
echo Next steps:
echo 1. Edit deploy\config.bat to set your PLC IP and slot
echo 2. Run deploy\start.bat to launch the app
echo ========================================
pause
