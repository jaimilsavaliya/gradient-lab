@echo off
title Gradient Background Generator - Gradient Lab
echo Starting Gradient Lab server...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org/ to run this app.
    pause
    exit /b 1
)
node server.js
pause
