/**
 * RUS DLT 2026 Tiered Callout Tracker Backend
 * Deploy as Google Apps Script Web App.
 * Execute as: Me
 * Access: Anyone with the link, or your Workspace domain if using an internal site.
 */

var CONFIG = {
  SOURCE_SPREADSHEET_ID: '1eDW0C7vnnfT7dOjQIk-EHAWeFNdI2iYeiXxH6uy3hfY',
  TRACKER_SPREADSHEET_ID: '', // Blank = active spreadsheet. Set a separate tracking workbook ID if preferred.
  API_TOKEN: '', // Optional. If set, config.js must use the same API_TOKEN.
  HRSA_XLSX_URL: 'https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.xlsx',
  MAX_LIMIT: 500,
  DEFAULT_LIMIT: 100,
  SOURCE_SHEETS: {
    tier1: 'T1:Very Rural and >30% Saipe',
    tier2: 'T2: K-12 Rural Remote SAIPE Unknown',
    tier3: 'T3:Higher Ed Search for Rural',
    tier4: 'T4: Higher Ed-Rural Outreach',
    allk12: 'All K-12',
    hrsa: 'SITE_FQHC_FQHC_LAL_DD_VX'
  },
  KEY_STATES: [
    'Mississippi','Illinois','North Carolina','Alaska','Ohio','Oregon','Idaho','Arizona',
    'South Dakota','Florida','Nebraska','Arkansas','New Mexico','Wisconsin','Iowa','Nevada',
    'Utah','Indiana','Montana','North Dakota','New Hampshire','Wyoming','Massachusetts','Hawaii'
  ],
  ACTIVITY_HEADERS: [
    'record_id','entity_key','tier_key','source_sheet','row_number','entity_name','state','county','city','zip',
    'assigned_to','status','priority','next_follow_up','last_contact_date',
    'superintendent_name','superintendent_email','other_contact_name','other_contact_title','other_contact_email','other_contact_phone',
    'contact_source','notes','contact_data_updated','updated_by','updated_at','created_at'
  ],
  LOG_HEADERS: ['timestamp','action','record_id','entity_name','state','assigned_to','status','updated_by','summary']
};

var STATE_ABBR = {
  'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA','colorado':'CO','connecticut':'CT','delaware':'DE','district of columbia':'DC','florida':'FL','georgia':'GA','hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK','oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT','virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY'
};
var STATE_NAME = Object.keys(STATE_ABBR).reduce(function(acc, key) { acc[STATE_ABBR[key]] = titleCase_(key); return acc; }, {});

function doGet(e) {
  return safeResponse_(e, function() {
    validateToken_(e);
    var action = (e.parameter.action || 'list').toString();
    if (action === 'list') return listProspects_(e.parameter);
    if (action === 'dashboard') return dashboard_(e.parameter);
    if (action === 'hrsaLookup') return hrsaLookup_(e.parameter);
    if (action === 'config') return getPublicConfig_();
    if (action === 'ping') return { ok: true, timestamp: new Date().toISOString() };
    if (action === 'saveActivity') return saveActivity_(parsePayload_(e.parameter)); // JSONP fallback for short notes.
    throw new Error('Unknown action: ' + action);
  });
}

function doPost(e) {
  return safeResponse_(e, function() {
    validateToken_(e);
    var action = (e.parameter.action || 'saveActivity').toString();
    if (action === 'saveActivity') return saveActivity_(parsePayload_(e.parameter));
    throw new Error('Unknown POST action: ' + action);
  });
}

function setupTrackerWorkbook() {
  var ss = getTrackerSs_();
  ensureSheet_(ss, 'Rep Activity', CONFIG.ACTIVITY_HEADERS);
  ensureSheet_(ss, 'Activity Log', CONFIG.LOG_HEADERS);
  ensureSheet_(ss, 'Users', ['rep_name','email','region','role','active','notes']);
  ensureSheet_(ss, 'Settings', ['setting','value','notes']);
  seedSettings_(ss);
  SpreadsheetApp.getUi().alert('Tracker setup complete. Created/verified Rep Activity, Activity Log, Users, and Settings tabs.');
}

/**
 * Optional HRSA refresh helper.
 * The source workbook already contains SITE_FQHC_FQHC_LAL_DD_VX, so this is not required.
 * To use it, enable Advanced Google Services > Drive API in Apps Script, and enable Drive API in the linked Cloud project.
 */
function refreshHrsaLookupFromXlsx() {
  if (typeof Drive === 'undefined' || !Drive.Files) {
    throw new Error('Enable Advanced Google Services > Drive API before running refreshHrsaLookupFromXlsx().');
  }
  var blob = UrlFetchApp.fetch(CONFIG.HRSA_XLSX_URL, { muteHttpExceptions: true }).getBlob().setName('HRSA_Health_Center_Service_Delivery_and_LookAlike_Sites.xlsx');
  var tempFile = Drive.Files.insert({ title: 'TEMP HRSA Lookup ' + new Date().toISOString(), mimeType: MimeType.GOOGLE_SHEETS }, blob, { convert: true });
  try {
    var tempSs = SpreadsheetApp.openById(tempFile.id);
    var tempSheet = tempSs.getSheets()[0];
    var values = tempSheet.getDataRange().getValues();
    var targetSs = getSourceSs_();
    var target = getSheetByNameLoose_(targetSs, CONFIG.SOURCE_SHEETS.hrsa) || targetSs.insertSheet(CONFIG.SOURCE_SHEETS.hrsa);
    target.clearContents();
    writeValuesInChunks_(target, values, 1, 1);
    target.autoResizeColumns(1, Math.min(values[0].length, 20));
    return { ok: true, rows: Math.max(values.length - 1, 0), refreshed_at: new Date().toISOString() };
  } finally {
    Drive.Files.trash(tempFile.id);
  }
}

function getPublicConfig_() {
  return {
    ok: true,
    source_spreadsheet_id: CONFIG.SOURCE_SPREADSHEET_ID,
    source_sheets: CONFIG.SOURCE_SHEETS,
    key_states: CONFIG.KEY_STATES,
    max_limit: CONFIG.MAX_LIMIT
  };
}

function listProspects_(params) {
  var tier = params.tier || 'tier1';
  if (tier === 'hrsa') return hrsaLookup_(params);
  var sheetName = CONFIG.SOURCE_SHEETS[tier];
  if (!sheetName) throw new Error('No source sheet configured for tier: ' + tier);
  var sourceSs = getSourceSs_();
  var sheet = getSheetByNameLoose_(sourceSs, sheetName);
  if (!sheet) throw new Error('Source tab not found: ' + sheetName);

  var read = readSheetObjects_(sheet);
  var activityMap = getActivityMap_();
  var limit = Math.min(Number(params.limit || CONFIG.DEFAULT_LIMIT), CONFIG.MAX_LIMIT);
  var offset = Math.max(Number(params.offset || 0), 0);
  var stateFilter = normalizeStateParam_(params.state || '');
  var query = norm_(params.q || '');
  var status = norm_(params.status || '');
  var assigned = norm_(params.assigned || '');
  var keyStatesOnly = String(params.keyStatesOnly || '0') === '1';
  var ruralOnly = String(params.ruralOnly || '0') === '1';
  var localeFilter = parseLocaleFilter_(params.locale || '');

  var rows = [];
  var totalMatched = 0;
  for (var i = 0; i < read.rows.length; i++) {
    var rec = normalizeProspectRecord_(tier, sheetName, read.headers, read.rows[i].values, read.rows[i].rowNumber);
    if (!rec.name && !rec.state && !rec.state_abbr) continue;
    mergeActivity_(rec, activityMap);

    if (keyStatesOnly && !isKeyState_(rec.state_abbr || rec.state)) continue;
    if (stateFilter && normalizeStateParam_(rec.state_abbr || rec.state) !== stateFilter) continue;
    if (status && norm_(rec.activity.status || 'Not Started') !== status) continue;
    if (assigned && norm_(rec.activity.assigned_to || '').indexOf(assigned) === -1) continue;
    if (ruralOnly && !localeIn_(rec.locale, [41,42,43])) continue;
    if (localeFilter.length && !localeIn_(rec.locale, localeFilter)) continue;
    if (query && !recordSearchBlob_(rec).match(query)) continue;

    totalMatched++;
    if (totalMatched > offset && rows.length < limit) rows.push(rec);
  }

  return { ok: true, tier: tier, source_sheet: sheetName, rows: rows, totalMatched: totalMatched, limit: limit, offset: offset, generated_at: new Date().toISOString() };
}


function dashboard_(params) {
  var tier = params.tier || 'tier1';
  if (tier === 'hrsa') return { ok: true, tier: tier, kpis: {}, byAssigned: [], byState: [], byStatus: [], byFollowUp: [], byPriority: [], generated_at: new Date().toISOString() };
  var sheetName = CONFIG.SOURCE_SHEETS[tier];
  if (!sheetName) throw new Error('No source sheet configured for tier: ' + tier);
  var sourceSs = getSourceSs_();
  var sheet = getSheetByNameLoose_(sourceSs, sheetName);
  if (!sheet) throw new Error('Source tab not found: ' + sheetName);

  var read = readSheetObjects_(sheet);
  var activityMap = getActivityMap_();
  var stateFilter = normalizeStateParam_(params.state || '');
  var query = norm_(params.q || '');
  var statusFilter = norm_(params.status || '');
  var assignedFilter = norm_(params.assigned || '');
  var keyStatesOnly = String(params.keyStatesOnly || '0') === '1';
  var ruralOnly = String(params.ruralOnly || '0') === '1';
  var localeFilter = parseLocaleFilter_(params.locale || '');

  var byAssigned = {}, byState = {}, byStatus = {}, byPriority = {}, byFollowUp = {};
  var kpis = { total: 0, assigned: 0, unassigned: 0, touched: 0, overdue: 0, today: 0, next7: 0, future: 0, no_follow_up: 0 };

  for (var i = 0; i < read.rows.length; i++) {
    var rec = normalizeProspectRecord_(tier, sheetName, read.headers, read.rows[i].values, read.rows[i].rowNumber);
    if (!rec.name && !rec.state && !rec.state_abbr) continue;
    mergeActivity_(rec, activityMap);

    if (keyStatesOnly && !isKeyState_(rec.state_abbr || rec.state)) continue;
    if (stateFilter && normalizeStateParam_(rec.state_abbr || rec.state) !== stateFilter) continue;
    if (statusFilter && norm_(rec.activity.status || 'Not Started') !== statusFilter) continue;
    if (assignedFilter && norm_(rec.activity.assigned_to || '').indexOf(assignedFilter) === -1) continue;
    if (ruralOnly && !localeIn_(rec.locale, [41,42,43])) continue;
    if (localeFilter.length && !localeIn_(rec.locale, localeFilter)) continue;
    if (query && !recordSearchBlob_(rec).match(query)) continue;

    var a = rec.activity || {};
    var assigned = cleanLabel_(a.assigned_to, 'Unassigned');
    var status = cleanLabel_(a.status, 'Not Started');
    var priority = cleanLabel_(a.priority, 'No Priority');
    var st = rec.state_abbr || normalizeStateParam_(rec.state) || 'Unknown';
    var bucket = followUpBucket_(a.next_follow_up);
    var isOpen = ['Not a Fit','Do Not Contact','Submitted to Rep'].indexOf(status) === -1;
    var touched = status !== 'Not Started' || assigned !== 'Unassigned' || Boolean(a.notes || a.last_contact_date || a.updated_at);

    kpis.total++;
    if (assigned === 'Unassigned') kpis.unassigned++; else kpis.assigned++;
    if (touched) kpis.touched++;
    if (bucket.key === 'overdue') kpis.overdue++;
    if (bucket.key === 'today') kpis.today++;
    if (bucket.key === 'next7') kpis.next7++;
    if (bucket.key === 'future') kpis.future++;
    if (bucket.key === 'none') kpis.no_follow_up++;

    incCount_(byState, st);
    incCount_(byStatus, status);
    incCount_(byPriority, priority);
    incCount_(byFollowUp, bucket.label);

    if (!byAssigned[assigned]) byAssigned[assigned] = { label: assigned, total: 0, open: 0, follow_up: 0, high_priority: 0 };
    byAssigned[assigned].total++;
    if (isOpen) byAssigned[assigned].open++;
    if (status === 'Follow Up' || bucket.key === 'overdue' || bucket.key === 'today' || bucket.key === 'next7') byAssigned[assigned].follow_up++;
    if (priority === 'High') byAssigned[assigned].high_priority++;
  }

  return {
    ok: true,
    tier: tier,
    source_sheet: sheetName,
    kpis: kpis,
    byAssigned: sortObjects_(byAssigned, 'total'),
    byState: sortCounts_(byState),
    byStatus: sortCounts_(byStatus),
    byPriority: sortCounts_(byPriority),
    byFollowUp: orderFollowUp_(byFollowUp),
    generated_at: new Date().toISOString()
  };
}

function hrsaLookup_(params) {
  var sourceSs = getSourceSs_();
  var sheet = getSheetByNameLoose_(sourceSs, CONFIG.SOURCE_SHEETS.hrsa);
  if (!sheet) throw new Error('HRSA source tab not found: ' + CONFIG.SOURCE_SHEETS.hrsa);

  var read = readSheetObjects_(sheet);
  var limit = Math.min(Number(params.limit || 50), CONFIG.MAX_LIMIT);
  var stateFilter = normalizeStateParam_(params.state || '');
  var county = norm_(params.county || '');
  var city = norm_(params.city || '');
  var query = norm_(params.q || '');
  var lat = parseNumber_(params.lat);
  var lng = parseNumber_(params.lng);

  var rows = [];
  for (var i = 0; i < read.rows.length; i++) {
    var rec = normalizeHrsaRecord_(read.headers, read.rows[i].values, read.rows[i].rowNumber);
    if (!rec.name && !rec.organization) continue;
    if (stateFilter && normalizeStateParam_(rec.state_abbr || rec.state) !== stateFilter) continue;
    if (county && norm_(rec.county).indexOf(county) === -1 && !query) {
      // Keep city/distance options alive; don't hard drop if lat/lng are provided.
      if (!city && (lat === null || lng === null)) continue;
    }
    if (city && norm_(rec.city).indexOf(city) === -1 && !county && !query) continue;
    if (query && !recordSearchBlob_(rec).match(query)) continue;

    rec._score = 1000;
    if (county && norm_(rec.county).indexOf(county) !== -1) rec._score -= 250;
    if (city && norm_(rec.city).indexOf(city) !== -1) rec._score -= 100;
    if (lat !== null && lng !== null && rec.latitude !== '' && rec.longitude !== '') {
      var d = milesBetween_(lat, lng, Number(rec.latitude), Number(rec.longitude));
      if (isFinite(d)) {
        rec.distance_miles = Math.round(d * 10) / 10;
        rec._score = Math.min(rec._score, rec.distance_miles);
      }
    }
    rows.push(rec);
  }

  rows.sort(function(a, b) { return (a._score || 9999) - (b._score || 9999); });
  rows = rows.slice(0, limit).map(function(r) { delete r._score; return r; });
  return { ok: true, rows: rows, totalMatched: rows.length, limit: limit, generated_at: new Date().toISOString() };
}

function saveActivity_(payload) {
  var ss = getTrackerSs_();
  var sheet = ensureSheet_(ss, 'Rep Activity', CONFIG.ACTIVITY_HEADERS);
  var logSheet = ensureSheet_(ss, 'Activity Log', CONFIG.LOG_HEADERS);
  var headers = getHeaderRow_(sheet);
  addMissingHeaders_(sheet, headers, CONFIG.ACTIVITY_HEADERS);
  headers = getHeaderRow_(sheet);

  var now = new Date();
  payload = payload || {};
  payload.record_id = payload.record_id || makeRecordId_(payload.tier_key || '', payload.entity_key || [payload.entity_name, payload.state, payload.zip].join('|'));
  payload.entity_key = payload.entity_key || payload.record_id;
  payload.updated_at = now.toISOString();
  payload.created_at = payload.created_at || now.toISOString();
  payload.status = payload.status || 'Not Started';

  var rowIndex = findActivityRow_(sheet, headers, payload.record_id, payload.entity_key);
  if (rowIndex > 1) {
    var existing = rowObject_(headers, sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0]);
    payload.created_at = existing.created_at || payload.created_at;
  } else {
    rowIndex = sheet.getLastRow() + 1;
  }

  var values = headers.map(function(h) { return payload[h] !== undefined ? payload[h] : ''; });
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([values]);

  logSheet.appendRow([
    now,
    'saveActivity',
    payload.record_id,
    payload.entity_name || '',
    payload.state || '',
    payload.assigned_to || '',
    payload.status || '',
    payload.updated_by || safeUserEmail_(),
    truncate_((payload.notes || '').toString(), 500)
  ]);

  return { ok: true, record_id: payload.record_id, row: rowIndex, updated_at: payload.updated_at };
}

function getActivityMap_() {
  var ss = getTrackerSs_();
  var sheet = ensureSheet_(ss, 'Rep Activity', CONFIG.ACTIVITY_HEADERS);
  var values = sheet.getDataRange().getValues();
  var map = {};
  if (values.length < 2) return map;
  var headers = values[0].map(String);
  for (var i = 1; i < values.length; i++) {
    var obj = rowObject_(headers, values[i]);
    if (!obj.record_id && !obj.entity_key) continue;
    if (obj.record_id) map[obj.record_id] = obj;
    if (obj.entity_key) map[obj.entity_key] = obj;
  }
  return map;
}

function mergeActivity_(rec, activityMap) {
  var act = activityMap[rec.record_id] || activityMap[rec.entity_key] || {};
  rec.activity = act;
  return rec;
}

function normalizeProspectRecord_(tier, sourceSheet, headers, values, rowNumber) {
  var raw = rowObject_(headers, values);
  var entityId = pick_(raw, ['Agency ID - NCES Assigned', 'Agency ID', 'NCES Assigned', 'NCES ID', 'UnitID', 'UNITID', 'IPEDS', 'Institution ID', 'ID']);
  var name = pick_(raw, ['Agency Name [District]', 'Agency Name', 'District Name', 'Institution Name', 'School Name', 'Organization Name', 'Name']);
  if (!name) name = firstMeaningful_(raw);
  var stateAbbr = pick_(raw, ['State Abbr [District]', 'Location State Abbr', 'State Abbr', 'State Code', 'ST', 'State']);
  var stateName = pick_(raw, ['State Name [District]', 'State Name', 'State']);
  stateAbbr = normalizeStateParam_(stateAbbr) || normalizeStateParam_(stateName);
  stateName = STATE_NAME[stateAbbr] || stateName;
  var city = pick_(raw, ['Location City [District]', 'Location City', 'City', 'Physical City', 'Mailing City']);
  var zip = pick_(raw, ['Location ZIP [District]', 'Location ZIP', 'ZIP', 'Zip Code', 'Mailing ZIP']);
  var county = pick_(raw, ['County Name [District]', 'County Name', 'County', 'County Description']);
  var address1 = pick_(raw, ['Location Address 1 [District]', 'Location Address 1', 'Address 1', 'Street Address', 'Physical Address', 'Address']);
  var address2 = pick_(raw, ['Location Address 2 [District]', 'Location Address 2', 'Address 2']);
  var phone = pick_(raw, ['Phone Number [District]', 'Phone Number', 'Phone', 'Telephone']);
  var website = pick_(raw, ['Web Site URL [District]', 'Web Site URL', 'Website', 'URL', 'Web Address']);
  var locale = pick_(raw, ['Locale [District]', 'Locale', 'NCES Locale']);
  var saipe = pick_(raw, ['SAIPE', 'Saipe', 'Poverty', 'Poverty Rate', 'County Poverty']);
  var latitude = pick_(raw, ['Latitude [District]', 'Latitude', 'Lat']);
  var longitude = pick_(raw, ['Longitude [District]', 'Longitude', 'Long', 'Lng']);
  var agencyType = pick_(raw, ['Agency Type [District]', 'Agency Type', 'Type', 'Institution Type']);
  var students = pick_(raw, ['Total Students All Grades', 'Total Students', 'Enrollment']);
  var schools = pick_(raw, ['Total Number Operational Schools', 'Operational Schools', 'Schools']);
  var entityKeySource = entityId || [name, stateAbbr, zip].join('|');

  return compactObject_({
    record_id: makeRecordId_(tier, entityKeySource),
    entity_key: tier + '|' + normalizeKey_(entityKeySource),
    tier_key: tier,
    source_sheet: sourceSheet,
    row_number: rowNumber,
    entity_id: entityId,
    name: name,
    state: stateName,
    state_abbr: stateAbbr,
    county: county,
    city: city,
    zip: zip,
    address: [address1, address2].filter(Boolean).join(' '),
    phone: phone,
    website: website,
    locale: locale,
    saipe: saipe,
    agency_type: agencyType,
    students: students,
    schools: schools,
    latitude: latitude,
    longitude: longitude,
    raw: compactRaw_(raw)
  });
}

function normalizeHrsaRecord_(headers, values, rowNumber) {
  var raw = rowObject_(headers, values);
  var entityId = pick_(raw, ['Site ID', 'BHCMISID', 'BHCMIS ID', 'Health Center Site ID', 'Site Number', 'ID']);
  var name = pick_(raw, ['Site Name', 'Health Center Site Name', 'Service Delivery Site Name', 'SITE_NM', 'SITE_NAME', 'Name']);
  var org = pick_(raw, ['Organization Name', 'Health Center Name', 'Grantee Name', 'Awardee Name', 'ORG_NM', 'ORGANIZATION_NAME']);
  var stateAbbr = pick_(raw, ['Site State Abbreviation', 'State Abbreviation', 'State Abbr', 'State', 'ST']);
  var stateName = pick_(raw, ['State Name', 'Site State Name', 'State']);
  stateAbbr = normalizeStateParam_(stateAbbr) || normalizeStateParam_(stateName);
  stateName = STATE_NAME[stateAbbr] || stateName;
  var city = pick_(raw, ['Site City', 'City', 'CITY']);
  var zip = pick_(raw, ['Site ZIP Code', 'ZIP Code', 'Zip', 'ZIP']);
  var county = pick_(raw, ['Site County', 'County', 'County Name', 'COUNTY']);
  var address1 = pick_(raw, ['Site Street Address', 'Address', 'Address 1', 'Street Address', 'ADDR']);
  var address2 = pick_(raw, ['Address 2']);
  var phone = pick_(raw, ['Site Telephone Number', 'Phone Number', 'Phone', 'Telephone']);
  var website = pick_(raw, ['Website', 'Web Site', 'URL']);
  var latitude = pick_(raw, ['Latitude', 'LATITUDE', 'Lat']);
  var longitude = pick_(raw, ['Longitude', 'LONGITUDE', 'Long', 'Lng']);
  var type = pick_(raw, ['Site Type', 'Health Center Type', 'Type', 'Site Setting']);
  var entityKeySource = entityId || [name, org, stateAbbr, zip].join('|');
  return compactObject_({
    record_id: makeRecordId_('hrsa', entityKeySource),
    entity_key: 'hrsa|' + normalizeKey_(entityKeySource),
    tier_key: 'hrsa',
    source_sheet: CONFIG.SOURCE_SHEETS.hrsa,
    row_number: rowNumber,
    entity_id: entityId,
    name: name,
    organization: org,
    state: stateName,
    state_abbr: stateAbbr,
    county: county,
    city: city,
    zip: zip,
    address: [address1, address2].filter(Boolean).join(' '),
    phone: phone,
    website: website,
    site_type: type,
    latitude: latitude,
    longitude: longitude,
    raw: compactRaw_(raw)
  });
}

function readSheetObjects_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (!values.length) return { headers: [], rows: [] };
  var headerIndex = detectHeaderRow_(values);
  var headers = values[headerIndex].map(function(h, i) { return (h || ('Column ' + (i + 1))).toString().trim(); });
  headers = makeUniqueHeaders_(headers);
  var rows = [];
  for (var r = headerIndex + 1; r < values.length; r++) {
    if (values[r].join('').toString().trim() === '') continue;
    rows.push({ rowNumber: r + 1, values: values[r] });
  }
  return { headers: headers, rows: rows };
}

function detectHeaderRow_(values) {
  var bestIdx = 0;
  var bestScore = -1;
  var maxScan = Math.min(values.length, 25);
  for (var i = 0; i < maxScan; i++) {
    var row = values[i].map(String);
    var nonempty = row.filter(function(x) { return x.trim() !== ''; }).length;
    var blob = norm_(row.join(' '));
    var markers = ['state','agency','district','institution','site','county','locale','zip','phone','address','name'];
    var score = nonempty;
    markers.forEach(function(m) { if (blob.indexOf(m) !== -1) score += 8; });
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

function rowObject_(headers, values) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    var v = values[i];
    if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    obj[headers[i]] = v === null || v === undefined ? '' : v;
  }
  return obj;
}

function pick_(raw, candidates) {
  var keys = Object.keys(raw);
  for (var c = 0; c < candidates.length; c++) {
    var target = normHeader_(candidates[c]);
    for (var i = 0; i < keys.length; i++) {
      if (normHeader_(keys[i]) === target && raw[keys[i]] !== '') return raw[keys[i]];
    }
  }
  for (var c2 = 0; c2 < candidates.length; c2++) {
    var needle = normHeader_(candidates[c2]);
    for (var j = 0; j < keys.length; j++) {
      var h = normHeader_(keys[j]);
      if ((h.indexOf(needle) !== -1 || needle.indexOf(h) !== -1) && raw[keys[j]] !== '') return raw[keys[j]];
    }
  }
  return '';
}

function firstMeaningful_(raw) {
  var keys = Object.keys(raw);
  for (var i = 0; i < keys.length; i++) {
    var v = String(raw[keys[i]] || '').trim();
    if (v && v.length > 2 && !/^\d+$/.test(v)) return v;
  }
  return '';
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  var current = getHeaderRow_(sheet);
  if (!current.length || current.join('') === '') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    addMissingHeaders_(sheet, current, headers);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function getHeaderRow_(sheet) {
  if (sheet.getLastColumn() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function addMissingHeaders_(sheet, current, needed) {
  var headers = current.slice();
  var changed = false;
  needed.forEach(function(h) {
    if (headers.indexOf(h) === -1) { headers.push(h); changed = true; }
  });
  if (changed) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function findActivityRow_(sheet, headers, recordId, entityKey) {
  var recordIdx = headers.indexOf('record_id');
  var entityIdx = headers.indexOf('entity_key');
  if (sheet.getLastRow() < 2) return -1;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (recordIdx >= 0 && values[i][recordIdx] === recordId) return i + 2;
    if (entityIdx >= 0 && entityKey && values[i][entityIdx] === entityKey) return i + 2;
  }
  return -1;
}

function seedSettings_(ss) {
  var sheet = ss.getSheetByName('Settings');
  if (!sheet || sheet.getLastRow() > 1) return;
  sheet.appendRow(['Source Spreadsheet ID', CONFIG.SOURCE_SPREADSHEET_ID, 'Read-only prospect source workbook']);
  sheet.appendRow(['Key States', CONFIG.KEY_STATES.join(', '), 'Default first-round callout states']);
}

function getSourceSs_() {
  return SpreadsheetApp.openById(CONFIG.SOURCE_SPREADSHEET_ID);
}

function getTrackerSs_() {
  if (CONFIG.TRACKER_SPREADSHEET_ID) return SpreadsheetApp.openById(CONFIG.TRACKER_SPREADSHEET_ID);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  return SpreadsheetApp.openById(CONFIG.SOURCE_SPREADSHEET_ID);
}

function getSheetByNameLoose_(ss, desired) {
  var exact = ss.getSheetByName(desired);
  if (exact) return exact;
  var target = normHeader_(desired);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (normHeader_(sheets[i].getName()) === target) return sheets[i];
  }
  for (var j = 0; j < sheets.length; j++) {
    var n = normHeader_(sheets[j].getName());
    if (n.indexOf(target) !== -1 || target.indexOf(n) !== -1) return sheets[j];
  }
  return null;
}


function cleanLabel_(value, fallback) {
  var s = String(value || '').trim();
  return s || fallback;
}

function incCount_(obj, label) {
  label = cleanLabel_(label, 'Unknown');
  if (!obj[label]) obj[label] = { label: label, count: 0 };
  obj[label].count++;
}

function sortCounts_(obj) {
  return Object.keys(obj).map(function(k) { return obj[k]; }).sort(function(a, b) {
    return (b.count || 0) - (a.count || 0) || String(a.label).localeCompare(String(b.label));
  });
}

function sortObjects_(obj, numericField) {
  return Object.keys(obj).map(function(k) { return obj[k]; }).sort(function(a, b) {
    return (b[numericField] || 0) - (a[numericField] || 0) || String(a.label).localeCompare(String(b.label));
  });
}

function followUpBucket_(value) {
  var d = parseDateOnly_(value);
  if (!d) return { key: 'none', label: 'No Follow-Up Date' };
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { key: 'overdue', label: 'Overdue' };
  if (diff === 0) return { key: 'today', label: 'Due Today' };
  if (diff <= 7) return { key: 'next7', label: 'Next 7 Days' };
  return { key: 'future', label: 'Future' };
}

function parseDateOnly_(value) {
  if (!value) return null;
  if (value instanceof Date) {
    var d0 = new Date(value.getTime());
    d0.setHours(0, 0, 0, 0);
    return isNaN(d0.getTime()) ? null : d0;
  }
  var s = String(value).trim();
  if (!s) return null;
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  var d;
  if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  else d = new Date(s);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function orderFollowUp_(obj) {
  var order = ['Overdue', 'Due Today', 'Next 7 Days', 'Future', 'No Follow-Up Date'];
  var out = [];
  order.forEach(function(label) {
    if (obj[label]) out.push(obj[label]);
  });
  Object.keys(obj).forEach(function(label) {
    if (order.indexOf(label) === -1) out.push(obj[label]);
  });
  return out;
}

function parsePayload_(params) {
  if (params.payload) return JSON.parse(params.payload);
  var payload = {};
  Object.keys(params).forEach(function(k) {
    if (['action','callback','token','_'].indexOf(k) === -1) payload[k] = params[k];
  });
  return payload;
}

function safeResponse_(e, fn) {
  try {
    var data = fn();
    return output_(e, data);
  } catch (err) {
    return output_(e, { ok: false, error: err.message || String(err), stack: err.stack || '' });
  }
}

function output_(e, data) {
  var callback = e && e.parameter && e.parameter.callback;
  var json = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function validateToken_(e) {
  if (!CONFIG.API_TOKEN) return;
  var incoming = e && e.parameter && e.parameter.token;
  if (incoming !== CONFIG.API_TOKEN) throw new Error('Invalid API token.');
}

function writeValuesInChunks_(sheet, values, startRow, startCol) {
  if (!values || !values.length) return;
  var chunk = 1000;
  for (var i = 0; i < values.length; i += chunk) {
    var part = values.slice(i, i + chunk);
    sheet.getRange(startRow + i, startCol, part.length, part[0].length).setValues(part);
  }
}

function makeUniqueHeaders_(headers) {
  var seen = {};
  return headers.map(function(h, i) {
    h = h || ('Column ' + (i + 1));
    if (!seen[h]) { seen[h] = 1; return h; }
    seen[h] += 1;
    return h + ' ' + seen[h];
  });
}

function makeRecordId_(tier, key) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, normalizeKey_(key || tier));
  var hex = digest.map(function(b) { var v = (b + 256) % 256; return ('0' + v.toString(16)).slice(-2); }).join('');
  return tier + '|' + hex;
}

function normalizeKey_(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeStateParam_(value) {
  var s = String(value || '').trim();
  if (!s) return '';
  if (s.length === 2) return s.toUpperCase();
  return STATE_ABBR[s.toLowerCase()] || s.toUpperCase().slice(0, 2);
}

function isKeyState_(value) {
  var abbr = normalizeStateParam_(value);
  var name = STATE_NAME[abbr] || titleCase_(String(value || '').toLowerCase());
  return CONFIG.KEY_STATES.map(function(s) { return s.toLowerCase(); }).indexOf(name.toLowerCase()) !== -1;
}

function parseLocaleFilter_(value) {
  if (!value) return [];
  return String(value).split(',').map(function(x) { return Number(x.trim()); }).filter(function(n) { return !isNaN(n); });
}

function localeIn_(locale, allowed) {
  var m = String(locale || '').match(/\d{2}/);
  if (!m) return false;
  return allowed.indexOf(Number(m[0])) !== -1;
}

function recordSearchBlob_(rec) {
  return {
    match: function(q) {
      return norm_(JSON.stringify(rec)).indexOf(q) !== -1;
    }
  };
}

function norm_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normHeader_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function compactRaw_(raw) {
  var out = {};
  Object.keys(raw).forEach(function(k) {
    var v = raw[k];
    if (v !== '' && v !== null && v !== undefined) out[k] = v;
  });
  return out;
}

function compactObject_(obj) {
  var out = {};
  Object.keys(obj).forEach(function(k) {
    var v = obj[k];
    if (v !== null && v !== undefined) out[k] = v;
  });
  return out;
}

function parseNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  var n = Number(value);
  return isNaN(n) ? null : n;
}

function milesBetween_(lat1, lon1, lat2, lon2) {
  var R = 3958.8;
  var dLat = toRad_(lat2 - lat1);
  var dLon = toRad_(lon2 - lon1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad_(lat1)) * Math.cos(toRad_(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function toRad_(deg) { return deg * Math.PI / 180; }
function truncate_(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function titleCase_(s) { return String(s || '').replace(/\b\w/g, function(c) { return c.toUpperCase(); }); }
function safeUserEmail_() { try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; } }
