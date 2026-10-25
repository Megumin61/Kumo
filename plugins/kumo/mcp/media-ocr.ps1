param([Parameter(Mandatory=$true)][string]$InputFile)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]
[void][Windows.Graphics.Imaging.SoftwareBitmap,Windows.Foundation,ContentType=WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
[void][Windows.Media.Ocr.OcrResult,Windows.Foundation,ContentType=WindowsRuntime]
function Await-Operation($Operation, [Type]$ResultType) {
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } | Select-Object -First 1
    $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $task.Wait()
    return $task.Result
}
$request = Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8 | ConvertFrom-Json
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) { throw 'local_ocr_language_unavailable' }
$results = @()
foreach ($item in $request.items) {
    try {
        $file = Await-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($item.file)) ([Windows.Storage.StorageFile])
        $stream = Await-Operation ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        try {
            $decoder = Await-Operation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
            $bitmap = Await-Operation ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
            try {
                $recognized = Await-Operation ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
                $results += @{name=$item.name;resource=$item.resource;status='completed';text=($recognized.Lines | ForEach-Object Text) -join "`n"}
            } finally { $bitmap.Dispose() }
        } finally { $stream.Dispose() }
    } catch { $results += @{name=$item.name;resource=$item.resource;status='failed';error=$_.Exception.Message} }
}
@{engine='Windows.Media.Ocr';language=$engine.RecognizerLanguage.LanguageTag;items=$results} | ConvertTo-Json -Depth 6 -Compress | Set-Content -LiteralPath $request.output -Encoding UTF8
