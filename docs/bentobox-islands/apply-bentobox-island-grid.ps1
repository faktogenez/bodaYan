#Requires -Version 5.1
<#
  apply-bentobox-island-grid.ps1

  Applies the BSkyBlock island-grid settings produced by the island generation audit:
    distance-between-islands: 48   (unchanged)
    protection-range        : 24   (was 30 -> neighbouring protection boxes overlapped by 6 blocks)
    start-x / start-z       : 0/0  (was -50/120 -> grid origin moved to the centre of bskyblock_world)
    max-islands             : 21   (cells fully inside view-distance=8 => 128 block radius)

  BentoBox forbids changing distance/start on a live database, so this script performs a
  full reset: config + live database are archived before anything is replaced.

  Files are only moved/copied, never deleted. Rollback instructions: see README.md.

  Usage (server MUST be stopped):
    powershell -ExecutionPolicy Bypass -File .\apply-bentobox-island-grid.ps1
    powershell -ExecutionPolicy Bypass -File .\apply-bentobox-island-grid.ps1 -ServerRoot "D:\Server_Skyblock"
#>
param(
    [string]$ServerRoot = 'C:\Server_Skyblock'
)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot

$patched    = Join-Path $here 'BSkyBlock-config.patched.yml'
$liveConfig = Join-Path $ServerRoot 'plugins\BentoBox\addons\BSkyBlock\config.yml'
$liveDb     = Join-Path $ServerRoot 'plugins\BentoBox\database'
$dbBackup   = Join-Path $ServerRoot 'plugins\BentoBox\database_backup'

# --- guards -----------------------------------------------------------------
$java = Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like '*mohist*' }
if ($java) {
    throw "SkyBlock server is running (PID $($java.ProcessId)). Stop it before running this script."
}
if (-not (Test-Path $patched))    { throw "Patched config not found: $patched" }
if (-not (Test-Path $liveConfig)) { throw "Live config not found: $liveConfig" }

$stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$archive = Join-Path $ServerRoot "_archive\bentobox-reset-$stamp"

# --- 1. archive -------------------------------------------------------------
Write-Host "[1/6] archive: $archive"
New-Item -ItemType Directory -Force -Path $archive | Out-Null

# --- 2. back up config + database -------------------------------------------
Write-Host "[2/6] backup config and live database"
Copy-Item $liveConfig (Join-Path $archive 'BSkyBlock-config.yml.before') -Force
if (Test-Path $dbBackup) {
    Copy-Item $dbBackup (Join-Path $archive 'database_backup') -Recurse -Force
}
if (Test-Path $liveDb) {
    Move-Item $liveDb (Join-Path $archive 'database.live') -Force
    Write-Host "      live database moved to archive (BentoBox recreates it empty)"
} else {
    Write-Host "      no live database - nothing to move"
}

# --- 3. move island worlds out ----------------------------------------------
Write-Host "[3/6] island worlds"
foreach ($w in 'bskyblock_world', 'bskyblock_world_nether', 'bskyblock_world_the_end') {
    $p = Join-Path $ServerRoot $w
    if (Test-Path $p) {
        Move-Item $p (Join-Path $archive $w) -Force
        Write-Host "      moved $w"
    } else {
        Write-Host "      $w not present - skipped"
    }
}

# --- 4. apply patched config -------------------------------------------------
Write-Host "[4/6] apply patched config"
Copy-Item $patched $liveConfig -Force

# --- 5. verify ---------------------------------------------------------------
Write-Host "[5/6] resulting values"
$txt = Get-Content $liveConfig -Raw
foreach ($k in 'distance-between-islands', 'protection-range', 'start-x', 'start-z', 'max-islands') {
    $m = [regex]::Match($txt, "(?m)^\s*$k\s*:\s*(\S+)\s*$")
    Write-Host ("      {0,-26} = {1}" -f $k, $m.Groups[1].Value)
}

# --- 6. next steps -----------------------------------------------------------
Write-Host "[6/6] done."
Write-Host ""
Write-Host "Next:"
Write-Host "  1. Start the server. BentoBox will regenerate bskyblock_world from scratch."
Write-Host "  2. Reserve the central cell (0,0) as the game-mode spawn island so players"
Write-Host "     occupy ring 1 and outward (check the exact subcommand with: /bsbadmin help)."
Write-Host "  3. Verify: /bbox version, /bsbadmin island info <player>"
Write-Host "  4. Create 2-3 test islands and confirm their centers land on the 48-block grid"
Write-Host "     anchored at 0,0 and that protection boxes do not overlap."
