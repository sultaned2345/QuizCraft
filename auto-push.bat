@echo off
echo QuizCraft Auto-Push Script
echo ==========================

echo Adding all changes...
git add .

echo Committing changes...
git commit -m "Auto-commit: %date% %time%"

echo Pushing to repository...
git push 

if %errorlevel% equ 0 (
    echo ✅ Successfully pushed to repository!
) else (
    echo ❌ Push failed. Please check your Git credentials.
    echo Make sure you have access to the repository or update the remote URL.
)

pause
























