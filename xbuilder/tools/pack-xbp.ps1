param(
  [string]$Source = "$PSScriptRoot/../spx",
  [string]$Out = "$PSScriptRoot/../xbuilder-tank-battle.xbp"
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$src = (Resolve-Path $Source).Path
if (Test-Path $Out) { Remove-Item -LiteralPath $Out -Force }

$fs = [System.IO.File]::Open($Out, 'Create')
$zip = New-Object System.IO.Compression.ZipArchive($fs, 'Create')
Get-ChildItem -LiteralPath $src -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($src.Length + 1).Replace('\', '/')
  $entry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
  $stream = $entry.Open()
  $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Dispose()
}
$zip.Dispose()
$fs.Dispose()

Write-Output "packed $Out"
