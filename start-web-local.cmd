@echo off
cd /d "%~dp0"
start "clippster api" cmd /k "yarn server"
start "clippster web" cmd /k "yarn web"
start "clippster account site" cmd /k "yarn landing"
