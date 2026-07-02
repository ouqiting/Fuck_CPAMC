param(
    [string]$OutputDir = ".\output",
    [string]$UpstreamUrl = "https://github.com/router-for-me/Cli-Proxy-API-Management-Center.git",
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutputPath = if ([System.IO.Path]::IsPathRooted($OutputDir)) { $OutputDir } else { Join-Path $ScriptDir $OutputDir }
$WorkDir    = Join-Path $ScriptDir ".build-tmp"
$RepoDir    = Join-Path $WorkDir "repo"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Clean management.html Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Upstream : $UpstreamUrl"
Write-Host "Branch   : $Branch"
Write-Host "WorkDir  : $WorkDir"
Write-Host "Output   : $OutputPath"
Write-Host ""

foreach ($cmd in @('git', 'node', 'bun')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] '$cmd' not found in PATH. Please install it first." -ForegroundColor Red
        exit 1
    }
}

Write-Host "[1/6] Cloning upstream..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
git clone --depth 1 --branch $Branch $UpstreamUrl $RepoDir
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] git clone failed." -ForegroundColor Red; exit 1 }

Write-Host "[2/6] Installing dependencies..." -ForegroundColor Yellow
Push-Location $RepoDir
bun install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] bun install failed." -ForegroundColor Red; Pop-Location; exit 1 }

Write-Host "[3/6] Applying patch (hiding XX sidebar & dashboard entries)..." -ForegroundColor Yellow
node (Join-Path $ScriptDir "patch.cjs") $RepoDir
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] Patch failed." -ForegroundColor Red; Pop-Location; exit 1 }

Write-Host "[4/6] Building..." -ForegroundColor Yellow
bun run build
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] Build failed." -ForegroundColor Red; Pop-Location; exit 1 }
Pop-Location

Write-Host "[5/6] Copying management.html..." -ForegroundColor Yellow
$BuiltHtml = Join-Path $RepoDir "dist\index.html"
if (-not (Test-Path $BuiltHtml)) {
    Write-Host "[ERROR] dist/index.html not found after build." -ForegroundColor Red
    exit 1
}
New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
$DestFile = Join-Path $OutputPath "management.html"
Copy-Item $BuiltHtml $DestFile -Force
$size = [math]::Round((Get-Item $DestFile).Length / 1MB, 2)
Write-Host "  -> $DestFile ($size MB)"

Write-Host "[6/6] Cleaning up temp files..." -ForegroundColor Yellow
try {
    Remove-Item $WorkDir -Recurse -Force -ErrorAction Stop
} catch {
    Write-Host "[WARN] Failed to remove $WorkDir : $_" -ForegroundColor Red
    Write-Host "       You can delete it manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Done!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "management.html is at: $DestFile"
Write-Host "Copy it to your CLI Proxy API backend folder."
Write-Host ""
