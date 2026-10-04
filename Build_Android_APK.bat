@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo  MCGI ATTENDANCE MANAGEMENT SYSTEM - ANDROID APK BUILDER
echo ========================================================
echo.

echo [1/3] Preparing web assets...
python -c "import shutil, os; [shutil.rmtree(os.path.join('www', d)) for d in ['css', 'js', 'Carousel Images'] if os.path.exists(os.path.join('www', d))]; os.makedirs('www', exist_ok=True); [shutil.copy(f, 'www') for f in ['index.html', 'login.html', 'manifest.json', 'favicon.ico', 'app_icon.ico', 'sw.js'] if os.path.exists(f)]; [shutil.copy(f, 'www') for f in os.listdir('.') if (f.startswith('logo') and (f.endswith('.png') or f.endswith('.jpg')))]; [shutil.copytree(d, os.path.join('www', d), dirs_exist_ok=True) for d in ['css', 'js', 'Carousel Images'] if os.path.exists(d)]"

echo [2/3] Syncing Capacitor project...
call npx cap sync

echo [3/3] Compiling Android APK with Gradle...
set "JAVA_HOME=C:\Program Files\Java\jdk-24"
cd android
call gradlew.bat assembleDebug
cd ..

python -c "import os, glob, shutil; apks = glob.glob('android/app/build/outputs/apk/**/*.apk', recursive=True); (shutil.copyfile(apks[0], 'MCGI_Attendance.apk'), print(f'\nSuccess! APK ready at MCGI_Attendance.apk ({os.path.getsize(\"MCGI_Attendance.apk\") / (1024*1024):.2f} MB)')) if apks else print('APK not found')"

echo.
pause
