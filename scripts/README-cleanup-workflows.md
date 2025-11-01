# GitHub Actions Cleanup Script

This script helps you clean up old or failed GitHub Actions workflow runs.

## Prerequisites

You need a **GitHub Personal Access Token** with these scopes:
- `repo` (Full control of private repositories)
- `workflow` (Update GitHub Action workflows)

### Creating a Token

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a descriptive name (e.g., "Workflow Cleanup")
4. Select scopes: ✅ `repo` and ✅ `workflow`
5. Click **"Generate token"** and copy it immediately
6. Store it securely (you won't be able to see it again)

### Setting the Token

**PowerShell (Current Session):**
```powershell
$env:GITHUB_TOKEN = "ghp_your_token_here"
```

**PowerShell (Permanent):**
```powershell
[System.Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'ghp_your_token_here', 'User')
```

**Alternative: Use .env File** (Recommended)
Add to your `.env` file (already gitignored):
```
GITHUB_TOKEN=ghp_your_token_here
```

Then load it before running the script:
```powershell
Get-Content .env | ForEach-Object { 
    $key, $value = $_ -split '=', 2
    [System.Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim())
}
```

## Usage Examples

### Delete All Failed Runs
```powershell
.\scripts\cleanup-failed-workflows.ps1
```

### Preview Without Deleting (Dry Run)
```powershell
.\scripts\cleanup-failed-workflows.ps1 -DryRun
```

### Delete Cancelled Runs
```powershell
.\scripts\cleanup-failed-workflows.ps1 -Status "cancelled"
```

### Delete Runs Older Than 7 Days
```powershell
.\scripts\cleanup-failed-workflows.ps1 -OlderThanDays 7
```

### Delete Specific Workflow Runs
```powershell
.\scripts\cleanup-failed-workflows.ps1 -WorkflowName "ci.yml"
```

### Combine Filters
```powershell
# Delete failed CI runs older than 30 days
.\scripts\cleanup-failed-workflows.ps1 -Status "failure" -WorkflowName "ci.yml" -OlderThanDays 30
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `-Status` | String | `failure` | Filter by status: `failure`, `cancelled`, `success`, or `all` |
| `-OlderThanDays` | Int | `0` | Only delete runs older than this many days |
| `-WorkflowName` | String | `""` | Only delete runs for specific workflow (e.g., "ci.yml") |
| `-DryRun` | Switch | `false` | Preview what would be deleted without deleting |

## Safety Features

✅ **Confirmation prompt** - Always asks before deleting  
✅ **Dry run mode** - Preview changes without deleting  
✅ **Detailed summary** - Shows exactly what will be deleted  
✅ **Rate limiting** - Respects GitHub API limits  
✅ **Error handling** - Reports failed deletions

## Output Example

```
🔍 Fetching workflow runs...
📊 Found 12 runs matching status: failure

📋 Summary of runs to delete:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  8 × failure - ci.yml
  4 × failure - build-release.yml

Total runs to delete: 12

⚠️  Delete these 12 runs? (yes/no): yes

🗑️  Deleting runs...
  ✓ Deleted run #45 (CI)
  ✓ Deleted run #44 (CI)
  ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Deleted: 12
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Troubleshooting

### "GITHUB_TOKEN not set"
Make sure you've set the environment variable as shown above.

### "403 Forbidden"
Your token doesn't have the required scopes. Recreate it with `repo` and `workflow` scopes.

### "404 Not Found"
Check that the repository owner and name in the script are correct.

### Rate Limiting
The script includes automatic rate limiting (100ms delay between deletions). GitHub allows 5000 API requests per hour.

## Security Notes

⚠️ **Never commit your GitHub token to git!**  
✅ Store it in `.env` (already gitignored)  
✅ Use environment variables  
✅ Revoke tokens you no longer need at https://github.com/settings/tokens
