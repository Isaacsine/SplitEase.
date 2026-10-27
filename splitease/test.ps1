$path = 'frontend\dist\assets\index-BMuU1eNL.js'
if (Test-Path $path) {
    Write-Host 'EXISTS'
} else {
    Write-Host 'MISSING'
}
