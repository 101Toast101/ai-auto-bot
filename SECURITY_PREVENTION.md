## Local secret prevention (cross-platform, no external cost)

What I added
- A cross-platform Node script `scripts/check-secrets.js` that scans staged changes for common secret patterns and blocks commits if possible secrets are found.
- The Husky pre-commit hook (`.husky/pre-commit`) was updated to run this script before allowing a commit.

Why this approach
- Works locally on Windows, macOS, and Linux.
- No external paid services required.
- Prevents accidental commits of `.env` and files under `data/` by default.

How it works
- The script uses `git diff --cached` to inspect staged changes and checks for patterns such as API keys, private key headers, AWS secrets, or long base64-like strings.
- If any pattern matches, the commit is blocked and a helpful message is printed.

How to use
1. Ensure Node.js and Git are installed locally.
2. The pre-commit hook runs automatically (Husky `prepare` should have been run). To test manually:

```pwsh
# stage a file, then run:
node scripts/check-secrets.js
```

3. To bypass the local hook (not recommended), you may use `git commit --no-verify`.

Notes and next steps
- This script aims to be conservative and may produce false positives. If it blocks a valid commit, inspect staged changes, and adjust the content or refine the patterns.
- For stronger enforcement across the team, keep the CI secret-scan action enabled so PRs are scanned server-side.
