@echo off
set ROOT=%~dp0
start "Denizstagram Server" powershell -ExecutionPolicy Bypass -File "%ROOT%server.ps1"
timeout /t 3 /nobreak >nul
start "Denizstagram Tunnel" "%ROOT%cloudflared.exe" tunnel --url http://127.0.0.1:8080 --no-autoupdate
