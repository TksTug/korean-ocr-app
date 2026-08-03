@echo off
chcp 65001 > nul
title KorScan AI - Trợ Lý Bóc Tách Tiếng Hàn AI Vision
echo ===========================================================
echo    KORSCAN AI - TRỢ LÝ BÓC TÁCH TIẾNG HÀN AI VISION
echo ===========================================================
echo.
echo [1/2] Dang khoi dong Web Server tai http://localhost:8088 ...
start http://localhost:8088
echo [2/2] Dang kich hoat AI Engine...
python server.py
pause
