# My Funding Tracker - GitHub Ready Package

Included files:
- index.html
- management_v2.html
- Code.gs
- README.md

Configured deployment in homepage:
- https://script.google.com/macros/s/AKfycbyh-DaenTmARHaC9fQeJ-RPP4Y_jbHDStv2JtrbrLqZr-sVnYJpKhZTWBzONDfXGYD8SA/exec

Configured management sheet:
- https://docs.google.com/spreadsheets/d/1N4BR14dEJp9QpbGFbuuyCBa8eZoOrc0t5CIYvFeNt7U/edit?usp=sharing

Important fix in this package:
- Corrected the Apps Script configuration check in the homepage so login/logout events will actually post to the web app.

Deployment:
1. Upload `index.html` and `management_v2.html` to the root of your GitHub Pages site.
2. Keep your existing tracker folders in place.
3. Confirm the Apps Script deployment URL above is the active web app tied to your Google Sheet.
4. Test by logging in and then check the `Login Log` tab in the Google Sheet.
