# RUS DLT Prospecting Dashboard

This GitHub Pages package loads:

- live K-12 district rows from the public Google Sheet tab **ELSI Export**
- packaged higher-ed rows from `data/highered_rows.json`
- Tier 1 contact overlays from `data/tier1_contacts.json`

## Optional shared tracker fields

The page includes **Status**, **Assigned To**, and **Notes** columns.

Those fields are designed to load from a public Google Sheet tab named **Prospect Tracker** in the same spreadsheet.

Required tracker headers:

- `externalKey`
- `status`
- `assigned_to`
- `notes`

Use the included `Prospect_Tracker_Template.csv` to create that tab.

This page **reads** tracker values from Google Sheets. It does **not** write changes back from the GitHub page itself.

## Other updates

- default view opens on Tier 1
- page-size slider supports 10–100 rows at a time
- Prev / Next paging controls
- phone and website are shown in the table
- My Call remains local to the browser/device
- guide link is included