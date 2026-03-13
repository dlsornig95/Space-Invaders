@echo off
echo ========================================
echo MyLocker Web HMI - Starting
echo ========================================

:: Load config
call "%~dp0config.bat"

echo.
echo Configuration:
echo   PLC IP:    %PLC_IP%
echo   PLC Slot:  %PLC_SLOT%
echo   Mock Mode: %MOCK_MODE%
echo   Backend:   http://localhost:%BACKEND_PORT%
echo   Frontend:  http://localhost:%FRONTEND_PORT%
echo.

:: Generate runtime config for backend
echo Generating backend config...
(
echo # Auto-generated config - do not edit manually
echo # Edit deploy\config.bat instead
echo PLC_IP="%PLC_IP%"
echo PLC_SLOT=%PLC_SLOT%
echo MOCK_MODE=%MOCK_MODE%
echo NETWORKS="%NETWORKS%"
) > "%~dp0..\backend\runtime_config.env"

:: Start backend in new window
echo Starting backend...
start "MyLocker Backend" cmd /k "cd /d %~dp0..\backend && set PLC_IP=%PLC_IP% && set PLC_SLOT=%PLC_SLOT% && set MOCK_MODE=%MOCK_MODE% && python main.py"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend in new window
echo Starting frontend...
start "MyLocker Frontend" cmd /k "cd /d %~dp0..\frontend && set VITE_API_URL=http://localhost:%BACKEND_PORT% && npm run dev -- --port %FRONTEND_PORT%"

echo.
echo ========================================
echo App starting...
echo.
echo Backend:  http://localhost:%BACKEND_PORT%
echo Frontend: http://localhost:%FRONTEND_PORT%
echo.
echo Close the terminal windows to stop.
echo ========================================
timeout /t 5
start http://localhost:%FRONTEND_PORT%
