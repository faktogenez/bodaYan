# Открывает входящий TCP-порт 25565 для сервера Minecraft (bodaYan / SkyBlock).
# Запускать с правами администратора. Идемпотентно: повторный запуск безопасен.
$name = "bodaYan Minecraft Server"
$log = "C:\Users\LEO\AppleLauncher\_fwwrite.txt"
$lines = @()
try {
  $existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
  if ($existing) {
    Set-NetFirewallRule -DisplayName $name -Enabled True -Action Allow -Direction Inbound -Profile Any | Out-Null
    $lines += "Правило уже существует — включено и разрешено."
  } else {
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort 25565 -Profile Any | Out-Null
    $lines += "Создано правило: Inbound TCP 25565 (Any profile)."
  }
  $lines += (Get-NetFirewallRule -DisplayName $name | Select-Object DisplayName, Enabled, Direction, Action, Profile | Format-Table -AutoSize | Out-String)
} catch {
  $lines += ("ОШИБКА: " + $_.Exception.Message)
}
$lines | Set-Content -Path $log -Encoding UTF8
