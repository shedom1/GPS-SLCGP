/**
 * SLCGP Prospecting Tool - Google Apps Script logging endpoint
 * 1) Create a Google Sheet.
 * 2) Extensions > Apps Script > replace Code.gs with this file.
 * 3) Paste the Sheet ID below.
 * 4) Deploy > New deployment > Web app.
 *    Execute as: Me
 *    Who has access: Anyone with the link (or your Workspace domain)
 * 5) Copy the Web App URL into config.js as LOG_WEB_APP_URL.
 */
const SPREADSHEET_ID = '1rHMcqBnf2LqdHGYTsBHM0PItc7NcIEhHuTE1fxRtxk0';

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const eventType = data.eventType || 'unknown';
    if (eventType === 'login') appendRow_(ss, 'Login_Log', ['timestamp','user','status','page','userAgent'], [data.timestamp, data.user || data.attemptedUser, data.status, data.page, data.userAgent]);
    else if (eventType === 'prospect_note') appendRow_(ss, 'Prospect_Activity', ['timestamp','updatedBy','state','prospectId','prospectName','county','status','assignedTo','priority','nextFollowup','notes','page'], [data.timestamp, data.updatedBy, data.state, data.prospectId, data.prospectName, data.county, data.status, data.assignedTo, data.priority, data.nextFollowup, data.notes, data.page]);
    else appendRow_(ss, 'Event_Log', ['timestamp','eventType','user','page','payload'], [data.timestamp, eventType, data.user, data.page, JSON.stringify(data)]);
    return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(err)})).setMimeType(ContentService.MimeType.JSON);
  }
}
function doGet(){return ContentService.createTextOutput(JSON.stringify({ok:true, app:'SLCGP Prospecting Tool'})).setMimeType(ContentService.MimeType.JSON)}
function appendRow_(ss, sheetName, headers, row) {
  let sh = ss.getSheetByName(sheetName);
  if (!sh) { sh = ss.insertSheet(sheetName); sh.appendRow(headers); sh.getRange(1,1,1,headers.length).setFontWeight('bold'); sh.setFrozenRows(1); }
  sh.appendRow(row);
}
