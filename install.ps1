# Install the published RichText Demo app for the current Windows user. No administrator rights required.
[CmdletBinding()]
param(
    [string]$Version = 'latest',
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\RichText Demo')
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if ($env:OS -ne 'Windows_NT') { throw 'This installer requires Windows. Use install.sh on macOS or Linux.' }
$architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
$target = switch ($architecture) {
    'AMD64' { 'x86_64-pc-windows-msvc' }
    'ARM64' { throw 'Windows releases support x86_64; on ARM64, run RichText Demo from source with nsh.' }
    default { throw "Unsupported CPU architecture: $architecture" }
}
$repository = 'https://github.com/huacnlee/nsh-richtext'
if ($Version -eq 'latest') {
    $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/huacnlee/nsh-richtext/releases/latest'
    $Version = $release.tag_name
}
$Version = $Version -replace '^v', ''
if ($Version -notmatch '^\d+\.\d+\.\d+([.-][A-Za-z0-9.-]+)?$') { throw 'Version must be a release version such as 0.1.0 or v0.1.0.' }
$asset = "richtext-demo-$Version-$target.zip"
$base = "$repository/releases/download/v$Version"
$work = Join-Path ([IO.Path]::GetTempPath()) ('richtext-demo-install-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
try {
    Write-Host "Downloading RichText Demo $Version for $target…"
    $archive = Join-Path $work $asset
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$asset" -OutFile $archive
    $checksums = Join-Path $work 'SHA256SUMS'
    Invoke-WebRequest -UseBasicParsing -Uri "$base/SHA256SUMS" -OutFile $checksums
    $expected = @(Get-Content $checksums | ForEach-Object {
        if ($_ -match '^([a-fA-F0-9]{64})\s+\*?(.+)$' -and $Matches[2] -ceq $asset) { $Matches[1] }
    })
    if ($expected.Count -ne 1) { throw "Missing or ambiguous checksum for $asset" }
    if ((Get-FileHash $archive -Algorithm SHA256).Hash -ine $expected[0]) { throw 'Checksum verification failed; nothing was installed.' }
    # Only entries that stay inside the extraction directory.
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
        foreach ($entry in $zip.Entries) {
            $name = $entry.FullName -replace '\\', '/'
            if ($name.StartsWith('/') -or $name -match '(^|/)\.\.(/|$)' -or $name -match '^[A-Za-z]:') { throw 'Release archive contains an unsafe path.' }
        }
    } finally { $zip.Dispose() }
    $unpacked = Join-Path $work 'unpacked'
    Expand-Archive -LiteralPath $archive -DestinationPath $unpacked
    if (-not (Test-Path -LiteralPath (Join-Path $unpacked 'RichText Demo.exe') -PathType Leaf)) { throw 'Release archive is missing RichText Demo.exe.' }
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    # Windows refuses to replace a running executable: the copy fails and says so.
    Copy-Item -Path (Join-Path $unpacked '*') -Destination $InstallDir -Recurse -Force
    $startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'RichText Demo.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($startMenu)
    $shortcut.TargetPath = Join-Path $InstallDir 'RichText Demo.exe'
    $shortcut.WorkingDirectory = $InstallDir
    $shortcut.IconLocation = "$InstallDir\RichText Demo.exe,0"
    $shortcut.Save()
    Write-Host "Installed $InstallDir. Launch RichText Demo from the Start menu."
} finally {
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
