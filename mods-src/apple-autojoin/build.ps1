# Сборка клиентского мода Apple AutoJoin (Forge 1.16.5).
#
# Компилирует исходники напрямую против SRG-jar Minecraft (без MCP/Gradle),
# упаковывает apple-autojoin-1.0.0.jar и раскладывает его в клиентские папки mods.
#
# Запуск:  powershell -ExecutionPolicy Bypass -File mods-src\apple-autojoin\build.ps1

$ErrorActionPreference = "Stop"

$ModDir = $PSScriptRoot
$Root   = (Resolve-Path (Join-Path $ModDir "..\..")).Path
$Lib    = Join-Path $Root "minecraft\game\libraries"

$SrgJar   = Join-Path $Lib "net\minecraft\client\1.16.5-20210115.111550\client-1.16.5-20210115.111550-srg.jar"
$ForgeJar = Join-Path $Lib "net\minecraftforge\forge\1.16.5-36.2.42\forge-1.16.5-36.2.42-universal.jar"
$EventBus = Join-Path $Lib "net\minecraftforge\eventbus\4.0.0\eventbus-4.0.0.jar"

foreach ($f in @($SrgJar, $ForgeJar, $EventBus)) {
    if (-not (Test-Path $f)) { throw "Не найдена библиотека: $f" }
}

# JDK 17: сначала JAVA_HOME, затем типичная установка Adoptium.
$javac = $null
$jar = $null
if ($env:JAVA_HOME) {
    $c = Join-Path $env:JAVA_HOME "bin\javac.exe"
    if (Test-Path $c) { $javac = $c; $jar = Join-Path $env:JAVA_HOME "bin\jar.exe" }
}
if (-not $javac) {
    $cand = Get-ChildItem "C:\Program Files\Eclipse Adoptium\jdk*\bin\javac.exe" -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($cand) { $javac = $cand.FullName; $jar = Join-Path $cand.Directory.FullName "jar.exe" }
}
if (-not $javac) { throw "JDK 17 не найден. Установите JDK или задайте JAVA_HOME." }

$OutDir = Join-Path $ModDir "out"
if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$sources = Get-ChildItem (Join-Path $ModDir "src") -Recurse -Filter *.java | ForEach-Object { $_.FullName }

& $javac --release 8 -encoding UTF-8 -Xlint:none -cp "$SrgJar;$ForgeJar;$EventBus" -d $OutDir $sources
if ($LASTEXITCODE -ne 0) { throw "Ошибка компиляции (javac exit=$LASTEXITCODE)" }

$JarPath = Join-Path $ModDir "apple-autojoin-1.0.0.jar"
if (Test-Path $JarPath) { Remove-Item $JarPath -Force }
& $jar cf $JarPath -C $OutDir . -C (Join-Path $ModDir "res") .
if ($LASTEXITCODE -ne 0) { throw "Ошибка упаковки (jar exit=$LASTEXITCODE)" }

Write-Host "Собрано: $JarPath"

# Раскладка мода во все клиентские игровые папки (рабочая и релизная).
foreach ($rel in @("minecraft\game\mods", "release\minecraft\game\mods")) {
    $dst = Join-Path $Root $rel
    if (Test-Path $dst) {
        Copy-Item $JarPath (Join-Path $dst "apple-autojoin-1.0.0.jar") -Force
        Write-Host "Установлено: $dst"
    }
}
