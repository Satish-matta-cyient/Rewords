@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo  EduRewards - local setup and run
echo ============================================================
echo.

if not "%CD:&=%"=="%CD%" (
  echo [ERROR] This folder's path contains "&":
  echo   !CD!
  echo.
  echo npm scripts run through cmd.exe, which treats "&" as a command
  echo separator, so npm install/run will fail from this location.
  echo.
  echo Fix: move or rename this folder so its path has no "&"
  echo   e.g. D:\sathish-2026\edurewards
  echo Then re-run this script from the new location.
  echo.
  echo Note: even this check only ran because it was launched as
  echo ".\run-local.bat". Typing the bare name in a terminal from this
  echo folder does not work at all while "&" is in the path - use
  echo Explorer double-click, or ".\run-local.bat" from a terminal.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on PATH. Install Node 20+ from nodejs.org and try again.
  pause
  exit /b 1
)

echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo [2/4] Preparing backend\.env...
node scripts\write-env.cjs
if errorlevel 1 (
  echo [ERROR] Could not create backend\.env.
  pause
  exit /b 1
)

echo.
echo [3/4] Generating Prisma client, running migrations, seeding demo data...
call npm run backend:setup
if errorlevel 1 (
  echo [ERROR] Backend setup failed. If this mentions a certificate error,
  echo your network is intercepting HTTPS and blocking the Prisma engine
  echo download - try a different network or configure a proxy cert.
  pause
  exit /b 1
)

echo.
echo [4/4] Starting backend (http://localhost:4000) and frontend (http://localhost:5173)...
echo Press Ctrl+C to stop both.
echo.
call npm run dev

pause
