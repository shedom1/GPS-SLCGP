const SHEET_NAME = 'Login Log';

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet_(ss);

    sheet.appendRow([
      new Date(),
      payload.name || '',
      payload.action || '',
      payload.reason || '',
      payload.page || '',
      payload.userAgent || '',
      payload.timestamp || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Server Timestamp',
      'Name',
      'Action',
      'Reason',
      'Page URL',
      'User Agent',
      'Client Timestamp'
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
