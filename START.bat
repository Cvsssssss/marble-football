@echo off
chcp 65001 >nul
title Marble Football - generator local
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nu este instalat. Instaleaza Node.js 20+ de pe nodejs.org si porneste din nou.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Prima pornire: instalez pachetele npm...
  call npm install
)
node launcher.js
if errorlevel 1 (
  echo.
  echo A aparut o eroare. Detalii in logs\generate_last.log
)
pause
