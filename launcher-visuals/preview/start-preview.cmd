@echo off
setlocal
for %%I in ("%~dp0..") do set "VISUAL_ROOT=%%~fI"
for %%I in ("%VISUAL_ROOT%\..") do set "PROJECT_ROOT=%%~fI"
for %%I in ("%VISUAL_ROOT%\preview") do set "PREVIEW_DIR=%%~fI"
set "ELECTRON_EXE=%PROJECT_ROOT%\node_modules\electron\dist\electron.exe"

if not exist "%ELECTRON_EXE%" (
  echo Electron не найден: "%ELECTRON_EXE%"
  pause
  exit /b 1
)
if not exist "%PREVIEW_DIR%\main.cjs" (
  echo Файл предпросмотра не найден: "%PREVIEW_DIR%\main.cjs"
  pause
  exit /b 1
)

start "" /B "%ELECTRON_EXE%" "%PREVIEW_DIR%"
exit /b 0
