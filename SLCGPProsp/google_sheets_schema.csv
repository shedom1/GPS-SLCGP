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
const SPREADSHEET_ID = 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE';

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const eventType = data.eventType || 'unknown';
    if (eventType === 'login') {
      appendRow_(ss, 'Login_Log',
        ['timestamp','user','status','page','userAgent'],
        [data.timestamp, data.user || data.attemptedUser, data.status, data.page, data.userAgent]
      );
    } else if (eventType === 'prospect_note') {
      appendRow_(ss, 'Prospect_Activity',
        ['timestamp','updatedBy','state','prospectId','prospectName','county','status','assignedTo','priority','nextFollowup','registeredVendor','vendorRegistrationDate','stateBuyingVehicle','stateBuyingVehicleName','stateBuyingVehicleStatus','contactName','contactTitle','contactEmail','contactPhone','notes','page'],
        [data.timestamp, data.updatedBy, data.state, data.prospectId, data.prospectName, data.county, data.status, data.assignedTo, data.priority, data.nextFollowup, boolText_(data.registeredVendor), data.vendorRegistrationDate, boolText_(data.stateBuyingVehicle), data.stateBuyingVehicleName, data.stateBuyingVehicleStatus, data.contactName, data.contactTitle, data.contactEmail, data.contactPhone, data.notes, data.page]
      );
    } else {
      appendRow_(ss, 'Event_Log', ['timestamp','eventType','user','page','payload'], [data.timestamp, eventType, data.user, data.page, JSON.stringify(data)]);
    }
    return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(err)})).setMimeType(ContentService.MimeType.JSON);
  }
}
function doGet(){return ContentService.createTextOutput(JSON.stringify({ok:true, app:'SLCGP Prospecting Tool'})).setMimeType(ContentService.MimeType.JSON)}
function boolText_(value){ return value === true || value === 'true' ? 'Yes' : 'No'; }
function appendRow_(ss, sheetName, headers, row) {
  let sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.appendRow(headers);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else {
    ensureHeaders_(sh, headers);
  }
  const headerMap = getHeaderMap_(sh);
  const aligned = headers.map((h, i) => row[i]);
  // Append exactly in current header order so existing sheets remain usable after new fields are added.
  const out = Array(sh.getLastColumn()).fill('');
  headers.forEach((h, i) => { if (headerMap[h]) out[headerMap[h]-1] = aligned[i]; });
  sh.appendRow(out);
}
function ensureHeaders_(sh, headers) {
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
    return;
  }
  const existing = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].filter(String);
  const missing = headers.filter(h => existing.indexOf(h) === -1);
  if (missing.length) {
    sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    sh.getRange(1,1,1,existing.length + missing.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
}
function getHeaderMap_(sh) {
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  return headers.reduce((m,h,i)=>{ if(h) m[h]=i+1; return m; }, {});
}
