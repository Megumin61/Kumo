param([string]$LibraryRoot)
$ErrorActionPreference='Stop'
$automationNode=Get-Command node -ErrorAction Stop
function Read-KumoStatus([string]$Address){
  $raw=& $automationNode.Source --input-type=module -e 'try{const r=await fetch(process.argv[1]+"/status",{signal:AbortSignal.timeout(1500)});if(!r.ok)process.exit(1);console.log(JSON.stringify(await r.json()));}catch{process.exit(1)}' $Address 2>$null
  if($LASTEXITCODE -ne 0 -or -not $raw){return $null}
  return $raw | ConvertFrom-Json
}
if(-not $LibraryRoot){
  $mainBridge=Read-KumoStatus 'http://127.0.0.1:43789'
  if($mainBridge.service -ne 'kumo-local-bridge'){throw '请先启动原 Kumo 本地助手，或显式提供 -LibraryRoot。'}
  $LibraryRoot=$mainBridge.libraryRoot
}
if(-not [IO.Path]::IsPathRooted($LibraryRoot) -or -not (Test-Path -LiteralPath (Join-Path $LibraryRoot 'LIBRARY.md'))){throw '请提供现有 Kumo 资料库的完整路径。不会创建空资料库。'}
$LibraryRoot=[IO.Path]::GetFullPath($LibraryRoot)
$existingAutomation=Read-KumoStatus 'http://127.0.0.1:43791'
if($existingAutomation){
  if($existingAutomation.service -ne 'kumo-local-bridge' -or $existingAutomation.libraryRoot -ne $LibraryRoot -or 'page_capture' -notin $existingAutomation.capabilities){throw '43791 已连接其他服务或资料库，未做修改。'}
  Write-Output 'Kumo 自动化入口已连接：http://127.0.0.1:43791';return
}
$automationServer=Join-Path $PSScriptRoot 'server.mjs'
$automationLogDirectory=Join-Path $PSScriptRoot '..\deliverables\bridge-service'
New-Item -ItemType Directory -Path $automationLogDirectory -Force | Out-Null
$automationLogStamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$oldAutomationRoot=$env:KUMO_LIBRARY_ROOT;$oldAutomationPort=$env:KUMO_BRIDGE_PORT
try{
  $env:KUMO_LIBRARY_ROOT=$LibraryRoot;$env:KUMO_BRIDGE_PORT='43791'
  Start-Process -FilePath $automationNode.Source -ArgumentList ('"'+$automationServer+'"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $automationLogDirectory ($automationLogStamp+'-automation-out.log')) -RedirectStandardError (Join-Path $automationLogDirectory ($automationLogStamp+'-automation-error.log')) | Out-Null
}finally{$env:KUMO_LIBRARY_ROOT=$oldAutomationRoot;$env:KUMO_BRIDGE_PORT=$oldAutomationPort}
for($attempt=0;$attempt -lt 15;$attempt++){
  $connected=Read-KumoStatus 'http://127.0.0.1:43791'
  if($connected.service -eq 'kumo-local-bridge' -and $connected.libraryRoot -eq $LibraryRoot -and 'page_capture' -in $connected.capabilities){Write-Output 'Kumo 自动化入口已连接：http://127.0.0.1:43791';return}
  Start-Sleep -Milliseconds 200
}
throw '自动化入口尚未就绪，请查看 deliverables/bridge-service 中的日志。'
