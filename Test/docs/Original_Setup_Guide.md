
# RUS DLT Google Sheets Web App — v2

This version changes two core things:

1. **All K-12** now reads from the live Google Sheet source you provided  
   `1eDW0C7vnnfT7dOjQIk-EHAWeFNdI2iYeiXxH6uy3hfY`
2. Clicking a **school name** opens a detail card populated from that source record.

## What is stored where

- **Live K-12 source**: your linked Google Sheet
- **Higher-ed source**: the local `HigherEd` tab in the app spreadsheet
- **Rep assignments / status / notes**: the local `Assignments` tab in the app spreadsheet
- **Tier 1 / Tier 2 K-12 mapping**: the local `K12_TierMap` tab in the app spreadsheet

This keeps the NCES-style district source sheet read-only while still allowing shared rep updates.

## Files in this package

- `Code.gs`
- `Index.html`
- `appsscript.json`
- `HigherEd_Seed.csv`
- `K12_TierMap.csv`
- `Assignments_Seed.csv`

## Setup

### 1) Create the app spreadsheet
Create a new Google Sheet that will hold:
- `Assignments`
- `HigherEd`
- `K12_TierMap`

### 2) Import the two seed CSVs
Import:
- `HigherEd_Seed.csv` into a sheet named **HigherEd**
- `K12_TierMap.csv` into a sheet named **K12_TierMap**

Create a blank sheet named **Assignments**, then paste the `Assignments_Seed.csv` header row into it.

### 3) Create the Apps Script project
In the app spreadsheet:
- Extensions → Apps Script
- Replace the default files with:
  - `Code.gs`
  - `Index.html`
  - `appsscript.json`

### 4) Run initial configuration
In Apps Script, run:

```javascript
setConfig('YOUR_APP_SPREADSHEET_ID');
```

That will:
- store the app spreadsheet ID
- keep the K-12 source spreadsheet ID already preloaded
- create any missing tabs if needed

### 5) Authorize
The first run will ask for permission because the script:
- reads the external K-12 source sheet
- reads/writes the local app spreadsheet

### 6) Deploy as Web App
- Deploy → New deployment
- Type: **Web app**
- Execute as: **Me**
- Who has access: **Anyone in your organization** (or tighter if preferred)

## How the dashboard works

### All K-12
- Shows all K-12 district rows from the source sheet with **Locale 11–43**
- Tier buttons still work:
  - **Tier 1** and **Tier 2** come from the `K12_TierMap` sheet
  - rows not in those mappings show as **All K-12**

### School name click
- Opens a modal card
- Pulls all populated source fields for that school from the source sheet

### Shared saves
These fields save to `Assignments`:
- Assigned Rep
- Status
- Last Contact
- Next Step
- Notes

They are keyed by `externalKey`, so all users see the same updates.

## Notes

- The K-12 source spreadsheet must stay accessible to the account that owns the Apps Script deployment.
- If you later want stronger Tier 1 matching, add a true NCES ID column to the `K12_TierMap` sheet and keep the source sheet’s NCES ID intact.


## Usage note
HubSpot is the official place sales reps should record sales activity. This tool is intended for culled grant prospecting and grant-target research.
