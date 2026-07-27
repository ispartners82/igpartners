# ==========================================================================
# IGPartners - 마크다운 시스템 명세서 PDF 변환 자동화 스크립트
# ==========================================================================

$ErrorActionPreference = "Stop"

$WorkspaceDir = "D:\igpartners"
$ScratchDir = "$WorkspaceDir\scratch"
$MdFilePath = "$WorkspaceDir\system_specification.md"
$TemplatePath = "$ScratchDir\render_template.html"
$HtmlOutputPath = "$ScratchDir\render.html"
$PdfOutputPath = "$WorkspaceDir\system_specification.pdf"

Write-Host "1. Starting PDF Conversion..." -ForegroundColor Cyan

if (-not (Test-Path $MdFilePath)) {
    Write-Error "Markdown file not found"
}

Write-Host "2. Loading template and source..." -ForegroundColor Yellow
$MdContent = [System.IO.File]::ReadAllText($MdFilePath, [System.Text.Encoding]::UTF8)
$TemplateContent = [System.IO.File]::ReadAllText($TemplatePath, [System.Text.Encoding]::UTF8)

Write-Host "3. Injecting content to template..." -ForegroundColor Yellow
$HtmlContent = $TemplateContent.Replace("__MARKDOWN_PLACEHOLDER__", $MdContent)

[System.IO.File]::WriteAllText($HtmlOutputPath, $HtmlContent, [System.Text.Encoding]::UTF8)
Write-Host "HTML file created: $HtmlOutputPath" -ForegroundColor Green

Write-Host "4. Printing PDF using MS Edge..." -ForegroundColor Yellow
$Arguments = @(
    "--headless",
    "--print-to-pdf=$PdfOutputPath",
    "--no-sandbox",
    "--disable-gpu",
    $HtmlOutputPath
)

$Process = Start-Process -FilePath "msedge" -ArgumentList $Arguments -PassThru -WindowStyle Hidden
Write-Host "Waiting for rendering (5 seconds)..." -ForegroundColor Magenta
Start-Sleep -Seconds 5

if (-not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
}

if (Test-Path $PdfOutputPath) {
    $FileSize = (Get-Item $PdfOutputPath).Length
    Write-Host "5. PDF Created successfully!" -ForegroundColor Green
    Write-Host "Path: $PdfOutputPath" -ForegroundColor Green
    Write-Host "Size: $FileSize bytes" -ForegroundColor Green
    
    if (Test-Path $HtmlOutputPath) {
        Remove-Item $HtmlOutputPath -Force
    }
} else {
    Write-Error "Failed to create PDF file."
}
