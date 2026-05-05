# SzS Tracker — GitHub Frontend + Google Sheet Backend

This setup is designed for the deployment model you asked for:

- **GitHub Pages** hosts the HTML, CSS, and JavaScript frontend.
- **Google Apps Script** runs as a lightweight web app API.
- **Google Sheets** stores the tracker data.

## Why this is better

The previous setup mixed the frontend into Apps Script HTML service. That works when Apps Script serves the page, but `google.script.run` is an Apps Script HTML-service client API, so it is not available on a GitHub-hosted static page. Apps Script web apps can expose `doGet` / `doPost` endpoints, and Content Service can return raw JSON, which is a cleaner fit for a GitHub-hosted frontend. citeturn331106search5turn331106search9turn331106search0

## Files in this package

### GitHub frontend
- `index.html`
- `config.js`

### Google Apps Script backend
- `Code.gs`
- `appsscript.json`

### Data template
- `SzS_State_Tracker_Template_GitHub_Setup.csv`

## Setup steps

1. Create a Google Sheet.
2. Import `SzS_State_Tracker_Template_GitHub_Setup.csv`.
3. Copy the Sheet ID from the URL.
4. Create a standalone Apps Script project.
5. Replace the default code with `Code.gs`.
6. Replace the manifest with `appsscript.json`.
7. In `Code.gs`, set:
   - `SHEET_ID = 'your_google_sheet_id_here'`
8. Deploy the script as a **Web app**:
   - **Execute as:** Me
   - **Who has access:** Your org or the intended users
9. Copy the deployed web app URL.
10. In `config.js`, set:
   - `apiBaseUrl: "your_apps_script_web_app_url_here"`
11. Upload `index.html` and `config.js` to your GitHub Pages folder.

## Notes

- Pennsylvania is fixed to the **Northeast** region.
- The Apps Script backend auto-adds missing states if they are missing from the sheet.
- The frontend is GitHub-friendly because it does not rely on `google.script.run`.
- If your browser or org policy blocks cross-origin requests to the Apps Script URL, keep the same backend but host the frontend from Apps Script instead.

## Official references

- Apps Script web apps use `doGet` / `doPost` and can return HTML service output or Content service text output. citeturn331106search1turn822577search9
- Content Service can publish raw textual content such as JSON. citeturn331106search0turn822577search4turn331106search2
- `google.script.run` is a client-side API for HTML-service pages. citeturn331106search5turn331106search7
