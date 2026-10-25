param([string]$LibraryRoot,[switch]$Restart)
$ErrorActionPreference = 'Stop'
if ($Restart) { throw '请先退出旧版本 Kumo 本地助手，再运行此脚本。脚本不会终止现有进程。' }
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw '请先安装 Node.js 22 或更新版本，再重新运行。' }
$launcher = Join-Path $PSScriptRoot 'start-helper.mjs'
if ($LibraryRoot) { & $node.Source $launcher --library $LibraryRoot } else { & $node.Source $launcher }
if ($LASTEXITCODE -ne 0) { throw 'Kumo 本地助手未连接，请查看上面的提示。' }
