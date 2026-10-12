@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install Node.js 22 LTS or newer from https://nodejs.org/
  pause
  exit /b 1
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo npm is missing. Reinstall Node.js with npm.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing Agent Office dependencies...
  call npm.cmd ci
  if errorlevel 1 goto failed
)

echo Preparing Agent Office...
call npm.cmd run build
if errorlevel 1 goto failed

echo Agent Office will open at http://127.0.0.1:4300/
echo Keep this window open. Press Ctrl+C to stop.
start "" "http://127.0.0.1:4300/"
call npm.cmd start
if errorlevel 1 goto failed
exit /b 0

:failed
echo Agent Office could not start. See the error above.
pause
exit /b 1
