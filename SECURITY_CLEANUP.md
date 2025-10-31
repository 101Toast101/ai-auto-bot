# Security Cleanup & Recovery Instructions

This repository had sensitive values committed to the history. A cleanup was performed to remove those files from the current working tree and from most of Git history. Follow these steps to coordinate with your team and recover safely.

Important summary of actions taken
- Sensitive files removed from tracked history: `.env`, `data/tokens.json`, `data/savedConfigs.json`, `data/settings.json` (committed working copies were sanitized).
- A safety branch named `pre-cleanse-backup` was created and pushed before history rewrite. That branch contains the pre-clean state (do not use it in production).
- Local working tree files were sanitized and tests/lint pass.

Why you must act
- The repository history was rewritten (force-push). All collaborators who have existing clones must either re-clone or carefully reset their local repositories to avoid divergent refs and accidental re-introduction of removed secrets.

Recommended immediate steps for all contributors
1. Backup any local branches you care about:

```pwsh
# create a backup branch for your work
git checkout -b my-work-backup
git push origin my-work-backup
```

2. Re-clone the repository (recommended):

```pwsh
# rename or remove your current copy, then re-clone
cd ..
mv ai-auto-bot ai-auto-bot.old
git clone https://github.com/101Toast101/ai-auto-bot.git
cd ai-auto-bot
```

3. If you must preserve local branches instead of re-cloning, use the reset approach (advanced):

```pwsh
# Fetch fresh refs and reset local main to remote main
git fetch origin --prune
git checkout main
git reset --hard origin/main
# For feature branches: recreate them from remote or rebase your local work
```

4. Rotate any secrets that may have been leaked (tokens, OAuth client secrets, API keys). Treat the keys as compromised.

How to verify your clone is clean
- Run the secret scan locally (requires gitleaks):

```pwsh
# install gitleaks or use the docker image
gitleaks detect --source . --report-path gitleaks-local-report.json --redact
```

Notes about the cleanup
- I used git-filter-branch to remove tracked copies and aggressively garbage-collected the repo, then force-pushed the cleaned refs. A backup branch `pre-cleanse-backup` exists on the remote for audit purposes only.
- If you need a safer history rewrite, consider using `git-filter-repo` which is faster and less error-prone than `git filter-branch`.

Policy & prevention (next steps)
- Add a pre-commit hook and CI secret scan (gitleaks) — implemented in CI as `secret-scan.yml`.
- Add `/restore-points/` to `.gitignore` (done) to prevent backups from being tracked.
- Add CONTRIBUTING.md documenting secret handling and how to store keys securely (GitHub secrets / Vault).

If you want, I can also help rotate keys or prepare a PR that upgrades vulnerable dependencies discovered in the audit.

Contact
- If you're the repo admin, coordinate a time to notify all contributors to re-clone. If you want, I can prepare a template message for your team chat/email.

---
Generated: 2025-10-31
