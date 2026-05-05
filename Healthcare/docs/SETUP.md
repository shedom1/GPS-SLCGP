# FQHC Tracker Setup Guide

## A. Google Sheet backend

1. Create a new Google Sheet.
2. Rename it `FQHC Prospect Tracker Data`.
3. Copy the Sheet ID from the URL.

Example:
`https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`

## B. Apps Script backend

1. In the Sheet, go to **Extensions > Apps Script**.
2. Paste in `apps_script/Code.gs`.
3. Add the manifest from `apps_script/appsscript.json`.
4. Go to **Project Settings > Script Properties**.
5. Add:
   - Property: `SPREADSHEET_ID`
   - Value: your Sheet ID
6. Save.
7. Run `refreshAllSources_` manually once from the Apps Script editor to authorize.
8. Deploy as Web App.

Deployment settings:
- Execute as: **Me**
- Who has access: **Anyone with the link**

## C. GitHub Pages front end

1. Paste the Web App URL into `config.js`.
2. Upload the whole folder to GitHub.
3. Turn on GitHub Pages.
4. Open `index.html`.
5. Click **Refresh Sources**.

## D. Why this avoids manual mapping

The front end only asks Apps Script for normalized records. Apps Script automatically:

- downloads the official HRSA site list,
- downloads CMS FQHC enrollment and ownership data,
- downloads USDA RUCA and HRSA FORHP rural files,
- maps source columns using alias matching,
- merges records by ZIP/state/name,
- stores normalized records in the Google Sheet,
- stores rep notes separately so source refreshes do not overwrite notes.

Reps only use the tracker.
