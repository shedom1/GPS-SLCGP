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
- Builds a 25, 50, 75, or 100 mile partner radius list around a selected anchor site, using official K-12, HRSA healthcare, and higher-ed source records.
- Uses HRSA Health Center Service Delivery and Look-Alike Sites for the Healthcare/Rural Health workflow. The Scoring Tool State / Scope now defaults to `ALL` so users can search by organization/name without knowing the state. Healthcare attempts to load the full HRSA lookup first and then filters locally by state/name/city/county; if browser loading is blocked, use the HRSA fallback upload. If the browser blocks the live HRSA file, download the official HRSA XLSX and upload it under Import / Templates → Healthcare Lookup Dataset Fallback.
- Adds manual locations for district offices, consortium hubs, partner clinics, higher-ed extension sites, libraries, or other custom project locations.
- Enriches sites with 2020 Census place population and 2024 Census SAIPE county poverty rate.
- Calculates provisional D-1 Rurality and D-2 Economic Need scores.
- Allows row-level Hub / End-User / Hub-End-User / Proxy Hub designation.
- Exports CSV/JSON, exports Partner Radius CSV, and prints to PDF.


## Partner radius updates in this version

- Added a dedicated **25–100 Mile Partner Radius List** section on the homepage.
- Workflow now supports starting with a seed organization:
  - School district
  - Health center / rural health organization
  - Higher-ed institution or technical school
- After adding the seed sites, choose an anchor location and search within 25, 50, 75, or 100 miles for potential partners.
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

- The Scoring Tool State / Scope now defaults to **ALL — All states**. Healthcare uses a full-table HRSA source when available and filters locally.
- The Healthcare button now tries the official HRSA **XLSX** file first instead of relying only on the CSV.
- Added a separate **Healthcare Lookup Dataset Fallback** area under **Import / Templates** for uploading the downloaded HRSA XLSX or CSV when live loading is blocked.
- Separated **Project Site List Import** from **Healthcare Lookup Dataset Fallback** so users know whether they are importing rows to score or loading a lookup dataset.
- HRSA Healthcare uses a full-table lookup when available and then applies state/name/city/county filters locally.
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

## v12 Update Notes

- Prospect Finder now includes Phone, Email, and Website columns where those fields are available from the source dataset.
- Prospect Finder snapshot now breaks out displayed counts by prospect type: K-12 Districts, K-12 School Sites, Healthcare / HRSA, and Higher Ed / Technical.
- CSV exports and the scoring worksheet import now preserve Email in addition to Phone and Website.
- Contact fields remain source-based only. If NCES, HRSA, or the higher-ed source does not provide a phone/email/website value, the tool leaves the field blank rather than guessing.

## v13 Update Notes

- Added **Agency / Organization Search** to the Prospect Finder.
  - K-12 Districts search district names.
  - K-12 School Sites search district names and school names.
  - Healthcare / HRSA searches health center organization names and site names.
  - Higher Ed / Technical searches institution and system names.
- Added **Address Search** to the Prospect Finder.
  - Searches source address fields, city, ZIP, and visible address text where available.
- Agency/address filters are source-based and post-filtered again after source retrieval so the tool does not invent or infer entities that are not present in the public source records.

## v14 Update Notes

- Prospect Finder now includes an **ALL — Target score scan** state/scope option.
- Added an **All States by Target Score** button that sets the Prospect Finder to a high-fit, cross-state scan using the current target score settings.
- Increased the Display Limit ceiling to 200,000 for large scans. For best performance, start with K-12 Districts, HRSA Healthcare, and Higher Ed / Technical; add K-12 school sites only when building site-level lists.
- Changed ArcGIS prospect searches to pull broader state/all-state source sets first, then apply county, city, agency, and address filters in the browser. This reduces missed records caused by overly narrow source queries.
- Improved higher-ed/technical school retrieval by querying the Colleges & Universities Feature Layer with state/all-state scope first and then applying the local filters, rather than depending on complex server-side text filtering.
- Added a source link for the Colleges & Universities Feature Layer on the Prospect Finder page.

## v15 Update Notes

- Added a visible working indicator on the Prospect Finder: a clock icon plus spinner now appears while the tool is searching source records and while it is adding Census place population and SAIPE poverty data.
- The status line now shows enrichment progress such as `Adding Census population + SAIPE data... 250 / 1,000` so users know the page is still working.
- Fixed the K-12 school-site query error (`Cannot perform query. Invalid query parameters.`) by simplifying ArcGIS source requests to attribute-only queries and removing geometry/centroid parameters that were not needed for scoring. NCES school latitude/longitude fields are already included in the source attributes.
- Kept K-12 school sites optional because all-state school-building pulls can be very large. For complete district-level prospecting, start with K-12 Districts, HRSA Healthcare, and Higher Ed / Technical.

## v16 Update Notes

- Reordered the Scoring Tool worksheet so the most important scoring fields are at the front of the table:
  - D-1 Rurality
  - D-2 Economic Need
  - 2020 Place Population
  - SAIPE Poverty %
  - D-1 + D-2 Objective Score
- Added **Charter School** as a K-12 prospect/site type.
  - The tool classifies school-site records as Charter School when the NCES source record includes a charter indicator field.
  - Charter rows can be manually added, imported by CSV, or staged from the Prospect Finder.
  - Charter schools are not marked automatically eligible; the guide now explains that eligibility depends on legal applicant/consortium structure, rurality, project design, asset ownership, and required documentation.
- Added a Charter Schools option to the Prospect Finder type filters.
- Added Charter Schools to the Prospect Snapshot type-count breakout.
- Updated the How-to Guide with:
  - Charter school eligibility guardrails.
  - A source-family crosswalk explaining that the Scoring Tool and Prospect Finder use the same source families, but in different workflows.
- Updated the manual site template with a sample Charter School row.

## v17 Update Notes
- Tightened the Scoring Tool start screen and moved the partner-radius workflow into a collapsible section so the scoring worksheet is less cluttered.
- Added **Auto-enrich + score** on add/import. When enabled, newly added rows automatically look up Census 2020 place population and 2024 county SAIPE data, then calculate row-level **D-1 Rurality**, **D-2 Economic Need**, and **D-1 + D-2 Total**.
- Fixed the scoring table refresh order so D-1, D-2, population, SAIPE, and total scores display immediately after lookup/enrichment instead of waiting for another refresh.
- Expanded the Project Site import to accept **CSV, XLSX, and XLS** files.
- Added source-file import detection for NCES/CCD school exports, NCES/CCD district exports, higher-ed/IPEDS exports, HRSA health center files, and manual site templates.
- Added downloadable **NCES Import Notes** from the Import/Templates tab.
- Added a clock/progress message during scoring enrichment so users know the tool is still adding Census population and SAIPE data.

Final D-1 Rurality still requires USDA DLT map verification before relying on the score in an application.

## v18 Update Notes
- Fixed the Scoring Tool K-12/NCES flow so the search starts with the **bundled ELSI/NCES 2025 district CSV** first, then pulls all school sites by LEAID. This avoids the school-layer invalid query parameter problem during the initial district lookup.
- Added an all-fields fallback for ArcGIS queries and paginated NCES requests so larger district/site lists are less likely to be cut off or fail because of a changed source field list.
- Added a visible **# Schools** field to the scoring table, manual entry form, CSV export, and import mappings. The field is populated from the NCES district `SCH` / School Count field when available.
- Improved NCES Excel/CSV import detection by scanning for the best header row instead of assuming the first row is always the header.
- Improved field matching for uploaded files so simple headers like `City`, `County`, `State`, `School Count`, and `# Schools` map more reliably.
- Tightened the Scoring Tool start area text and guardrail callout to reduce screen clutter.

## v19 Update Notes
- Added **# Schools** to the Prospect Finder results table so reps can see the district-level school count directly on the prospecting page.
- Added `schoolCount` to the **Export Prospect CSV** output.
- Updated the Prospect Snapshot type breakout so, when school-count data is available, the K-12 District tile also shows the total schools represented in the displayed prospect set.
- The field remains source-based. It is populated when the NCES district source provides a school count; otherwise it stays blank.


Update v20: K-12 district prospecting/search now uses the bundled ELSI/NCES K-12 School Districts 2025 CSV as the district source, including website and # Schools where available. School-site rows still use the NCES school layer by LEAID when adding all school buildings for a selected district.

## v21 Update Notes
- Moved the **Build Partner Radius List** workflow below the Site Scoring Worksheet table so users can first build/review the scoring worksheet, then run partner discovery from the selected anchor site.
- Expanded the Partner Radius selector to support **25, 50, 75, and 100 miles**.
- Added sortable column headers to the Partner Radius results table. Users can now sort by Fit, Miles, D-1+D-2 Total, Type, Organization, Site, County, 2020 Population, D-1, SAIPE %, D-2, Description, and Source.
- Partner CSV export now follows the active partner-table sort order.

## v22 updates

- Added a lightweight client-side username/password gate to each HTML page. Username: any non-blank name; password: `gpstools`. This is a convenience gate for GitHub Pages, not enterprise-grade security. Use hosting-level authentication for confidential data.
- Replaced Google Maps links with per-record **USDA DLT Map** links. Records with coordinates open the USDA DLT map centered on that location when supported by the ArcGIS viewer.
- Changed Healthcare/HRSA loading to treat the HRSA Health Center Service Delivery and Look-Alike Sites file as a **full-table lookup** first, then apply state/county/city/search filters locally. This reduces incomplete state pulls and supports uploaded HRSA XLSX/CSV fallback as the full healthcare source.
- Added a **Prior RUS DLT Winners Strategy** panel to the Prospect Finder. It can try to discover prior-award/recipient layers from the USDA RUS DLT map, or accept an uploaded prior-awards CSV/XLSX table. Filter by state, county/city, keyword, or find awards near selected prospects.


## v24 Update
- Login now accepts any non-blank username with the shared password `gpstools`.
- Simplified the Prior RUS DLT Winners section and added a Winner Type filter with **Districts only** for prior school-district recipient screening.
- Prior-awards export respects the Districts-only filter and names the export `RUS_DLT_Prior_District_Awards.csv` when that filter is active.


## v25 Update Notes
- Scoring Tool **State / Scope** now defaults to **ALL — All states** so users can search by district, agency, health center, or higher-ed name without knowing the state first.
- K-12 district searches use the bundled ELSI/NCES district file across all states first; school-site fallback searches also support all-state name matching.
- Higher-ed searches now support all-state institution/system-name matching from the colleges/universities source layer.
- Healthcare searches support all-state matching after the HRSA full-table lookup loads or after the HRSA fallback dataset is uploaded.
- Manual Location keeps the State field blank when the scope is ALL, so users enter the actual site state instead of accidentally saving `ALL` as a state value.


## v26 updates

- Restored Target Scoring controls on the Scoring Tool: Target D-1, Target D-2, Target Objective Score, Target Total Score, project target status, and row-level Target Fit.
- Removed the GA-only healthcare shortcut/tip language. HRSA healthcare now treats the uploaded/bundled dataset as a full-table source and filters locally.
- Bundled the uploaded `rus_dlt_all_sites_2026-05-08.csv` file under `/data/` for Prior RUS DLT Winners / award-site strategy.
- Prior RUS DLT Winners now auto-loads the bundled award/site table and has a more compact horizontal action layout.
- HRSA note: if the official HRSA XLSX cannot be fetched from GitHub Pages, it is usually because the HRSA file was not bundled in `/data` or the browser blocked the cross-origin download. Upload the official HRSA XLSX under the Healthcare Lookup Dataset Fallback area to use it as the full healthcare source.

## v27 Update Notes
- Reworked the **Prior RUS DLT Winners** section on the Prospect Finder so it is smaller, tighter, and more functional.
- Replaced the stacked/vertical action buttons with a single horizontal action bar.
- Renamed the actions so their purpose is clear:
  - **Filter Table** applies the state, winner type, county/city, and keyword filters.
  - **Find Near Selected Prospects** finds prior RUS DLT awards near selected prospect rows using coordinates when available, with county/city fallback.
  - **Export Filtered CSV** exports the current prior-winner view.
  - **Reload Bundled Table** reloads the bundled 2026-05-08 all-sites award table.
- Moved replacement award-table upload into an **Advanced** collapsible area so normal users are not distracted by it.
- Added row-click drilldown for prior winners. Clicking any award row opens an awardee card showing:
  - years won,
  - project count,
  - site/sub-recipient location count,
  - total grant and site-dollar breakdown,
  - year-by-year drilldown,
  - project-level cards,
  - all site/sub-recipient location rows with USDA Map links.
- Multiple-year awardees now show as expandable year sections inside the drilldown card.
- Drilldown values remain source-based only. The tool does not infer missing grant amounts, sub-recipients, or project descriptions.


## v28 updates

- Moved **Prior RUS DLT Winners** out of the Prospect Finder and into its own `awards.html` view.
- Added the uploaded **RUS DLT Past Award Winners 2012-2025** workbook as a bundled CSV source under `/data/`.
- Prior Winners cards now combine award-level descriptions with site/sub-recipient rows from the bundled RUS DLT all-sites table where project IDs match.
- Added DL/TM award type display in the Prior Winners table and card drilldowns.
- Awardee cards now show multiple winning years as expandable sections.
- Collapsed the Prospect Finder guardrail / charter school / all-states scan notes so the page is less cluttered.

## v29 updates

- Reworked the Prior Winners view to use a single normalized district-awards source file: `data/RUS_DLT_Prior_District_Awards.csv`.
- Removed the two-source Prior Winners calculation that was causing duplicate project/award totals.
- Built the normalized district-awards file from the prior district/site table and merged available project descriptions from the uploaded `RUS DLT Past Award Winners 2012-2025.xlsx` workbook.
- Added available pre-2017 workbook rows to the normalized table. The uploaded workbook data sheet contains FY2016–FY2025 records; FY2016 rows were added where district-related and no site-level map rows were available.
- Prior Winners drilldown cards now show DL/TM type, year-by-year project cards, descriptions, site/sub-recipient rows, USDA Map links, and calculated totals.
- Added an Include in totals checkbox on each project card so a card can be deselected from the drilldown calculations without hiding the source row.


## v30 updates
- Removed the Solutionz/brand icon wordmark from page headers.
- Condensed the Prior Winners page: smaller title, reduced header height, tighter filter cards, smaller tables, compact drilldown cards, and horizontal action buttons.
- Removed the explanatory source paragraph from the Prior Winners header/filter area.
