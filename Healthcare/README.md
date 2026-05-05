# FQHC Prospect Lookup Tracker

This package is designed for a GitHub Pages front end with a Google Apps Script backend. Reps should not manually map HRSA/CMS/RUCA sources. Apps Script does the source fetching, normalization, enrichment, and note storage.

## What this solves

Earlier browser fetch attempts failed because GitHub Pages JavaScript was trying to read government files from other domains. Even if a URL opens in a browser, JavaScript can be blocked by CORS, redirects, file headers, or large downloads. This version uses Apps Script as a server-side proxy/cache.

## Files

- `index.html` — FQHC tracker UI
- `assets/app.js` — table/card view, filtering, sorting, RUCA multi-select, CSV/PDF output, note saves
- `assets/styles.css` — clean/professional styling
- `config.js` — paste the Apps Script Web App URL here
- `apps_script/Code.gs` — backend API/proxy/normalizer
- `apps_script/appsscript.json` — Apps Script project manifest
- `data/rep_notes_template.csv` — header-only optional import/export reference

## Source strategy

Primary source:
- HRSA Health Center Service Delivery and Look-Alike Sites CSV

Enrichment layers:
- CMS FQHC Enrollments API
- CMS FQHC All Owners API
- USDA ERS ZIP RUCA XLSX
- HRSA FORHP ZIP rural approximation XLSX

Contact email note:
Official FQHC datasets usually provide site address, phone, and website more reliably than direct prospecting email. The tracker includes official contact fields when present, plus rep-editable `Contact_Name` and `Contact_Email` fields stored in the Google Sheet.

## Setup

1. Create a Google Sheet named `FQHC Prospect Tracker Data`.
2. Open the Sheet, then go to **Extensions > Apps Script**.
3. Replace the default code with `apps_script/Code.gs`.
4. Open Project Settings and add this Script Property:
   - `SPREADSHEET_ID` = the ID from your Google Sheet URL.
5. Replace the manifest with `apps_script/appsscript.json`:
   - In Apps Script, click Project Settings.
   - Check **Show appsscript.json manifest file in editor**.
   - Open `appsscript.json` and replace it with the file provided here.
6. Click **Deploy > New deployment > Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone with the link**
7. Copy the Web App URL.
8. Paste the URL into `config.js`.
9. Upload this folder to GitHub Pages.
10. Open the tracker and click **Refresh Sources**, then **Load Data**.

## Rep workflow

- Open tracker URL.
- Click **Load Data** if it does not auto-load.
- Filter by State, Region, RUCA, Rural, Status, or keyword.
- Use Table or Card view.
- Add Contact Name, Contact Email, Assigned To, Status, Priority, Follow-up Date, and Notes.
- Click Save on a row/card.
- Export filtered results to CSV or use Save PDF.

## Troubleshooting

### The page says setup needed
Paste the Apps Script Web App URL into `config.js`.

### Refresh Sources fails
Open the Apps Script editor and run `refreshAllSources_` once. Google will ask you to authorize the script to access your Sheet and external URLs.

### RUCA or FORHP shows warning
The tracker still works with HRSA/CMS data. RUCA/FORHP enrichment uses XLSX files parsed server-side. If a source format changes, the source card will show a warning rather than breaking the page.

### Notes do not save
Confirm the Apps Script deployment is a Web App with access set to **Anyone with the link** and execute as **Me**.
