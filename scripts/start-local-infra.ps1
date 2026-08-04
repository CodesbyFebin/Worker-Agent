# Starts local infra required for WorkerAgent.Cloud on this Windows machine.
# - MariaDB as a user process (no admin service install)
# - Redis 5 on port 6380 (system Redis 3 on 6379 is too old for BullMQ and
#   cannot always be stopped without elevation)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$UserData = Join-Path $Root ".local\mariadb-data"
$UserRun = Join-Path $Root ".local\mariadb-run"
$Mysqld = "C:\Program Files\MariaDB 12.3\bin\mysqld.exe"
$RedisServer = "C:\Redis5\redis-server.exe"
$RedisConf = "C:\Redis5\redis.6380.conf"

New-Item -ItemType Directory -Force -Path $UserData, $UserRun | Out-Null

if (-not (Test-Path $Mysqld)) { throw "MariaDB not found at $Mysqld" }
if (-not (Test-Path $RedisServer)) { throw "Redis 5 not found at $RedisServer - see README Known limits" }

# MariaDB
$mariaListening = netstat -ano | Select-String -Pattern "127\.0\.0\.1:3306"
if (-not $mariaListening) {
  if (-not (Test-Path (Join-Path $UserData "mysql"))) {
    $InstalledData = "C:\Program Files\MariaDB 12.3\data"
    Copy-Item -Path (Join-Path $InstalledData "*") -Destination $UserData -Recurse -Force
  }
  Start-Process -FilePath $Mysqld -ArgumentList @(
    "--datadir=`"$UserData`"",
    "--port=3306",
    "--bind-address=127.0.0.1",
    "--console"
  ) -WindowStyle Hidden -RedirectStandardError (Join-Path $UserRun "mysqld.err") -RedirectStandardOutput (Join-Path $UserRun "mysqld.out")
  Start-Sleep 4
  Write-Host "MariaDB started on 127.0.0.1:3306"
} else {
  Write-Host "MariaDB already listening on 3306"
}

& "C:\Program Files\MariaDB 12.3\bin\mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS worker_agent_cloud;" | Out-Null

# Redis 5 on 6380
if (-not (Test-Path $RedisConf)) {
  @(
    "port 6380"
    "bind 127.0.0.1"
    "maxmemory 256mb"
  ) | Set-Content $RedisConf -Encoding ASCII
}

$redisListening = netstat -ano | Select-String -Pattern "127\.0\.0\.1:6380"
if (-not $redisListening) {
  Start-Process -FilePath $RedisServer -ArgumentList $RedisConf -WindowStyle Hidden
  Start-Sleep 2
  Write-Host "Redis 5 started on 127.0.0.1:6380"
} else {
  Write-Host "Redis already listening on 6380"
}

& "C:\Redis5\redis-cli.exe" -p 6380 ping
Write-Host "Infra ready."
