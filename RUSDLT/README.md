# RUS DLT Editable Tracker (Apps Script + Google Sheet)

This package is the **working saved version** of the RUS DLT HTML tracker.

## What it does
- pulls **live K-12** data from the linked Google Sheet
- uses imported seed tabs for:
  - **HigherEd**
  - **K12_TierMap**
  - **Tier1Contacts**
- lets reps type **Status**, **Assigned To**, and **Notes** directly in the HTML table
- saves those fields to the **ProspectTracker** tab for retention
- keeps **My Call** as a personal browser-only checkbox
- includes:
  - tier filters
  - tier explanations
  - region filter
  - key states filter
  - rows-per-page slider (10–100)
  - clickable organization detail card
  - phone and website in the table

## Recommended setup
Use a **Google Sheet** as the app workbook, then open **Apps Script** from that sheet.

### 1) Create a Google Sheet
Name it something like:

**RUS DLT Editable Tracker**

### 2) Import these CSV files as tabs
Use the files in the `data/` folder and import them as separate tabs with these exact names:

- `HigherEd_Seed.csv` → tab name **HigherEd**
- `K12_TierMap_Seed.csv` → tab name **K12_TierMap**
- `Tier1Contacts_Seed.csv` → tab name **Tier1Contacts**
- `ProspectTracker_Seed.csv` → tab name **ProspectTracker**

Important:
- keep the tab names **exactly** as shown above
- the `ProspectTracker` tab can stay nearly blank except for the header row

### 3) Open Apps Script from the sheet
In the Google Sheet:

**Extensions → Apps Script**

### 4) Name the Apps Script project
Use:

**RUS DLT Editable Tracker**

That is just the project name.

### 5) Replace `Code.gs`
Delete the default code and paste in the provided **Code.gs**.

### 6) Add the HTML file
Click **+** → **HTML**

Type:

**Index**

Apps Script will show it as **Index.html**. That is correct.

Paste in the provided **Index.html**.

### 7) Show the manifest
Open **Project Settings** and turn on:

**Show "appsscript.json" manifest file in editor**

Then replace the manifest contents with the provided **appsscript.json**.

### 8) Save everything
Save all files.

### 9) Test it
Click **Run** on `getInitialPayload` once so Apps Script asks for permissions.

Then:
- **Deploy → New deployment**
- **Type: Web app**
- **Execute as: Me**
- **Who has access:** your preferred audience

For an internal team, **Anyone in your organization** is usually the right choice.

### 10) Open the deployed web app
Use the web app URL for reps.

## Notes
- This version is designed to be run as an **Apps Script web app**, not GitHub Pages.
- That is what makes the in-table save behavior work cleanly.
- `Status`, `Assigned To`, and `Notes` are stored in the **ProspectTracker** sheet.
- `My Call` stays local in the browser and does not sync.
- HubSpot should remain the official system for real sales activity logging.

## Contact seed note
The `Tier1Contacts` seed includes:
- matched superintendent / district personnel contacts from the uploaded files
- the previously verified first-pass website-enriched contact rows

It does **not** guarantee a full website-email backfill for every remaining blank contact row.
