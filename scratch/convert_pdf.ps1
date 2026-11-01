$ErrorActionPreference = "Stop"

$WorkspaceDir = "c:\IGPartners"
$ScratchDir = "$WorkspaceDir\scratch"
$MdFilePath = "$WorkspaceDir\system_master_report_and_manual.md"
$TemplatePath = "$ScratchDir\render_template.html"
$HtmlOutputPath = "$ScratchDir\render.html"
$PdfOutputPath = "$WorkspaceDir\system_master_report_and_manual.pdf"

Write-Host "1. Loading files with FileShare.ReadWrite..." -ForegroundColor Cyan
$MdContent = Get-Content -Path $MdFilePath -Raw -Encoding UTF8
$TemplateContent = Get-Content -Path $TemplatePath -Raw -Encoding UTF8

Write-Host "2. Merging Markdown into HTML template..." -ForegroundColor Yellow
$HtmlContent = $TemplateContent.Replace("__MARKDOWN_PLACEHOLDER__", $MdContent)
[System.IO.File]::WriteAllText($HtmlOutputPath, $HtmlContent, [System.Text.Encoding]::UTF8)

Write-Host "3. Generating PDF via Microsoft Edge headless..." -ForegroundColor Yellow
$Arguments = @(
    "--headless",
    "--print-to-pdf=$PdfOutputPath",
    "--no-sandbox",
    "--disable-gpu",
    "--run-all-compositor-stages-before-draw",
    $HtmlOutputPath
)

$Process = Start-Process -FilePath "msedge" -ArgumentList $Arguments -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 10

if (-not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
}

if (Test-Path $PdfOutputPath) {
    $FileSize = (Get-Item $PdfOutputPath).Length
    Write-Host "PDF generated successfully: $PdfOutputPath ($FileSize bytes)" -ForegroundColor Green
    if (Test-Path $HtmlOutputPath) {
        Remove-Item $HtmlOutputPath -Force
    }
} else {
    Write-Error "Failed to generate PDF."
}
