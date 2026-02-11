# Install missing packages for AIME Voice and Contact Memory plugins
# Run this as Administrator

Write-Host "Installing missing dependencies..." -ForegroundColor Cyan

# Navigate to project directory
Set-Location "c:\Users\buyaf\OneDrive\Documents\EZWAI_AIME\EZWAi_Aime"

# Install the 3 critical packages
npm install --legacy-peer-deps @anthropic-ai/sdk@0.74.0 @livekit/rtc-node@0.13.24 better-sqlite3@12.6.2

Write-Host "`nInstallation complete!" -ForegroundColor Green
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
