# ============================================================
# start.ps1 - Khoi dong tu dong: Server + ngrok + Cap nhat Webhook
# Chay: .\start.ps1
# ============================================================

$projectDir = $PSScriptRoot
$port = 3000

Write-Host ""
Write-Host "=== ZALO OA BOT - KHOI DONG TU DONG ===" -ForegroundColor Cyan
Write-Host ""

# ---- 1. Kiem tra Node.js ----
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[LOI] Khong tim thay Node.js. Vui long cai dat tai https://nodejs.org" -ForegroundColor Red
  exit 1
}

# ---- 2. Tim ngrok ----
$ngrokExe = "C:\ngrok\ngrok.exe"
if (-not (Test-Path $ngrokExe)) {
  # Thu trong PATH
  $found = Get-Command ngrok -ErrorAction SilentlyContinue
  if ($found) { $ngrokExe = $found.Source }
  else {
    Write-Host "[LOI] Khong tim thay ngrok tai C:\ngrok\ngrok.exe" -ForegroundColor Red
    Write-Host "       Chay lai: Invoke-WebRequest https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip -OutFile ngrok.zip" -ForegroundColor Yellow
    exit 1
  }
}

# ---- 3. Dung process cu tren port $port (neu co) ----
$used = netstat -ano 2>$null | Select-String ":$port\s.*LISTENING"
if ($used) {
  $oldPid = ($used -split '\s+')[-1]
  Write-Host "[INFO] Dang dung process cu tren port $port (PID: $oldPid)..." -ForegroundColor Yellow
  Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

# ---- 4. Dung ngrok cu (neu co) ----
$ngrokProcs = Get-Process -Name ngrok -ErrorAction SilentlyContinue
if ($ngrokProcs) {
  Write-Host "[INFO] Dang dung ngrok cu..." -ForegroundColor Yellow
  $ngrokProcs | Stop-Process -Force
  Start-Sleep -Seconds 1
}
$ngrokProcs2 = Get-Process | Where-Object { $_.Path -eq $ngrokExe } -ErrorAction SilentlyContinue
if ($ngrokProcs2) { $ngrokProcs2 | Stop-Process -Force; Start-Sleep -Seconds 1 }

# ---- 5. Khoi dong Server trong cua so moi ----
Write-Host "[1/3] Khoi dong Node.js server..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$projectDir'; Write-Host 'SERVER LOG' -ForegroundColor Cyan; npm start"
)
Start-Sleep -Seconds 3

# ---- 6. Khoi dong ngrok trong background ----
Write-Host "[2/3] Khoi dong ngrok..." -ForegroundColor Green
Start-Process $ngrokExe -ArgumentList "http $port" -WindowStyle Minimized

# ---- 7. Cho ngrok khoi dong va lay URL ----
Write-Host "      Cho ngrok san sang..."
$ngrokUrl = $null
$attempts = 0
$maxAttempts = 20

while ($attempts -lt $maxAttempts -and -not $ngrokUrl) {
  Start-Sleep -Seconds 2
  $attempts++
  try {
    $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction SilentlyContinue
    $https = $tunnels.tunnels | Where-Object { $_.proto -eq "https" }
    if ($https) {
      $ngrokUrl = $https.public_url
    }
  } catch {
    # Con cho...
  }
}

if (-not $ngrokUrl) {
  Write-Host ""
  Write-Host "[LOI] Khong lay duoc URL tu ngrok sau $($maxAttempts * 2) giay." -ForegroundColor Red
  Write-Host "      Kiem tra: ngrok da duoc cau hinh authtoken chua?" -ForegroundColor Yellow
  Write-Host "      Chay: ngrok config add-authtoken <authtoken>" -ForegroundColor Yellow
  exit 1
}

# ---- 8. Hien thi thong tin ----
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host " Ngrok URL    : $ngrokUrl" -ForegroundColor White
Write-Host " Webhook URL  : $ngrokUrl/webhook" -ForegroundColor White
Write-Host " Health check : $ngrokUrl/health" -ForegroundColor White
Write-Host " Ngrok UI     : http://localhost:4040" -ForegroundColor White
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# ---- 9. Tu dong cap nhat Zalo Webhook ----
Write-Host "[3/3] Cap nhat Zalo Webhook..." -ForegroundColor Green
node "$projectDir\update-webhook.js" $ngrokUrl

# ---- 10. Hoi co muon chay setup-menu khong ----
Write-Host ""
$answer = Read-Host "Ban co muon chay setup-menu.js de cap nhat menu OA khong? (y/N)"
if ($answer -match '^[yY]') {
  Write-Host ""
  Write-Host "Dang cai dat menu Zalo OA..." -ForegroundColor Green
  node "$projectDir\setup-menu.js"
}

Write-Host ""
Write-Host "=== HOAN THANH ===" -ForegroundColor Cyan
Write-Host "Server va ngrok dang chay." -ForegroundColor Green
Write-Host "Nhan phim bat ky de dong cua so nay..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
