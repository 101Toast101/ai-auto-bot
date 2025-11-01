#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Cleans up failed GitHub Actions workflow runs.

.DESCRIPTION
    This script uses the GitHub REST API to delete workflow runs based on status.
    Requires a GitHub Personal Access Token with 'repo' and 'workflow' scopes.

.PARAMETER Status
    Filter by run status: failure, cancelled, success, or all (default: failure)

.PARAMETER OlderThanDays
    Only delete runs older than this many days (default: 0 = all)

.PARAMETER WorkflowName
    Only delete runs for a specific workflow file (e.g., "ci.yml")

.PARAMETER DryRun
    Preview what would be deleted without actually deleting

.EXAMPLE
    .\cleanup-failed-workflows.ps1
    Deletes all failed runs

.EXAMPLE
    .\cleanup-failed-workflows.ps1 -Status "cancelled" -OlderThanDays 7
    Deletes cancelled runs older than 7 days

.EXAMPLE
    .\cleanup-failed-workflows.ps1 -DryRun
    Preview what would be deleted
#>

param(
    [Parameter()]
    [ValidateSet("failure", "cancelled", "success", "all")]
    [string]$Status = "failure",

    [Parameter()]
    [int]$OlderThanDays = 0,

    [Parameter()]
    [string]$WorkflowName = "",

    [Parameter()]
    [switch]$DryRun
)

# Configuration
$owner = "101Toast101"
$repo = "ai-auto-bot"

# Check for GitHub token
$token = $env:GITHUB_TOKEN
if (-not $token) {
    Write-Host "❌ Error: GITHUB_TOKEN environment variable not set." -ForegroundColor Red
    Write-Host ""
    Write-Host "To use this script, you need a GitHub Personal Access Token with 'repo' and 'workflow' scopes." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Steps to create a token:" -ForegroundColor Cyan
    Write-Host "1. Go to https://github.com/settings/tokens" -ForegroundColor White
    Write-Host "2. Click 'Generate new token' → 'Generate new token (classic)'" -ForegroundColor White
    Write-Host "3. Give it a name like 'Workflow Cleanup'" -ForegroundColor White
    Write-Host "4. Select scopes: 'repo' and 'workflow'" -ForegroundColor White
    Write-Host "5. Click 'Generate token' and copy it" -ForegroundColor White
    Write-Host ""
    Write-Host "Then set it as an environment variable:" -ForegroundColor Cyan
    Write-Host "  `$env:GITHUB_TOKEN = 'your_token_here'" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Build API URL
$baseUrl = "https://api.github.com/repos/$owner/$repo/actions/runs"
$headers = @{
    "Authorization" = "Bearer $token"
    "Accept" = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

Write-Host "🔍 Fetching workflow runs..." -ForegroundColor Cyan

# Fetch workflow runs
$allRuns = @()
$page = 1
$perPage = 100

do {
    $url = "$baseUrl?per_page=$perPage&page=$page"
    if ($Status -ne "all") {
        $url += "&status=$Status"
    }

    try {
        $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
        $allRuns += $response.workflow_runs
        $page++

        # Check if there are more pages
        if ($response.workflow_runs.Count -lt $perPage) {
            break
        }
    } catch {
        Write-Host "❌ Error fetching runs: $_" -ForegroundColor Red
        exit 1
    }
} while ($true)

Write-Host "📊 Found $($allRuns.Count) runs matching status: $Status" -ForegroundColor Green

# Filter by date if specified
if ($OlderThanDays -gt 0) {
    $cutoffDate = (Get-Date).AddDays(-$OlderThanDays)
    $allRuns = $allRuns | Where-Object { [DateTime]$_.created_at -lt $cutoffDate }
    Write-Host "📅 Filtered to $($allRuns.Count) runs older than $OlderThanDays days" -ForegroundColor Green
}

# Filter by workflow name if specified
if ($WorkflowName) {
    $allRuns = $allRuns | Where-Object { $_.path -like "*$WorkflowName*" }
    Write-Host "📝 Filtered to $($allRuns.Count) runs for workflow: $WorkflowName" -ForegroundColor Green
}

if ($allRuns.Count -eq 0) {
    Write-Host "✅ No runs to delete!" -ForegroundColor Green
    exit 0
}

# Display summary
Write-Host ""
Write-Host "📋 Summary of runs to delete:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

$grouped = $allRuns | Group-Object -Property status, path | Sort-Object Count -Descending
foreach ($group in $grouped) {
    $status = $group.Group[0].status
    $workflow = ($group.Group[0].path -split '/')[-1]
    $count = $group.Count

    $statusColor = switch ($status) {
        "failure" { "Red" }
        "cancelled" { "Yellow" }
        "success" { "Green" }
        default { "White" }
    }

    Write-Host "  $count × " -NoNewline -ForegroundColor White
    Write-Host "$status" -NoNewline -ForegroundColor $statusColor
    Write-Host " - $workflow" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Total runs to delete: $($allRuns.Count)" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host ""
    Write-Host "🔍 DRY RUN - No changes made" -ForegroundColor Yellow
    Write-Host "Remove -DryRun flag to actually delete these runs." -ForegroundColor Yellow
    exit 0
}

# Confirm deletion
Write-Host ""
$confirmation = Read-Host "⚠️  Delete these $($allRuns.Count) runs? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "❌ Cancelled" -ForegroundColor Yellow
    exit 0
}

# Delete runs
Write-Host ""
Write-Host "🗑️  Deleting runs..." -ForegroundColor Cyan

$deleted = 0
$failed = 0

foreach ($run in $allRuns) {
    try {
        $deleteUrl = "$baseUrl/$($run.id)"
        Invoke-RestMethod -Uri $deleteUrl -Headers $headers -Method Delete | Out-Null
        $deleted++
        Write-Host "  ✓ Deleted run #$($run.run_number) ($($run.name))" -ForegroundColor Green
    } catch {
        $failed++
        Write-Host "  ✗ Failed to delete run #$($run.run_number): $_" -ForegroundColor Red
    }

    # Rate limiting - GitHub allows 5000 requests per hour
    Start-Sleep -Milliseconds 100
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "✅ Deleted: $deleted" -ForegroundColor Green
if ($failed -gt 0) {
    Write-Host "❌ Failed: $failed" -ForegroundColor Red
}
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
