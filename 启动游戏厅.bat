@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 游戏厅

where node >nul 2>nul
if %errorlevel%==0 (
  node serve.js
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:8787/
  python -m http.server 8787 --bind 127.0.0.1
  goto :eof
)

echo.
echo   没找到 Node.js 或 Python。
echo   请先装个 Node.js（https://nodejs.org），或者用 VS Code 的 Live Server 打开本目录。
echo.
pause
