@echo off
title Lensa Palopo - Local Server
echo ========================================================
echo   Menjalankan Server Lokal Lensa Palopo...
echo ========================================================
echo.
echo Buka di browser:
echo - Dashboard Admin : http://localhost:3000/admin.html
echo - Website Utama   : http://localhost:3000/index.html
echo.
echo Tekan Ctrl+C untuk menghentikan server kapan saja.
echo ========================================================
start http://localhost:3000/admin.html
node server.js
pause

