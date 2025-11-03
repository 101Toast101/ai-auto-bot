### URGENT: Repo history cleaned — action required

Hi team,

We performed an emergency security cleanup on this repository to remove committed secrets. This included rewriting git history and force-pushing cleaned refs. If you have a local clone, you must follow recovery steps to avoid re-introducing secrets or creating divergent history.

Please:

1) Back up any work you need (create a branch and push it):

```pwsh
git checkout -b my-work-backup
git push origin my-work-backup
```

2) Re-clone the repo (recommended):

```pwsh
cd ..
# Rename or remove your old copy
mv ai-auto-bot ai-auto-bot.old
git clone https://github.com/101Toast101/ai-auto-bot.git
cd ai-auto-bot
```

3) If you cannot re-clone, reset your local main:

```pwsh
git fetch origin --prune
git checkout main
git reset --hard origin/main
```

4) Rotate any secrets (API keys, OAuth secrets, tokens) that you might have used with this repo — treat them as compromised.

We added a stricter CI secret-scan (gitleaks). PRs will now fail if secrets are detected, and the workflow will post a summary comment on the PR with the first findings.

If you need help migrating local branches or recovering work, reply here and we'll coordinate a time to assist.

— Security team
