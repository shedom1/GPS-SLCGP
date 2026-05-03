# RUS DLT Prospecting Dashboard

This GitHub Pages package loads live K-12 district data from the linked public Google Sheet and combines it with packaged Tier 3 and Tier 4 higher-ed rows.

## Included features
- Brighter, tighter professional dashboard layout
- Tier filters with tier explanations
- Region, state, entity type, locale, and SAIPE filters
- Phone and website shown directly on the table
- Tier 1 superintendent and district personnel contact overlays from uploaded contact files
- Clickable organization name opens a full detail card
- `My Call` checkbox saves locally in the browser for the individual user only
- CSV export and browser Save to PDF

## Deploy
Upload the contents of this folder to the `/RUS-DLT/` folder in your GitHub Pages repo.

Required files:
- `index.html`
- `data/k12_tier_map.json`
- `data/highered_rows.json`
- `data/tier1_contacts.json`
- `.nojekyll`

## Notes
- HubSpot remains the official place for sales reps to log sales activity.
- The `My Call` checkbox is not shared. It stores only in the local browser for the current user.
- The live K-12 source depends on the public Google Sheet and the `ELSI Export` tab name staying the same.


Included in this package:
- `FY2026_DLT_Sales_Ready_Guide.html` — linked from the prospecting dashboard top bar for quick access to the FY2026 USDA DLT sales-ready guide.

- `data/tier1_contacts.json` overlays matched superintendent and other personnel contacts onto Tier 1 districts.
