@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo  EduRewards - local setup and run
echo ============================================================
echo.
echo Note: if this window closed instantly instead of showing this
echo banner, you launched it by typing "run-local.bat" bare. Launch
echo it as ".\run-local.bat", or double-click it in File Explorer.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on PATH. Install Node 20+ from nodejs.org and try again.
  pause
  exit /b 1
)

rem "npm run <script>" and lifecycle hooks (postinstall, etc.) shell out
rem through a nested cmd.exe that mishandles the "&" in this folder's path
rem and silently mangles it. --ignore-scripts skips that hook, and every
rem step below calls node directly on the real .js entry point instead of
rem going through an npm script or a node_modules\.bin shim, which sidesteps
rem the bug entirely.

echo [1/4] Installing dependencies...
call npm install --ignore-scripts
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
pushd backend
node "..\node_modules\prisma\build\index.js" generate --schema=prisma\schema.prisma
if errorlevel 1 goto prisma_failed
node "..\node_modules\prisma\build\index.js" migrate dev --name init --schema=prisma\schema.prisma
if errorlevel 1 goto prisma_failed
node "..\node_modules\tsx\dist\cli.mjs" prisma\seed.ts
if errorlevel 1 goto prisma_failed
popd
goto prisma_ok

:prisma_failed
popd
echo [ERROR] Backend setup failed. If this mentions a certificate error
echo ^(unable to get local issuer certificate^), your network is
echo intercepting HTTPS and blocking the Prisma engine download - try
echo a different network ^(e.g. a mobile hotspot^) for just this step.
pause
exit /b 1

:prisma_ok
echo.
echo [4/4] Starting backend and frontend in separate windows...
start "EduRewards API (:4000)" cmd /k call scripts\run-backend.bat
start "EduRewards Web (:5173)" cmd /k call scripts\run-frontend.bat

echo.
echo Two windows just opened: the API and the web app.
echo Once both are ready, open http://localhost:5173
echo Close those windows (or Ctrl+C inside them) to stop the servers.
echo.
pause
