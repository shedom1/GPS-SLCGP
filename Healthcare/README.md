# FQHC Prospect Lookup Tracker

Clean static GitHub Pages tracker for FQHC / Health Center prospecting. It supports Table and Card views, State/Region/Name/RUCA/Rural filtering, multi-select RUCA codes, source-status visibility, CSV export, print-to-PDF, and rep notes.

## Important fix in this version

This version does **not** rely on browser JavaScript fetching HRSA/CMS/USDA files directly from other domains. Those browser fetches often fail because of CORS, redirects, MIME headers, or large file download behavior.

Instead, the tracker loads same-origin files from `/data/`:

- `data/hrsa_sites.csv`
- `data/ruca_zip.csv`
- `data/forhp_rural_zips.csv`
- `data/cms_enrollments.json`
- `data/cms_owners.json`
- `data/source_manifest.json`

The included GitHub Action or Python script creates those files.

## What each file does

- `index.html` — main tracker
- `config.js` — data paths, official URLs, region assignments, status options
- `assets/app.js` — filter/sort/render/export/note logic
- `assets/styles.css` — professional compact styling
- `scripts/fetch_fqhc_data.py` — server-side refresh script
- `.github/workflows/refresh-fqhc-data.yml` — scheduled/manual data refresh workflow
- `data/rep_notes_import_template.csv` — header-only import template for rep notes

## Deployment steps

1. Unzip the folder.
2. Upload the full `fqhc_prospect_tracker` folder contents to your GitHub repository.
3. In GitHub, go to **Actions**.
4. Open **Refresh FQHC Tracker Data**.
5. Click **Run workflow**.
6. Wait for the action to commit `/data/` files.
7. Open the GitHub Pages URL and click **Load Data**.

## Local refresh option

From the project folder:

```bash
pip install -r requirements.txt
python scripts/fetch_fqhc_data.py
```

Then open `index.html` locally or publish to GitHub Pages.

## RUCA multi-select

RUCA filter is now a checkbox multi-select:

- 1-3 = metropolitan
- 4-6 = micropolitan
- 7-9 = small town
- 10 = rural
- 99 = not coded
- Unknown = no RUCA match loaded

No RUCA checkbox selected = include all RUCA codes.

## Rep notes

Open a site detail record to enter:

- Contact Name
- Contact Email
- Assigned To
- Status
- Priority
- Next Follow-up
- Notes

Notes are saved in the browser's local storage. Use **Export CSV** to preserve or share. To re-import notes later, use `data/rep_notes_import_template.csv` as the format.

## Why the sample row was confusing

The prior package included a sample note row like:

`GA,30000,Example Health Center...`

That row was only meant to demonstrate the notes import format. It has been removed. The new template is header-only so it cannot be mistaken for the FQHC source dataset.

## Email contacts

Official FQHC/health center source files usually provide phone, website, address, site/organization fields, and sometimes source emails depending on the dataset. They generally do not provide direct prospecting contacts. Use the detail modal to add verified contact names and emails found by the rep.

## Data source strategy

Best setup:

1. HRSA Health Center Service Delivery and Look-Alike Sites as the primary site list.
2. USDA RUCA ZIP and HRSA FORHP rural ZIP approximation for rural filters.
3. CMS FQHC Enrollments and CMS FQHC All Owners for Medicare enrollment/ownership enrichment.
4. Rep-owned notes/contact fields for verified outreach intelligence.
