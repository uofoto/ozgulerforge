@echo off
chcp 65001 >nul
title Reel Ses - Kurulum
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Kur.ps1"
pause
