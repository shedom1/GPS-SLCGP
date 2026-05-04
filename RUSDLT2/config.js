/*
  RUS DLT 2026 Tiered Callout Tracker
  1) Deploy apps_script/Code.gs as a Google Apps Script Web App.
  2) Paste the Web App URL below.
  3) Leave SOURCE_SHEET_URL as-is unless you move the source workbook.
*/
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbx27GBs2b6pwoXDm9KJxyXodJKW_qh7Xn-gd6cQZSCS0nqPLGwD8CkI6RLkcS5HW1SH/exec",
  API_TOKEN: "", // Optional: must match CONFIG.API_TOKEN in Code.gs if you enable it there.
  SOURCE_SHEET_URL: "https://docs.google.com/spreadsheets/d/1eDW0C7vnnfT7dOjQIk-EHAWeFNdI2iYeiXxH6uy3hfY/edit?usp=sharing",
  DEFAULT_KEY_STATES_ONLY: true,
  DEFAULT_LIMIT: 100,
  BRAND_NAME: "Solutionz GPS",
  APP_TITLE: "RUS DLT 2026 Tiered Callout Tracker"
};
