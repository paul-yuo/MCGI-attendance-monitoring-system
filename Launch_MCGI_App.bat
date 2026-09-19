@echo off
cd /d "%~dp0"
if exist "%LOCALAPPDATA%\Programs\Python\Python314\pythonw.exe" (
    start "" "%LOCALAPPDATA%\Programs\Python\Python314\pythonw.exe" app_launcher.py
) else (
    start "" pythonw app_launcher.py 2>nul || start /b python app_launcher.py
)
exit
