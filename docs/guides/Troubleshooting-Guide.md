\# Troubleshooting Guide

Common issues and their solutions for AI Auto Bot.

---

\## 🚫 App Won't Start

\### Issue: "Error: Cannot find module"

\*\*Solution:\*\*

```bash

\# Reinstall dependencies

rm -rf node\_modules

npm install

```

\### Issue: "ENOENT: no such file or directory, open 'data/settings.json'"

\*\*Solution:\*\*

\- App auto-creates data folder on first run

\- If error persists, manually create:

```bash

mkdir data

echo "{}" > data/settings.json

```

---

\## 🔑 API Key Issues

\### Issue: "API Key required for AI generation!"

\*\*Cause:\*\* No OpenAI API key entered or key not saved

\*\*Solution:\*\*

1\. Go to General section

2\. Enter your OpenAI API key (starts with `sk-...`)

3\. Click "Save Config" to persist the key

4\. Key is automatically encrypted

\### Issue: "OpenAI API error: 401 Unauthorized"

\*\*Cause:\*\* Invalid or expired API key

\*\*Solution:\*\*

1\. Verify key at https://platform.openai.com/api-keys

2\. Generate new key if needed

3\. Check billing is set up: https://platform.openai.com/account/billing

4\. Replace key in app and save config

\### Issue: "OpenAI API error: 429 Rate Limit"

\*\*Cause:\*\* Too many requests or insufficient credits

\*\*Solution:\*\*

1\. Wait 1 minute and try again

2\. Check usage: https://platform.openai.com/usage

3\. Add more credits if balance is low

4\. Upgrade tier if on free plan

---

\## 📱 Social Media Posting Issues

\### Issue: "Please provide at least one social media token!"

\*\*Cause:\*\* No platform tokens configured

\*\*Solution:\*\*

1\. Go to Tokens section

2\. Enter token for at least one platform

3\. Click "Save Config"

4\. See API-SETUP-GUIDE.md for getting tokens

\### Issue: "Instagram posting failed: Invalid access token"

\*\*Causes:\*\*

\- Token expired (60-day limit)

\- Wrong token type (need Page Access Token)

\- Missing permissions

\*\*Solution:\*\*

1\. Regenerate token via Facebook Graph API Explorer

2\. Ensure these permissions:

&nbsp; - `instagram\_basic`

&nbsp; - `instagram\_content\_publish`

&nbsp; - `pages\_read\_engagement`

3\. Use long-lived token (60 days vs 1 hour)

4\. Verify Instagram is Business account

\### Issue: "TikTok posting failed: App not approved"

\*\*Cause:\*\* Developer app still pending approval

\*\*Solution:\*\*

\- TikTok app approval takes 1-2 weeks

\- Check status: https://developers.tiktok.com/apps

\- Use other platforms while waiting

\### Issue: "Twitter posting failed: Forbidden"

\*\*Causes:\*\*

\- App doesn't have Read+Write permissions

\- Using wrong token type

\- Developer account suspended

\*\*Solution:\*\*

1\. Check app permissions in Twitter Developer Portal

2\. Enable "Read and Write" access

3\. Regenerate access token after permission change

4\. Verify account is in good standing

---

\## 🖼️ Image Generation Issues

\### Issue: "AI generation failed: content policy violation"

\*\*Cause:\*\* Prompt violates OpenAI's content policy

\*\*Solution:\*\*

\- Avoid prompts with violence, adult content, or hate speech

\- Rephrase to be more general

\- See: https://openai.com/policies/usage-policies

\### Issue: "Image preview not showing"

\*\*Causes:\*\*

\- Content Security Policy blocking image

\- Network issue

\- Invalid image URL

\*\*Solution:\*\*

1\. Check browser console for errors (F12)

2\. Verify image URL is accessible

3\. Try different template

4\. Clear browser cache

\### Issue: "Meme preview shows 'undefined'"

\*\*Cause:\*\* Text fields empty

\*\*Solution:\*\*

\- Enter text in "Top Text" and "Bottom Text" fields

\- Template memes require text to generate

---

\## 📅 Scheduling Issues

\### Issue: "Scheduled posts not executing"

\*\*Causes:\*\*

\- App not running

\- Auto-scheduler disabled

\- Time zone mismatch

\*\*Solution:\*\*

1\. Keep app running for auto-execution

2\. Check activity log for "📅 Auto-scheduler is active"

3\. Verify timezone in Scheduling section

4\. Scheduler checks every 60 seconds

\### Issue: "Post scheduled but disappeared"

\*\*Cause:\*\* Post was executed and status changed

\*\*Solution:\*\*

\- Check Activity Log for execution message

\- Look in Content Library with filter = "posted"

\- Successful posts are automatically archived

---

\## 💾 Configuration Issues

\### Issue: "Config not saving"

\*\*Cause:\*\* File permissions or disk space

\*\*Solution:\*\*

```bash

\# Check disk space

df -h



\# Check data folder permissions

ls -la data/



\# If permission denied:

chmod -R 755 data/

```

\### Issue: "Config loads but tokens missing"

\*\*Cause:\*\* Encryption/decryption mismatch

\*\*Solution:\*\*

\- Tokens can only be decrypted on same machine

\- If you moved to new computer, re-enter tokens

\- Encryption is machine-specific for security

\### Issue: "All configs show same settings"

\*\*Cause:\*\* Not saving properly or deduplication issue

\*\*Solution:\*\*

1\. Use unique config names

2\. Check `data/savedConfigs.json` file size

3\. If corrupted, delete and recreate configs

---

\## 📦 Bulk Generation Issues

\### Issue: "Bulk generation stuck at 0%"

\*\*Causes:\*\*

\- Network issue with Memegen API

\- Invalid template selection

\- Text variation generation failed

\*\*Solution:\*\*

1\. Check internet connection

2\. Try "Random Templates" instead of "Single Template"

3\. For AI mode, verify OpenAI API key

4\. Try smaller quantity first (10 instead of 100)

\### Issue: "ZIP download fails"

\*\*Cause:\*\* JSZip library not loaded or browser memory limit

\*\*Solution:\*\*

1\. Check if JSZip loaded (look for CDN error in console)

2\. Try smaller batch size (50 instead of 100)

3\. Download CSV instead of ZIP if memory issues

4\. Clear browser cache and restart app

\### Issue: "Generated images look identical"

\*\*Cause:\*\* Using same template + text combination

\*\*Solution:\*\*

1\. Use "Random Templates" strategy

2\. For AI mode, provide varied prompts

3\. For manual mode, enter different text per line

4\. Verify text variations are being generated

---

\## 🌙 Dark Mode Issues

\### Issue: "Dark mode won't toggle"

\*\*Cause:\*\* CSS not loaded or localStorage issue

\*\*Solution:\*\*

1\. Refresh app (Ctrl+R or Cmd+R)

2\. Check console for CSS errors

3\. Try toggling twice

4\. Restart app

\### Issue: "Dark mode resets on restart"

\*\*Cause:\*\* State not persisted

\*\*Solution:\*\*

\- This is expected behavior currently

\- Toggle is session-based

\- Future update will persist preference

---

\## 🔍 Activity Log Issues

\### Issue: "Activity log not showing"

\*\*Cause:\*\* Log container not rendering

\*\*Solution:\*\*

1\. Scroll down to Activity Log section

2\. Check if collapsed - expand fieldset

3\. Restart app if not visible

\### Issue: "Log entries missing timestamps"

\*\*Cause:\*\* System clock incorrect

\*\*Solution:\*\*

1\. Verify system time is correct

2\. Check timezone settings

3\. Restart app after fixing time

---

\## 🗂️ Content Library Issues

\### Issue: "Library shows 'No content found'"

\*\*Causes:\*\*

\- Haven't generated any content yet

\- Filters too restrictive

\- Library file corrupted

\*\*Solution:\*\*

1\. Generate or post some content first

2\. Set filter to "All Content"

3\. Clear search field

4\. Check `data/library.json` exists

\### Issue: "Can't delete library item"

\*\*Cause:\*\* File permissions or corrupted JSON

\*\*Solution:\*\*

1\. Check file permissions on data folder

2\. Try closing and reopening app

3\. Manually edit `data/library.json` if needed

---

\## 💻 Performance Issues

\### Issue: "App running slow"

\*\*Causes:\*\*

\- Too many items in library

\- Large activity log

\- Memory leak

\*\*Solution:\*\*

1\. Archive old content from library

2\. Clear activity log occasionally

3\. Restart app regularly

4\. Close unused browser tabs

\### Issue: "High CPU usage"

\*\*Cause:\*\* Auto-scheduler or bulk generation running

\*\*Solution:\*\*

\- Normal during bulk generation

\- Scheduler uses minimal CPU (checks every 60s)

\- If persistent, restart app

---

\## 🔒 Security Concerns

\### Issue: "Are my API keys safe?"

\*\*Answer:\*\* Yes!

\- Keys are encrypted using AES-256-GCM

\- Encryption key derived from machine ID

\- Keys only decrypt on same machine

\- Never transmitted except to respective APIs

\### Issue: "Can I backup my configs?"

\*\*Answer:\*\* Yes, but carefully:

1\. Copy entire `data/` folder

2\. Keys will only work on source machine

3\. On new machine, re-enter keys manually

4\. Never commit data folder to Git

---

\## 📞 Still Having Issues?

\### Check These First:

1\. ✅ App version is latest

2\. ✅ Node.js version >= 14

3\. ✅ All dependencies installed (`npm install`)

4\. ✅ Internet connection stable

5\. ✅ API keys valid and have credits

6\. ✅ Platform tokens not expired

\### Debug Mode:

Open Developer Tools (F12) and check:

\- Console tab for JavaScript errors

\- Network tab for failed API requests

\- Application tab for localStorage issues

\### Common Error Patterns:

\*\*"TypeError: Cannot read property 'X' of null"\*\*

\- Element not found in DOM

\- Refresh app or restart

\*\*"CORS policy blocking"\*\*

\- API endpoint blocked by browser

\- Check Content Security Policy in index.html

\*\*"Failed to fetch"\*\*

\- Network issue or invalid API endpoint

\- Check internet connection

\- Verify API endpoint is correct

---

\## 🛠️ Manual Fixes

\### Reset Everything:

```bash

\# WARNING: Deletes all data

rm -rf data/

npm start

```

\### Reset Just Configs:

```bash

rm data/savedConfigs.json

rm data/settings.json

```

\### Reset Just Library:

```bash

rm data/library.json

```

\### Check Data Integrity:

```bash

\# Validate JSON files

cat data/settings.json | python -m json.tool

cat data/library.json | python -m json.tool

```

---

\## 📚 Additional Resources

\- \*\*OpenAI Status\*\*: https://status.openai.com

\- \*\*Instagram Platform Status\*\*: https://developers.facebook.com/status

\- \*\*Twitter API Status\*\*: https://api.twitterstat.us

\- \*\*Node.js Issues\*\*: https://nodejs.org/en/docs

---

\## 🎯 Quick Fixes Checklist

Before asking for help, try:

\- \[ ] Restart the app

\- \[ ] Clear browser cache

\- \[ ] Run `npm install` again

\- \[ ] Check API keys are valid

\- \[ ] Verify internet connection

\- \[ ] Look in Activity Log for clues

\- \[ ] Check Developer Console (F12)

\- \[ ] Try with smaller data set

\- \[ ] Update to latest version

\- \[ ] Read API-SETUP-GUIDE.md

---

\*\*Still stuck?\*\* Check the Activity Log in the app - it usually tells you exactly what went wrong! 🔍
