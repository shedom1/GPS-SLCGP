const SHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const SHEET_NAME = 'CampaignNotes';
const HEADERS = [
  'Campaign',
  'State',
  'Priority',
  'AssignedTo',
  'Status',
  'LastContactDate',
  'NextFollowUpDate',
  'EmailNotes',
  'CallOutNotes',
  'LastUpdated'
];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'campaignNotes';
  if (action === 'campaignNotes') {
    const campaign = (e && e.parameter && e.parameter.campaign) || 'MT-WA-OK';
    return jsonOutput_(getCampaignNotes_(campaign));
  }
  if (action === 'ping') {
    return jsonOutput_({ ok: true, timestamp: new Date().toISOString() });
  }
  return jsonOutput_({ ok: false, error: 'Unknown action.' });
}

function doPost(e) {
  const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  const action = body.action || '';
  if (action === 'saveCampaignNotes') {
    return jsonOutput_(saveCampaignNotes_(body.payload || []));
  }
  return jsonOutput_({ ok: false, error: 'Unknown action.' });
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  if (!SHEET_ID || SHEET_ID === 'PASTE_GOOGLE_SHEET_ID_HERE') {
    throw new Error('Set SHEET_ID in Code.gs before deploying.');
  }
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  return sheet;
}

function initializeSheet_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    const seed = [
      ['MT-WA-OK','Montana','High','','Open','','','','',''],
      ['MT-WA-OK','Washington','High','','Open','','','','',''],
      ['MT-WA-OK','Oklahoma','Medium','','Open','','','','','']
    ];
    sheet.getRange(2, 1, seed.length, seed[0].length).setValues(seed);
    return;
  }
  const existingHeaders = sheet.getRange(1, 1, 1, Math.max(lastCol, HEADERS.length)).getValues()[0];
  const needsHeaders = HEADERS.some((h, i) => existingHeaders[i] !== h);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function getCampaignNotes_(campaign) {
  initializeSheet_();
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).map(r => rowToObject_(r)).filter(r => r.Campaign === campaign);
  return { rows, updatedAt: new Date().toISOString() };
}

function saveCampaignNotes_(rows) {
  initializeSheet_();
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const existingMap = {};
  for (let i = 1; i < values.length; i++) {
    const campaign = String(values[i][0] || '').trim();
    const state = String(values[i][1] || '').trim();
    if (campaign && state) existingMap[`${campaign}||${state}`] = i + 1;
  }
  rows.forEach(row => {
    const clean = normalizeRow_(row);
    const key = `${clean.Campaign}||${clean.State}`;
    const rowValues = HEADERS.map(h => clean[h] || '');
    if (existingMap[key]) {
      sheet.getRange(existingMap[key], 1, 1, HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
  });
  return getCampaignNotes_('MT-WA-OK');
}

function normalizeRow_(row) {
  return {
    Campaign: String(row.Campaign || 'MT-WA-OK').trim(),
    State: String(row.State || '').trim(),
    Priority: String(row.Priority || 'Medium').trim(),
    AssignedTo: String(row.AssignedTo || '').trim(),
    Status: String(row.Status || 'Open').trim(),
    LastContactDate: normalizeDate_(row.LastContactDate),
    NextFollowUpDate: normalizeDate_(row.NextFollowUpDate),
    EmailNotes: String(row.EmailNotes || '').trim(),
    CallOutNotes: String(row.CallOutNotes || '').trim(),
    LastUpdated: new Date().toISOString()
  };
}

function normalizeDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return text;
}

function rowToObject_(row) {
  const obj = {};
  HEADERS.forEach((header, i) => {
    obj[header] = row[i] === undefined || row[i] === null ? '' : String(row[i]);
  });
  return obj;
}
