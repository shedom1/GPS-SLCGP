window.FQHC_TRACKER_CONFIG = {
  refreshLabel: 'Official-source refresh target: live on load',
  sourceUrls: {
    hrsaSitesCsv: 'https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv',
    cmsEnrollmentsApi: 'https://data.cms.gov/data-api/v1/dataset/4bcae866-3411-439a-b762-90a6187c194b/data',
    cmsOwnersApi: 'https://data.cms.gov/data-api/v1/dataset/ed289c89-0bb8-4221-a20a-85776066381b/data',
    usdaRucaZipXlsx: 'https://ers.usda.gov/sites/default/files/_laserfiche/DataFiles/53241/RUCA-codes-2020-zipcode.xlsx?v=32088',
    hrsaForhpZipXlsx: 'https://www.hrsa.gov/sites/default/files/hrsa/rural-health/about/rural-zip-code-approximations.xlsx'
  },
  // Sherri's current sales regions. Adjust here if your region assignments change.
  regions: {
    'Mid-Atlantic': ['KY','MD','TN','VA','WV'],
    'Northeast': ['CT','DE','IL','IN','IA','KS','ME','MA','MI','MN','MO','NE','NH','NJ','NY','ND','OH','PA','RI','SD','VT','WI'],
    'Southeast': ['AL','AR','FL','GA','LA','MS','NC','SC'],
    'West': ['AK','AZ','CA','CO','HI','ID','MT','NV','NM','OK','OR','TX','UT','WA','WY']
  },
  statusOptions: ['New','Researching','Called','Emailed','Meeting Set','Not a Fit','Follow Up','Do Not Contact']
};
