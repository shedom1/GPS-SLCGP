# SLCGP Campaign View Notes Backend

This package adds Google Sheet-backed notes for the `campaign-view.html` page.

## What it does
- `campaign-view.html` is a GitHub-hosted campaign brief for MT, WA, and OK.
- `campaign-notes-config.js` stores the deployed Apps Script web app URL.
- `CampaignNotes_Code.gs` is the Apps Script backend that reads and writes campaign notes to Google Sheets.
- `SLCGP_Campaign_Notes_Template.csv` is the starter Google Sheet template.

## Setup
1. Create a Google Sheet.
2. Import `SLCGP_Campaign_Notes_Template.csv`.
3. Copy the Google Sheet ID from the URL.
4. Create a standalone Apps Script project.
5. Replace the default code with `CampaignNotes_Code.gs`.
6. Replace the manifest with `campaign-notes-appsscript.json`.
7. In `CampaignNotes_Code.gs`, set `SHEET_ID` to your Google Sheet ID.
8. Deploy the Apps Script project as a web app:
   - Execute as: Me
   - Who has access: your intended users or organization
9. Copy the deployed web app URL.
10. In `campaign-notes-config.js`, set `apiBaseUrl` to that deployed URL.
11. Upload `campaign-view.html` and `campaign-notes-config.js` to GitHub Pages with your other SLCGP pages.

## Notes
- The notes tracker is only for campaign notes. It does not replace the state-status master tracker.
- The page will still render without the backend, but notes will not save until the Apps Script URL is configured.
