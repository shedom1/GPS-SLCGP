# RUS DLT 2026 Tiered Callout Interactive HTML

This package creates a GitHub Pages-friendly HTML tracker that reads the RUS DLT 2026 source workbook and saves sales-rep callout activity to Google Sheets.

## What it does

- Reads the source workbook: `https://docs.google.com/spreadsheets/d/1eDW0C7vnnfT7dOjQIk-EHAWeFNdI2iYeiXxH6uy3hfY/edit?usp=sharing`
- Uses these source tabs:
  - `T1:Very Rural and >30% Saipe`
  - `T2: K-12 Rural Remote SAIPE Unknown`
  - `T3:Higher Ed Search for Rural`
  - `T4: Higher Ed-Rural Outreach`
  - `All K-12`
  - `SITE_FQHC_FQHC_LAL_DD_VX` for HRSA/FQHC lookup
- Defaults to the first-round key states filter and **Table** view for faster callout scanning.
- Lets reps update:
  - Assigned To
  - Status
  - Priority
  - Next Follow-Up
  - Last Contact Date
  - Superintendent name/email
  - Other contact name/title/email/phone
  - Contact source / verification note
  - Rep notes
- Saves updates to a `Rep Activity` tab and logs changes in `Activity Log`.
- Includes a progress dashboard showing counts by assigned rep, state, status, next follow-up bucket, and priority.
- Includes HRSA/FQHC lookup by state, county/city, and approximate distance when coordinates are available.

## File structure

```text
index.html              Main GitHub Pages app
styles.css              Visual styling
app.js                  Front-end logic
config.js               Edit this with your Apps Script Web App URL
apps_script/Code.gs     Google Apps Script backend
schema/                 Optional reference CSV templates
```

## Setup steps

### 1. Add the Apps Script backend

1. Open the source Google Sheet, or your dedicated tracking workbook.
2. Go to **Extensions > Apps Script**.
3. Delete any starter code.
4. Paste the full contents of `apps_script/Code.gs`.
5. Confirm this value is correct at the top of the file:

```javascript
SOURCE_SPREADSHEET_ID: '1eDW0C7vnnfT7dOjQIk-EHAWeFNdI2iYeiXxH6uy3hfY'
```

6. Leave `TRACKER_SPREADSHEET_ID` blank if the script is bound to the workbook where you want to store rep updates. If you want a separate tracker workbook, paste that workbook ID into `TRACKER_SPREADSHEET_ID`.

### 2. Create the tracking tabs

In Apps Script, run:

```javascript
setupTrackerWorkbook
```

Authorize the script when prompted. This creates or verifies these tabs:

- `Rep Activity`
- `Activity Log`
- `Users`
- `Settings`

### 3. Deploy as a Web App

1. Click **Deploy > New deployment**.
2. Select **Web app**.
3. Use these settings:
   - **Execute as:** Me
   - **Who has access:** Anyone with the link, or your Workspace domain if this is internal-only
4. Click **Deploy**.
5. Copy the Web App URL.

### 4. Connect the HTML app

Open `config.js` and replace:

```javascript
API_URL: "PASTE_YOUR_DEPLOYED_APPS_SCRIPT_WEB_APP_URL_HERE"
```

with your deployed Web App URL.

### 5. Publish to GitHub Pages

Upload these files to the GitHub Pages folder or repo root:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

The `apps_script` and `schema` folders do not need to be hosted publicly, but keep them in the repo for maintenance.

## Optional HRSA refresh

The source workbook already includes a HRSA/FQHC-style tab named `SITE_FQHC_FQHC_LAL_DD_VX`. The app will use that tab automatically.

If you want to refresh that tab directly from the HRSA XLSX download:

1. In Apps Script, open **Services**.
2. Add **Drive API** under Advanced Google Services.
3. In the linked Google Cloud project, enable **Google Drive API**.
4. Run:

```javascript
refreshHrsaLookupFromXlsx
```

This converts the HRSA XLSX to a temporary Google Sheet, copies the rows into `SITE_FQHC_FQHC_LAL_DD_VX`, then trashes the temporary file.

## Security notes

This is built for a static GitHub Pages front end. The Google Sheet itself can remain private because Apps Script reads/writes as the deploying user.

Important:

- If the Web App is set to **Anyone with the link**, anyone who obtains the Web App URL can attempt requests.
- `API_TOKEN` can reduce accidental/casual writes, but it is visible in `config.js`, so it is not true security.
- Do not store sensitive student, patient, HIPAA, or confidential customer information in rep notes.
- For stronger access control, deploy the Web App to your Workspace domain and host the HTML in an internal-access location.

## Suggested workflow for sales reps

1. Start with **Tier 1** and keep **Key states only** turned on.
2. Filter by assigned state or rep.
3. Open a card.
4. Save assignment/status and contact updates.
5. Use **Find Nearby HRSA/FQHC** to identify possible healthcare partners for hub-and-spoke DLT discussions.
6. Use the **Callout Progress Dashboard** to monitor workload by rep, state, status, follow-up timing, and priority.
7. Move prospects from `Not Started` to `Assigned`, `Contacted`, `Interested`, `Follow Up`, or `Not a Fit`.
8. Use the `Rep Activity` Google Sheet tab for management review and pivot reporting.

## First-round key states

Mississippi, Illinois, North Carolina, Alaska, Ohio, Oregon, Idaho, Arizona, South Dakota, Florida, Nebraska, Arkansas, New Mexico, Wisconsin, Iowa, Nevada, Utah, Indiana, Montana, North Dakota, New Hampshire, Wyoming, Massachusetts, Hawaii.
