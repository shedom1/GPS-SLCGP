# SLCGP State-Specific Prospecting Tool

GitHub-ready static HTML tool focused on K-12 SLCGP prospecting, with other eligible local-government organizations included as expansion categories.

## Files

- `index.html` - State Breakdown Page with compact filters, KPIs, full alphabetical state dropdown, K-12 counts, SLCGP FY/date status, state status, and source links.
- `state.html?state=GA` - State Level Page with timeline, requirements, funding path, links, K-12 prospect search, sortable columns, status counts, activity cards, export, and expanded note logging.
- `data/prospects_k12.json` - 19,336 K-12 district records normalized from the uploaded NCES/ELSI CSV.
- `data/state_programs.json` - all states + D.C. with starter SLCGP state records and updated active/watch records from the existing SLCGP tracker resource.
- `data/eligible_org_categories.json` - other eligible organization categories beyond K-12.
- `config.js` - paste your Apps Script Web App URL here for Google Sheets logging.
- `google_apps_script/Code.gs` - Google Apps Script logging endpoint.
- `schema/google_sheets_schema.csv` - recommended Google Sheet tabs/fields.

## Login

Password: `gpsslcgp`

Users can type any name. The tool stores the login in browser localStorage and logs login attempts locally. To capture logins and prospect activity in Google Sheets, deploy `google_apps_script/Code.gs` and paste the Web App URL in `config.js`.


## Prospect activity fields

The state-level log panel now captures: assigned rep, prospect status, priority, next follow-up, registered-as-vendor checkbox, vendor registration date, state buying vehicle checkbox, state buying vehicle name/contract number, state buying vehicle status, superintendent/contact name, contact title, contact email, contact phone, and notes. The Activity card view and CSV export include these fields.

## Status counts

The state-level page includes compact counts for each prospecting status type plus registered vendor and state buying vehicle counts. Counts update as filters change.

## Google Sheets logging setup

1. Create a Google Sheet called something like `SLCGP Prospecting Logs`.
2. Copy the Sheet ID from the URL.
3. Open Extensions > Apps Script.
4. Replace the script with `google_apps_script/Code.gs`.
5. Paste your Sheet ID into `SPREADSHEET_ID`.
6. Deploy > New deployment > Web app.
7. Use: Execute as **Me**. Access: **Anyone with the link** or your Workspace domain.
8. Copy the Web App URL.
9. Open `config.js` and paste it into `LOG_WEB_APP_URL`.
10. Commit the files to GitHub Pages.

## Security note

This is a static GitHub Pages convenience login. It is useful for team gating and tracking, but it is not true server-side security. For stronger control, place the site behind Cloudflare Access, Microsoft Entra application proxy, Google Workspace access, or a private authenticated host.

## Refreshing data

- Replace `data/prospects_k12.json` after future NCES updates.
- Update `data/state_programs.json` as SLCGP state windows change.
- Keep official source URLs in each state record so reps can validate before outreach.

## Branding

The CSS uses Solutionz-inspired colors from the uploaded brand guide: Solutionz Blue, navy, white, black, gray, aqua, yellow, and orange accents. Typography uses Myriad Pro if available, with Aptos/Segoe UI fallbacks.
