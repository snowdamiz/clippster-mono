@echo off
setlocal

REM Absolute paths
set FFMPEG_DIR=C:\Users\brand\Documents\Dev\clippster-mono\client\src-tauri\ffmpeg-dev\ffmpeg-master-latest-win64-gpl-shared
set PKG_CONFIG=C:\Users\brand\scoop\shims\pkg-config.exe
set PKG_CONFIG_PATH=%FFMPEG_DIR%\lib\pkgconfig
set PKG_CONFIG_LIBDIR=%PKG_CONFIG_PATH%
set PKG_CONFIG_SYSTEM_INCLUDE_PATH=
set PKG_CONFIG_SYSTEM_LIBRARY_PATH=
set INCLUDE=%FFMPEG_DIR%\include;%INCLUDE%
set LIB=%FFMPEG_DIR%\lib;%LIB%
set PATH=%FFMPEG_DIR%\bin;%PATH%
set CFLAGS=/I%FFMPEG_DIR%\include

echo Using FFMPEG_DIR=%FFMPEG_DIR%
echo Using PKG_CONFIG=%PKG_CONFIG%
echo Using PKG_CONFIG_PATH=%PKG_CONFIG_PATH%
echo INCLUDE=%INCLUDE%
echo LIB=%LIB%
echo PATH=%PATH%

cargo clean
if errorlevel 1 goto :err
cargo build
if errorlevel 1 goto :err

REM Copy DLLs for runtime
xcopy /Y /Q "%FFMPEG_DIR%\bin\*.dll" target\debug\ >nul
if errorlevel 1 goto :err

echo Build succeeded with FFmpeg.
exit /b 0

:err
echo Build failed. See errors above.
exit /b 1
