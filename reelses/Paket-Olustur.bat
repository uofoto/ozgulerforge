@echo off
chcp 65001 >nul
title Reel Ses - Tek dosya kurulum paketi olustur
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Paket-Olustur.ps1"
pause
