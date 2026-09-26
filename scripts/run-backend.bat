@echo off
cd /d "%~dp0..\backend"
node "..\node_modules\tsx\dist\cli.mjs" watch src\server.ts
