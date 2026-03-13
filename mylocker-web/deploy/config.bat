@echo off
:: ========================================
:: MyLocker Web HMI - Configuration
:: ========================================
:: Edit these values for your PLC setup

:: PLC IP Address (must be directly reachable from this PC)
set PLC_IP=192.168.5.58

:: PLC Slot number (0-indexed)
set PLC_SLOT=0

:: Set to "true" for testing without PLC, "false" for real PLC
set MOCK_MODE=false

:: Networks to enable (comma-separated: DN1,DN2,EN3,DN4,DN5)
:: Comment out networks that don't exist on your PLC
set NETWORKS=DN1,DN2,EN3,DN4,DN5

:: Port for backend API
set BACKEND_PORT=8000

:: Port for frontend dev server
set FRONTEND_PORT=5173
