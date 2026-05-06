# FY2026 RUS DLT Scoring + Partner Radius Tool

GitHub Pages-ready static HTML tool for preliminary FY2026 USDA RUS Distance Learning & Telemedicine scoring and source-based partner radius prospecting.

## Files

- `index.html` — Solutionz-branded scoring and partner radius workspace.
- `prospects.html` — complete source-based Prospect Finder for state/county/city screening.
- `match.html` — RUS DLT Match Calculator view for grant/match scenario planning.
- `guide.html` — standalone how-to guide and definitions page, accessible from the homepage/header button.
- `brand.css` — shared Solutionz-inspired style overrides based on the uploaded brand guide.
- `sample_manual_sites.csv` — manual import template with example rows.

## What it does

- Searches K-12 districts and can import the district administrative office as a Hub row plus all school locations from NCES public school and school district characteristics ArcGIS layers. For application-grade review, compare imported rows against the latest NCES CCD directory files.
- Searches higher education institutions and technical-school style institutions from a public colleges/universities ArcGIS feature layer.
- Builds a 50, 75, or 100 mile partner radius list around a selected anchor site, using official K-12, HRSA healthcare, and higher-ed source records.
- Uses HRSA Health Center Service Delivery and Look-Alike Sites for the Healthcare/Rural Health workflow. The tool defaults to Georgia (`GA`) so the healthcare list stays manageable. Leave the search box blank to load all selected-state HRSA healthcare sites, or type an organization, site, city, county, or address to narrow results. If the browser blocks the live HRSA file, download the official HRSA XLSX and upload it under Import / Templates → Healthcare Lookup Dataset Fallback.
- Adds manual locations for district offices, consortium hubs, partner clinics, higher-ed extension sites, libraries, or other custom project locations.
- Enriches sites with 2020 Census place population and 2024 Census SAIPE county poverty rate.
- Calculates provisional D-1 Rurality and D-2 Economic Need scores.
- Allows row-level Hub / End-User / Hub-End-User / Proxy Hub designation.
- Exports CSV/JSON, exports Partner Radius CSV, and prints to PDF.


## Partner radius updates in this version

- Added a dedicated **50–100 Mile Partner Radius List** section on the homepage.
- Workflow now supports starting with a seed organization:
  - School district
  - Health center / rural health organization
  - Higher-ed institution or technical school
- After adding the seed sites, choose an anchor location and search within 50, 75, or 100 miles for potential partners.
- Partner source options include:
  - K-12 schools from the NCES public school characteristics layer
  - Healthcare sites from the HRSA Health Center Service Delivery and Look-Alike Sites dataset
  - Higher-ed / technical institutions from the colleges and universities feature layer
- Partner results include:
  - Distance from anchor site
  - Organization / site name
  - Address and county
  - 2020 Census place population when available
  - County SAIPE poverty percentage when available
  - D-1 / D-2 preliminary scores
  - Objective-fit flag based on provisional D-1 + D-2 scoring
  - Source-field description
- Added **Export Partner CSV** for outreach/prospecting lists.
- Added **Add Selected to Worksheet** and **Add High-Fit to Worksheet** actions. Partner rows are added as `include=false` by default so they do not affect scoring until reviewed.
- Added a `Description` column to the scoring worksheet and exports. Descriptions are assembled from returned source fields only; the tool does not invent contacts, capabilities, needs, service lines, or eligibility facts.

### Partner radius data integrity rules

The partner finder is intentionally conservative:

1. It only lists records returned by official public source datasets available to the browser.
2. It does not create or infer facts that are not in the source record.
3. It does not assume a partner is willing, eligible, or a good strategic fit just because it appears in the radius.
4. The “High fit” flag is only a preliminary screening label based on available D-1 Rurality and D-2 Economic Need data.
5. Added partner records are excluded from scoring until the user intentionally marks them included and verifies site designation.
6. Rurality must still be checked against the USDA DLT map before final use.

## Healthcare updates in this version

- Georgia is the default state on page load.
- Added a **Load GA Healthcare** quick button.
- The Healthcare button now tries the official HRSA **XLSX** file first instead of relying only on the CSV.
- Added a separate **Healthcare Lookup Dataset Fallback** area under **Import / Templates** for uploading the downloaded HRSA XLSX or CSV when live loading is blocked.
- Separated **Project Site List Import** from **Healthcare Lookup Dataset Fallback** so users know whether they are importing rows to score or loading a lookup dataset.
- HRSA Healthcare search no longer requires a search term; blank search loads the selected-state healthcare site list.
- Healthcare results now include an **Add all returned healthcare sites** action and displays the first 100 records for easier review.
- Added Phone, Website, and ZIP columns to the main worksheet table for healthcare and outreach use.
- Enriched HRSA import mapping for county FIPS, site ID, phone, website, latitude, and longitude fields when available.

### HRSA fallback workflow

1. Click **Download HRSA XLSX** on the scoring page or use: `https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.xlsx`.
2. Open **Import / Templates**.
3. In **Healthcare Lookup Dataset Fallback**, upload the HRSA XLSX.
4. Keep the state filter at `GA` or choose another state.
5. Click **Load HRSA Lookup File**.
6. Add selected healthcare results to the scoring worksheet.

## Design updates in this version

- Reworked the page into a more professional Solutionz-branded interface using Solutionz Blue, Navy, Aqua, white, and clean business typography from the brand guide.
- Added a shared `brand.css` file so the scoring, prospecting, guide, and match pages have a consistent visual system.
- Added a polished hero/header with navigation buttons.
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

## v9 Rurality-place fix
- Added a `Rurality Place/CDP` worksheet column so users can separate the postal city from the Census town/place used for D-1 scoring.
- Added a guardrail for NCES rural locale records, such as Locale 41/42/43, where the postal city population is >20,000. These rows are now marked for D-1 review instead of being automatically scored as 0 unless the DLT map fields are confirmed.
- Example: Huckabay ISD may show a Stephenville postal address in NCES even though the physical community/Census place for DLT review may need to be Huckabay or Census Rural. Verify with the USDA DLT map before final scoring.


## v10 update — Prospect Finder

Added `prospects.html` as a separate view so reps can search by state, optional county, and optional city to find highly eligible K-12, healthcare, and higher-ed/technical prospects. The view screens source records using provisional D-1 Rurality and D-2 Economic Need, supports HRSA XLSX fallback upload, exports a prospect CSV, and can stage selected records for import into the main scoring worksheet as non-included rows. Descriptions are assembled only from source fields; the tool does not invent contacts, service needs, partnerships, or eligibility facts.


## v11 update — Complete Prospect Finder + Match Calculator

- Updated the Prospect Finder so K-12 district searches use the NCES School District Characteristics layer rather than relying only on school-site records. This is intended to support complete district-level prospect lists for state searches such as AK and GA.
- Added `arcgisQueryAll()` pagination so the tool retrieves all matching source records before applying eligibility filters and display limits. The previous workflow could effectively cut off large states by applying the result limit too early.
- Changed the Prospect Finder control from **Max Results** to **Display Limit**. The tool now screens the full source result set, then only limits how many filtered rows are shown.
- Added a separate **K-12 districts** checkbox, checked by default, and made **K-12 school sites** optional.
- Added `match.html`, a third view for Match Calculator planning:
  - How much match do I need?
  - I only have this much match money — what grant amount can it support?
  - I can match at this percentage — is that enough?
  - Where can the applicant look for match money?
- The Match Calculator includes grant-range checks, minimum 15% match calculations, gap/surplus, project total, scenario buttons, and copyable summary output.
