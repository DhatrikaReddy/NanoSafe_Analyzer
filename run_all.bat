@echo off
title NanoSafe Analyzer - Launcher
echo ===================================================
echo   Starting NanoSafe Analyzer (Backend + Mobile)
echo ===================================================

:: 1. Launch Flask Backend Server
start "NanoSafe Flask Backend (Port 5000)" cmd /k "cd /d %~dp0 && python app.py"

:: 2. Launch Expo Metro Bundler
start "NanoSafe Expo Mobile (Port 8081)" cmd /k "cd /d %~dp0\nanosafe_mobile && npx expo start"

echo.
echo [OK] Both servers are starting in separate windows:
echo   - Backend Server: http://127.0.0.1:5000
echo   - Mobile Bundler: http://localhost:8081
echo.
echo Keep both windows open while using the apps!
echo ===================================================
pause
