# FQHC Prospect Lookup – GitHub Pages Package

Static, GitHub-ready FQHC lookup tool for sales/prospecting. It provides:

- Table and card views
- Filters for Region, State, RUCA, Rural, Type, Status, and keyword search
- Sort by State, Region, Name, RUCA, Rural, or Next Follow-up
- Official source phone, website, address, site/grantee context
- Local rep notes: contact name, email, assigned rep, status, priority, next follow-up, notes
- Export current filtered view to CSV
- Browser Save to PDF / Print
- Optional upload fallback for sources that block browser fetch from GitHub Pages

## Recommended data-source strategy

Use a combination of sources, not only the CMS All Owners API.

1. **Primary list:** HRSA Health Center Service Delivery and Look-Alike Sites  
   `https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv`

2. **Validation/enrichment:** CMS FQHC Enrollments  
   `https://data.cms.gov/data-api/v1/dataset/4bcae866-3411-439a-b762-90a6187c194b/data`

3. **Ownership lookup:** CMS FQHC All Owners  
   `https://data.cms.gov/data-api/v1/dataset/ed289c89-0bb8-4221-a20a-85776066381b/data`

4. **RUCA:** USDA ERS RUCA ZIP file  
   `https://ers.usda.gov/sites/default/files/_laserfiche/DataFiles/53241/RUCA-codes-2020-zipcode.xlsx?v=32088`

5. **Rural yes/no approximation:** HRSA FORHP Rural ZIP Code Approximation  
   `https://www.hrsa.gov/sites/default/files/hrsa/rural-health/about/rural-zip-code-approximations.xlsx`

## Deployment steps

1. Unzip this folder.
2. Upload all files to a GitHub repository folder such as `/FQHC/`.
3. Confirm GitHub Pages is enabled for the repository.
4. Open: `https://YOURDOMAIN.com/FQHC/` or `https://YOURUSER.github.io/YOURREPO/FQHC/`.
5. Click **Load / Refresh Data**.

## Notes about contact emails

Official FQHC source files usually provide phone number and website, but not a direct sales/prospecting email for each site. This tracker includes a manual verified email field for reps. Use the website/phone field to research the correct contact, then save/export the verified contact email.

## Browser/CORS fallback

Some government file downloads may block browser fetches from GitHub Pages. If that happens:

1. Open the Data Sources dialog.
2. Download the relevant CSV/XLSX source manually.
3. Use the fallback upload controls near the top of the page.

The tool will parse the local file in the browser.

## Rep notes persistence

Rep notes save in browser localStorage. To share or back up notes, use **Export CSV**. To reload notes later, use **Rep Notes CSV Import**.

For multi-rep shared persistence, the next version should add a Google Apps Script web app endpoint connected to a Google Sheet for assigned rep, status, contact, email, notes, and next follow-up.
