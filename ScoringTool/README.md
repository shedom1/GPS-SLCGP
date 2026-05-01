# FY2026 RUS DLT Scoring Tool

GitHub Pages-ready static HTML tool for preliminary FY2026 USDA RUS Distance Learning & Telemedicine scoring.

## Files

- `index.html` — high-tech/professional scoring workspace.
- `guide.html` — standalone how-to guide and definitions page, accessible from the homepage/header button.
- `sample_manual_sites.csv` — manual import template with example rows.

## What it does

- Searches K-12 districts and can import the district administrative office as a Hub row plus all school locations from NCES public school and school district characteristics ArcGIS layers. For application-grade review, compare imported rows against the latest NCES CCD directory files.
- Searches higher education institutions from a public colleges/universities ArcGIS feature layer.
- Uses HRSA Health Center Service Delivery and Look-Alike Sites for the Healthcare/Rural Health workflow. The tool defaults to Georgia (`GA`) so the healthcare list stays manageable. Leave the search box blank to load all selected-state HRSA healthcare sites, or type an organization, site, city, county, or address to narrow results. If the browser blocks the live CSV, download the HRSA CSV and import it manually.
- Adds manual locations for district offices, consortium hubs, partner clinics, higher-ed extension sites, libraries, or other custom project locations.
- Enriches sites with 2020 Census place population and 2024 Census SAIPE county poverty rate.
- Calculates provisional D-1 Rurality and D-2 Economic Need scores.
- Allows row-level Hub / End-User / Hub-End-User / Proxy Hub designation.
- Exports CSV/JSON and prints to PDF.

## Healthcare updates in this version

- Georgia is the default state on page load.
- Added a **Load GA Healthcare** quick button.
- HRSA Healthcare search no longer requires a search term; blank search loads the selected-state healthcare site list.
- Healthcare results now include an **Add all returned healthcare sites** action and displays the first 100 records for easier review.
- Added Phone, Website, and ZIP columns to the main worksheet table for healthcare and outreach use.
- Enriched HRSA import mapping for county FIPS, site ID, phone, website, latitude, and longitude fields when available.

## Design updates in this version

- Reworked the page into a more modern, high-tech, professional interface.
- Added a dark gradient hero/header with navigation buttons.
- Added a dedicated `guide.html` page with:
  - Fixed vs Hybrid vs Non-fixed explanations.
  - Hub, End-User, Hub/End-User, and Proxy Hub definitions.
  - Step-by-step workflow.
  - Scoring tables for Rurality and Economic Need.
  - Quality-control checklist and official resource links.
- Added homepage/header buttons linking to the guide, USDA DLT map, and USDA FY2026 resource page.
- Tightened table density further with smaller worksheet font, reduced row padding, sortable headers, draggable column resizing, and added ZIP / phone / website columns for healthcare review.

## Site designation guidance

- Use **Default Site Designation** before importing/searching to add new rows as `End-User`, `Hub/End-User`, `Hub`, or `Proxy Hub`.
- Use the **Designation** column to change each row individually.
- Use the bulk dropdown above the worksheet to apply a designation to all currently included rows.
- Fixed-project scoring averages `End-User` and `Hub/End-User` rows. Pure `Hub` rows are kept in the worksheet but excluded from the score unless the project is non-fixed/hybrid and uses a `Proxy Hub`.

## K-12 district office and manual location workflow

- K-12 search results include three actions: **Add district office + schools**, **Schools only**, and **District office only**.
- District office rows are imported as `K-12 District Office` and default to `Hub`, so they remain visible in the worksheet without accidentally inflating fixed-project scoring.
- The worksheet includes an **Organization / District** column to keep district, institution, or health system names visible next to each site.
- Manual entry is available from both the top search controls and the worksheet toolbar.
- The manual form supports organization/district, phone, website, locale, city population, and SAIPE percent fields.

## Important limitations

USDA DLT Rurality scoring requires verification with the official USDA DLT map for non-rural and contiguous urban-area determinations. This tool cannot replace that official map review. Treat output as a prospecting and pre-application workpaper until verified.

## Deployment

Upload the folder contents to your GitHub Pages repo. Set the Pages root to the folder containing `index.html`, or place all files in the repo root.
