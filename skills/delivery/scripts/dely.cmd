@echo off
setlocal EnableExtensions
set "SCRIPT=%~dp0dely.js"
if defined DELY_NODE (
  "%DELY_NODE%" "%SCRIPT%" %*
  exit /b %ERRORLEVEL%
)

where node.exe >nul 2>&1
if %ERRORLEVEL%==0 (
  for /f "usebackq tokens=*" %%V in (`node.exe -v`) do set "NODEVER=%%V"
  set "MAJOR=%NODEVER:v=%"
  for /f "tokens=1 delims=." %%M in ("%MAJOR%") do set "MAJOR=%%M"
  set /a MAJOR=%MAJOR% 2>nul
  if %MAJOR% GEQ 18 (
    node.exe "%SCRIPT%" %*
    exit /b %ERRORLEVEL%
  )
)

set "ORCA_BIN=%ORCA_CLI_COMMAND%"
if not defined ORCA_BIN (
  where orca >nul 2>&1 && for /f "usebackq tokens=*" %%O in (`where orca`) do if not defined ORCA_BIN set "ORCA_BIN=%%O"
)
if not defined ORCA_BIN (
  where orca.cmd >nul 2>&1 && for /f "usebackq tokens=*" %%O in (`where orca.cmd`) do if not defined ORCA_BIN set "ORCA_BIN=%%O"
)

set "ELECTRON="
if defined ORCA_BIN (
  for %%I in ("%ORCA_BIN%") do set "ORCA_DIR=%%~dpI"
  if exist "%ORCA_DIR%..\MacOS\Orca.exe" set "ELECTRON=%ORCA_DIR%..\MacOS\Orca.exe"
  if exist "%ORCA_DIR%Orca.exe" set "ELECTRON=%ORCA_DIR%Orca.exe"
  if exist "%ORCA_DIR%..\Orca.exe" set "ELECTRON=%ORCA_DIR%..\Orca.exe"
  if exist "%LOCALAPPDATA%\Programs\Orca\Orca.exe" if not defined ELECTRON set "ELECTRON=%LOCALAPPDATA%\Programs\Orca\Orca.exe"
)
if defined ELECTRON if exist "%ELECTRON%" (
  set "ELECTRON_RUN_AS_NODE=1"
  "%ELECTRON%" "%SCRIPT%" %*
  exit /b %ERRORLEVEL%
)

echo BLOCKED no Node 18+ runtime; install Node 18+ 1>&2
exit /b 10
