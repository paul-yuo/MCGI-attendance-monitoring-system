@echo off
title Create MCGI Desktop Shortcut
cd /d "%~dp0"
python create_shortcut.py
echo.
echo =======================================================
echo  MCGI Production Monitoring System Shortcut Ready!
echo  Icon: Official MCGI Productions Logo
echo  Location: Windows Desktop
echo =======================================================
echo.
pause
