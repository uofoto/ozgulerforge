@echo off
chcp 65001 >nul
title Reel Ses - Telefon Sunucusu
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Sunucu.ps1"
pause
