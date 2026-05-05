# FQHC tracker data folder

This folder is intentionally mostly empty in the GitHub package. The tracker should read same-origin files from this folder so GitHub Pages does not need to fetch HRSA/CMS/USDA files directly from the browser.

Expected files created by `scripts/fetch_fqhc_data.py` or the included GitHub Action:

- `hrsa_sites.csv` — primary HRSA Health Center Service Delivery and Look-Alike Sites source
- `ruca_zip.csv` — normalized ZIP-level RUCA lookup
- `forhp_rural_zips.csv` — normalized HRSA/FORHP rural ZIP lookup
- `cms_enrollments.json` — CMS FQHC enrollment enrichment
- `cms_owners.json` — CMS FQHC ownership enrichment
- `source_manifest.json` — refresh timestamp and row counts

`rep_notes_import_template.csv` is only for rep notes import. It is not a source dataset and should not be used as the HRSA sites upload.
