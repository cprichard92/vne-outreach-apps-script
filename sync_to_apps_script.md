# Syncing Apps Script with GitHub

Keep your Google Apps Script in sync with this repo. Two options.

## Option 1: Using clasp (recommended)
Prereqs: Node.js, npm, Apps Script access to the target project.

1. Install clasp:
   ```bash
   npm install -g @google/clasp
   ```
2. Login:
   ```bash
   clasp login
   ```
3. If you already have an Apps Script project, get its Script ID from **Project Settings**. Then bootstrap a local folder (once):
   ```bash
   mkdir vne-outreach-apps-script-gas && cd $_
   clasp clone <SCRIPT_ID>
   ```
   If creating a brand-new script from this repo instead:
   ```bash
   clasp create --title "VNE Outreach" --type standalone
   ```
4. Copy the repo `src/` files into the clasp folder. Keep filenames the same.
5. Push local files to Apps Script:
   ```bash
   clasp push
   ```
6. Pull edits made in Apps Script back to your local folder when needed:
   ```bash
   clasp pull
   ```

### Useful tips
- To pin root files vs. subfolders, manage them with a `.claspignore` if needed.
- Apps Script respects file suffixes: `.gs` for server code, `.html` for templates.
- Commit your clasp folder to GitHub only if you want the script manifest here. Otherwise keep it separate and just copy `src/` in.

## Option 2: Manual copy (no tooling)
1. Open your Sheet → **Extensions → Apps Script**.
2. For each file in `src/`, create a file with the same name and paste content.
3. To update later, overwrite the content in each file manually from GitHub.

## Environment setup
- In Apps Script, set Script Property `GEMINI_API_KEY`.
- Enable **Advanced Gmail Service**.
- Run `setupDailyTrigger()` once.

## Workflow suggestion
- Do refactors in Git branches here.
- Merge to `main` when green.
- After merge, `clasp pull` into your local clasp folder and `clasp push` to deploy.
