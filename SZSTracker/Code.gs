const SHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const SHEET_NAME = 'StateSecurityTracker';

const HEADERS = [
  'State',
  'Region',
  'Buying Contract Status',
  'Buying Contract Name',
  'Follow-Up Date',
  'Assigned To',
  'Cybersecurity Committee Member',
  'Date Joined',
  'Registered Vendor',
  'Date Registered',
  'Registered for Updates Email',
  'Updates Email Address',
  'Notes',
  'Last Updated'
];

const STATE_REGION_MAP = {
  'Alabama':'Southeast','Alaska':'West','Arizona':'West','Arkansas':'Southeast',
  'California':'West','Colorado':'West','Connecticut':'Northeast','Delaware':'Northeast',
  'Florida':'Southeast','Georgia':'Southeast','Hawaii':'West','Idaho':'West',
  'Illinois':'Northeast','Indiana':'Northeast','Iowa':'Northeast','Kansas':'Northeast',
  'Kentucky':'Mid-Atlantic','Louisiana':'Southeast','Maine':'Northeast','Maryland':'Mid-Atlantic',
  'Massachusetts':'Northeast','Michigan':'Northeast','Minnesota':'Northeast','Mississippi':'Southeast',
  'Missouri':'Northeast','Montana':'West','Nebraska':'Northeast','Nevada':'West',
  'New Hampshire':'Northeast','New Jersey':'Northeast','New Mexico':'West','New York':'Northeast',
  'North Carolina':'Southeast','North Dakota':'Northeast','Ohio':'Northeast','Oklahoma':'West',
  'Oregon':'West','Pennsylvania':'Northeast','Rhode Island':'Northeast','South Carolina':'Southeast',
  'South Dakota':'Northeast','Tennessee':'Mid-Atlantic','Texas':'West','Utah':'West',
  'Vermont':'Northeast','Virginia':'Mid-Atlantic','Washington':'West','West Virginia':'Mid-Atlantic',
  'Wisconsin':'Northeast','Wyoming':'West'
};

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'bootstrap';
  if (action === 'bootstrap') {
    return jsonOutput_(getBootstrapData_());
  }
  if (action === 'ping') {
    return jsonOutput_({ ok: true, timestamp: new Date().toISOString() });
  }
  return jsonOutput_({ ok: false, error: 'Unknown action.' });
}

function doPost(e) {
  const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  const action = body.action || '';
  const payload = body.payload;

  if (action === 'saveRows') {
    return jsonOutput_(saveRows_(payload || []));
  }

  return jsonOutput_({ ok: false, error: 'Unknown action.' });
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getBootstrapData_() {
  initializeSheet_();
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return { rows: [], assignees: [], updatedAt: new Date().toISOString() };
  }

  const rows = values.slice(1).map((row) => rowToObject_(row));
  const assignees = [...new Set(rows.map(r => (r['Assigned To'] || '').trim()).filter(Boolean))].sort();

  return {
    rows,
    assignees,
    updatedAt: new Date().toISOString()
  };
}

function saveRows_(rows) {
  initializeSheet_();
  const sheet = getSheet_();
  const existing = sheet.getDataRange().getValues();
  const headerRow = existing[0];
  const stateIndex = headerRow.indexOf('State');
  const existingMap = {};

  for (let i = 1; i < existing.length; i++) {
    const state = String(existing[i][stateIndex] || '').trim();
    if (state) existingMap[state] = i + 1;
  }

  rows.forEach((rowObj) => {
    const clean = normalizeRow_(rowObj);
    const rowValues = HEADERS.map(h => clean[h] || '');
    const rowNumber = existingMap[clean['State']];
    if (rowNumber) {
      sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
  });

  return getBootstrapData_();
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
    seedStates_(sheet);
    formatSheet_(sheet);
    return;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, Math.max(lastCol, HEADERS.length)).getValues()[0];
  const needsHeaders = HEADERS.some((h, i) => existingHeaders[i] !== h);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  addMissingStates_(sheet);
  formatSheet_(sheet);
}

function seedStates_(sheet) {
  const rows = Object.keys(STATE_REGION_MAP).sort().map((state) => {
    return normalizeRow_({
      'State': state,
      'Region': STATE_REGION_MAP[state],
      'Buying Contract Status': 'No',
      'Buying Contract Name': '',
      'Follow-Up Date': '',
      'Assigned To': '',
      'Cybersecurity Committee Member': false,
      'Date Joined': '',
      'Registered Vendor': false,
      'Date Registered': '',
      'Registered for Updates Email': false,
      'Updates Email Address': '',
      'Notes': '',
      'Last Updated': ''
    });
  }).map(obj => HEADERS.map(h => obj[h] || ''));

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
  }
}

function addMissingStates_(sheet) {
  const data = sheet.getDataRange().getValues();
  const existing = new Set(data.slice(1).map(r => String(r[0] || '').trim()).filter(Boolean));
  const missing = Object.keys(STATE_REGION_MAP).sort().filter(state => !existing.has(state));

  if (!missing.length) return;

  const rows = missing.map((state) => {
    const obj = normalizeRow_({
      'State': state,
      'Region': STATE_REGION_MAP[state],
      'Buying Contract Status': 'No',
      'Buying Contract Name': '',
      'Follow-Up Date': '',
      'Assigned To': '',
      'Cybersecurity Committee Member': false,
      'Date Joined': '',
      'Registered Vendor': false,
      'Date Registered': '',
      'Registered for Updates Email': false,
      'Updates Email Address': '',
      'Notes': '',
      'Last Updated': ''
    });
    return HEADERS.map(h => obj[h] || '');
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
}

function normalizeRow_(rowObj) {
  const state = String(rowObj['State'] || '').trim();
  return {
    'State': state,
    'Region': STATE_REGION_MAP[state] || String(rowObj['Region'] || '').trim(),
    'Buying Contract Status': normalizeStatus_(rowObj['Buying Contract Status']),
    'Buying Contract Name': String(rowObj['Buying Contract Name'] || '').trim(),
    'Follow-Up Date': normalizeDate_(rowObj['Follow-Up Date']),
    'Assigned To': String(rowObj['Assigned To'] || '').trim(),
    'Cybersecurity Committee Member': normalizeBoolean_(rowObj['Cybersecurity Committee Member']),
    'Date Joined': normalizeDate_(rowObj['Date Joined']),
    'Registered Vendor': normalizeBoolean_(rowObj['Registered Vendor']),
    'Date Registered': normalizeDate_(rowObj['Date Registered']),
    'Registered for Updates Email': normalizeBoolean_(rowObj['Registered for Updates Email']),
    'Updates Email Address': String(rowObj['Updates Email Address'] || '').trim(),
    'Notes': String(rowObj['Notes'] || '').trim(),
    'Last Updated': new Date().toISOString()
  };
}

function normalizeStatus_(value) {
  const allowed = ['Yes', 'No', 'In Progress'];
  const v = String(value || '').trim();
  return allowed.includes(v) ? v : 'No';
}

function normalizeBoolean_(value) {
  return value === true || value === 'TRUE' || value === 'true' || value === 'Yes' || value === 1;
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
    const v = row[i];
    if (header === 'Cybersecurity Committee Member' || header === 'Registered Vendor' || header === 'Registered for Updates Email') {
      obj[header] = normalizeBoolean_(v);
    } else if (header === 'Follow-Up Date' || header === 'Date Joined' || header === 'Date Registered') {
      obj[header] = normalizeDate_(v);
    } else {
      obj[header] = v === undefined || v === null ? '' : String(v);
    }
  });
  return obj;
}

function formatSheet_(sheet) {
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, Math.min(HEADERS.length, 10));
}
