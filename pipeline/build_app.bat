@echo off
:: NextSync Pipeline — Build .exe with PyInstaller
:: Run this script from the pipeline/ directory

echo ====================================
echo  NextSync Pipeline Builder
echo ====================================

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.10+
    pause
    exit /b 1
)

:: Install dependencies
echo [1/3] Installing dependencies...
pip install -r requirements.txt

:: Install PyInstaller
echo [2/3] Installing PyInstaller...
pip install pyinstaller

:: Build .exe
echo [3/3] Building NextSync Pipeline.exe...
pyinstaller ^
    --onefile ^
    --windowed ^
    --name "NextSync Pipeline" ^
    --add-data "02_face_index.py;." ^
    --add-data "03_thumbnail_gen.py;." ^
    --add-data "run_pipeline.py;." ^
    --hidden-import face_recognition ^
    --hidden-import psycopg2 ^
    --hidden-import boto3 ^
    --hidden-import googleapiclient ^
    --hidden-import PIL ^
    desktop_app.py

echo.
echo ====================================
if exist "dist\NextSync Pipeline.exe" (
    echo  SUCCESS! ไฟล์ .exe อยู่ที่: dist\NextSync Pipeline.exe
) else (
    echo  Build อาจมีข้อผิดพลาด ตรวจสอบ log ด้านบน
)
echo ====================================
pause
