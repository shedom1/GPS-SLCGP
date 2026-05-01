# RUS DLT Google Sheets Web App — GitHub Ready

This repository package contains the latest Google Sheets + Apps Script version of the RUS DLT prospecting tool.

## What this package includes

- `Code.gs` — Apps Script server code
- `Index.html` — HTML UI for the web app
- `appsscript.json` — Apps Script manifest
- `data/HigherEd_Seed.csv` — Higher-ed source seed
- `data/K12_TierMap.csv` — K-12 tier mapping seed
- `data/Assignments_Seed.csv` — shared assignments tab header seed
- `docs/Original_Setup_Guide.md` — fuller setup notes

## Current behavior

- **All K-12** reads from the live Google Sheet source provided by the project owner
- **All K-12** includes Locale **11–43**
- Clicking the **school name** opens a detail card with all populated source fields for that record
- **Assigned Rep / Status / Last Contact / Next Step / Notes** save to the shared `Assignments` tab in the app spreadsheet
- **HubSpot is the official place sales reps should record sales activity**
- This tool is intended for **culled grant prospecting and grant-target research**

## Recommended GitHub use

Use this repo as the source-controlled project for the Apps Script web app.

This is **not** a GitHub Pages site. The working deployment target is **Google Apps Script Web App** backed by a Google Sheet.

## Quick setup

1. Create a new GitHub repo.
2. Upload the contents of this ZIP to the repo root.
3. Create a new Google Sheet for the app backend.
4. Add tabs named:
   - `Assignments`
   - `HigherEd`
   - `K12_TierMap`
5. Import the CSVs from the `data/` folder into the matching tabs.
6. In Google Apps Script, create a new project attached to the backend spreadsheet.
7. Paste in:
   - `Code.gs`
   - `Index.html`
   - `appsscript.json`
8. Run:

```javascript
setConfig('YOUR_APP_SPREADSHEET_ID');
```

9. Deploy as a **Web app**.

## Optional: use clasp with GitHub

If your developer uses `clasp`, this repo structure is already compatible with a simple Apps Script workflow.
They can clone the repo, authenticate with Google, link the project, and push updates from GitHub-managed source.

Do **not** commit secrets, OAuth credentials, or a real `.clasp.json` file with your production Script ID unless you intend to share that access.


## Tier filters in the app

The app includes visible tier filter buttons and a tier guide section with these explanations:

- **All K-12 (Locales 11–43)** — every district from the linked K-12 source sheet with locale codes 11 through 43
- **Tier 1** — K-12 Rural Remote (Locale 43) with SAIPE 30% or greater
- **Tier 2** — K-12 Rural Remote (Locale 43) where SAIPE is unknown
- **Tier 3** — Higher-ed Rural Remote hub candidates
- **Tier 4** — Higher-ed institutions with rural outreach programs
