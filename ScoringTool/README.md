# FY2026 RUS DLT Scoring Tool

This is a GitHub Pages-ready static HTML tool for preliminary FY2026 USDA RUS Distance Learning & Telemedicine scoring.

## Files
- `index.html` — single-page scoring tool.
- `sample_manual_sites.csv` — manual import template with example rows.

## What it does
- Searches K-12 district school sites from the NCES public school characteristics ArcGIS layer. For application-grade review, compare imported rows against the latest NCES CCD directory files.
- Searches higher education institutions from a public colleges/universities ArcGIS feature layer.
- Attempts to search HRSA Health Center Service Delivery and Look-Alike Sites from the HRSA CSV data source; if the browser blocks the live CSV, download the HRSA CSV and import it manually.
- Enriches sites with 2020 Census place population and 2024 Census SAIPE county poverty rate.
- Calculates provisional D-1 Rurality and D-2 Economic Need scores.
- Exports CSV/JSON and prints to PDF.

## Important limitations
USDA DLT Rurality scoring requires verification with the official USDA DLT map for non-rural and contiguous urban-area determinations. This tool cannot replace that official map review. Treat output as a prospecting and pre-application workpaper until verified.

## Deployment
Upload the folder contents to your GitHub Pages repo. Set the Pages root to the folder containing `index.html` or rename/copy `index.html` to the repo root.
