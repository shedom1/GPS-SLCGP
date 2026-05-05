/**
 * FQHC Prospect Tracker API Proxy + Normalizer
 * ------------------------------------------------------------
 * Deploy as a Google Apps Script Web App.
 * Reps use the GitHub HTML page only. They do not map source files.
 *
 * Recommended setup:
 * 1) Create a Google Sheet named FQHC Prospect Tracker Data.
 * 2) Extensions > Apps Script. Paste this file into Code.gs.
 * 3) Project Settings > Script Properties:
 *      SPREADSHEET_ID = your Google Sheet ID
 * 4) Deploy > New deployment > Web app:
 *      Execute as: Me
 *      Who has access: Anyone with the link
 * 5) Paste the Web App URL into GitHub config.js.
 */

var CONFIG = {
  HRSA_SITES_CSV: 'https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv',
  CMS_ENROLLMENTS_API: 'https://data.cms.gov/data-api/v1/dataset/4bcae866-3411-439a-b762-90a6187c194b/data',
  CMS_OWNERS_API: 'https://data.cms.gov/data-api/v1/dataset/ed289c89-0bb8-4221-a20a-85776066381b/data',
  USDA_RUCA_ZIP_XLSX: 'https://ers.usda.gov/sites/default/files/_laserfiche/DataFiles/53241/RUCA-codes-2020-zipcode.xlsx?v=32088',
  HRSA_FORHP_ZIP_XLSX: 'https://www.hrsa.gov/sites/default/files/hrsa/rural-health/about/forhp-zips-counties.xlsx',
  CACHE_MINUTES: 60,
  MAX_RECORDS: 30000
};

var SHEETS = {
  SOURCE: 'Source_Data',
  NOTES: 'Rep_Notes',
  STATUS: 'Source_Status'
};

var SOURCE_HEADERS = [
  'record_id','region','state','name','organization_name','site_type','address','city','zip','county',
  'phone','website','latitude','longitude','ruca_primary','ruca_secondary','forhp_rural','is_rural',
  'cms_legal_name','cms_dba','cms_organization_type','cms_owner_name','cms_owner_type','source_last_updated','source_notes'
];

var NOTE_HEADERS = ['record_id','contact_name','contact_email','assigned_to','status','priority','next_followup','notes','last_saved_at'];

var STATE_REGIONS = {
  AL:'Southeast', AR:'Southeast', FL:'Southeast', GA:'Southeast', LA:'Southeast', MS:'Southeast', NC:'Southeast', SC:'Southeast',
  KY:'Mid-Atlantic', MD:'Mid-Atlantic', TN:'Mid-Atlantic', VA:'Mid-Atlantic', WV:'Mid-Atlantic',
  CT:'Northeast', DE:'Northeast', IL:'Northeast', IN:'Northeast', IA:'Northeast', KS:'Northeast', ME:'Northeast', MA:'Northeast', MI:'Northeast', MN:'Northeast', MO:'Northeast', NE:'Northeast', NH:'Northeast', NJ:'Northeast', NY:'Northeast', ND:'Northeast', OH:'Northeast', PA:'Northeast', RI:'Northeast', SD:'Northeast', VT:'Northeast', WI:'Northeast',
  AK:'West', AZ:'West', CA:'West', CO:'West', HI:'West', ID:'West', MT:'West', NV:'West', NM:'West', OK:'West', OR:'West', TX:'West', UT:'West', WA:'West', WY:'West',
  DC:'Other'
};

function doGet(e) {
  try {
    e = e || {parameter:{}};
    var action = String(e.parameter.action || 'prospects');
    var output;
    if (action === 'refresh') output = refreshAllSources_();
    else if (action === 'status') output = {ok:true, status:getStatus_()};
    else output = getProspects_(e.parameter || {});
    return respond_(output, e.parameter.callback);
  } catch (err) {
    return respond_({ok:false, error:String(err && err.stack ? err.stack : err)}, e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    if (payload.action === 'saveNote') {
      saveNote_(payload.record_id, payload.note || {});
      return respond_({ok:true});
    }
    if (payload.action === 'bulkNotes') {
      saveNotesBulk_(payload.notes || []);
      return respond_({ok:true, count:(payload.notes || []).length});
    }
    return respond_({ok:false, error:'Unknown POST action'});
  } catch (err) {
    return respond_({ok:false, error:String(err && err.stack ? err.stack : err)});
  }
}

function refreshAllSources_() {
  var started = new Date();
  ensureSheets_();
  var status = [];
  var hrsaRows = [], rucaMap = {}, forhpMap = {}, cmsEnrollMap = {}, cmsOwnerMap = {};

  try {
    var csv = fetchText_(CONFIG.HRSA_SITES_CSV);
    hrsaRows = csvToObjects_(csv);
    status.push(okStatus_('HRSA Service Delivery Sites', hrsaRows.length, 'Loaded primary FQHC/site list.'));
  } catch (err) {
    status.push(badStatus_('HRSA Service Delivery Sites', 'Could not load HRSA CSV: ' + err));
  }

  try {
    var rucaValues = fetchXlsxFirstSheet_(CONFIG.USDA_RUCA_ZIP_XLSX);
    rucaMap = buildRucaMap_(rowsToObjects_(rucaValues));
    status.push(okStatus_('USDA RUCA ZIP Codes', Object.keys(rucaMap).length, 'Loaded ZIP-level RUCA enrichment.'));
  } catch (err) {
    status.push(warnStatus_('USDA RUCA ZIP Codes', 'RUCA enrichment unavailable: ' + err));
  }

  try {
    var forhpValues = fetchXlsxFirstSheet_(CONFIG.HRSA_FORHP_ZIP_XLSX);
    forhpMap = buildForhpZipMap_(rowsToObjects_(forhpValues));
    status.push(okStatus_('HRSA FORHP Rural ZIP Approx.', Object.keys(forhpMap).length, 'Loaded FORHP rural ZIP approximation.'));
  } catch (err) {
    status.push(warnStatus_('HRSA FORHP Rural ZIP Approx.', 'FORHP rural enrichment unavailable: ' + err));
  }

  try {
    var cmsEnroll = fetchCmsPaged_(CONFIG.CMS_ENROLLMENTS_API);
    cmsEnrollMap = buildCmsEnrollmentMap_(cmsEnroll);
    status.push(okStatus_('CMS FQHC Enrollments', cmsEnroll.length, 'Loaded Medicare enrollment validation layer.'));
  } catch (err) {
    status.push(warnStatus_('CMS FQHC Enrollments', 'CMS enrollments unavailable: ' + err));
  }

  try {
    var cmsOwners = fetchCmsPaged_(CONFIG.CMS_OWNERS_API);
    cmsOwnerMap = buildCmsOwnerMap_(cmsOwners);
    status.push(okStatus_('CMS FQHC All Owners', cmsOwners.length, 'Loaded ownership context layer.'));
  } catch (err) {
    status.push(warnStatus_('CMS FQHC All Owners', 'CMS owners unavailable: ' + err));
  }

  var normalized = normalizeHrsaSites_(hrsaRows, rucaMap, forhpMap, cmsEnrollMap, cmsOwnerMap);
  writeTable_(SHEETS.SOURCE, SOURCE_HEADERS, normalized.map(function(r){ return SOURCE_HEADERS.map(function(h){ return r[h] || ''; }); }));
  status.push(okStatus_('Normalized Source_Data', normalized.length, 'Ready for reps. Mapping was handled server-side.'));
  writeStatus_(status, started);
  return {ok:true, message:'Refresh complete. Normalized ' + normalized.length + ' FQHC/site records.', count:normalized.length, status:getStatus_()};
}

function getProspects_(params) {
  ensureSheets_();
  var sourceSheet = getSpreadsheet_().getSheetByName(SHEETS.SOURCE);
  if (sourceSheet.getLastRow() < 2) {
    // First user load initializes the cache so reps do not have to map files manually.
    refreshAllSources_();
  }
  var source = readObjects_(SHEETS.SOURCE);
  var notes = readNotesMap_();
  var out = [];
  var limit = Math.min(Number(params.limit || CONFIG.MAX_RECORDS), CONFIG.MAX_RECORDS);
  for (var i=0; i<source.length && out.length<limit; i++) {
    var r = source[i];
    var n = notes[r.record_id] || {};
    out.push(Object.assign({}, r, n, {
      is_rural: String(r.is_rural).toLowerCase() === 'true' || String(r.is_rural).toLowerCase() === 'yes'
    }));
  }
  return {ok:true, records:out, status:getStatus_(), generated_at:new Date().toISOString()};
}

function normalizeHrsaSites_(rows, rucaMap, forhpMap, cmsEnrollMap, cmsOwnerMap) {
  var now = new Date().toISOString();
  var seen = {};
  var normalized = [];
  rows.forEach(function(row, idx){
    var state = upper_(field_(row,['SITE_STATE_ABBR','Site State Abbreviation','State','State Abbreviation','Site State','STATE']));
    var zip = cleanZip_(field_(row,['SITE_ZIP_CD','Site ZIP Code','ZIP Code','Zip','ZIP','Site Zip']));
    var name = field_(row,['SITE_NM','Site Name','Health Center Site Name','Site','Name','FQHC Name']) || 'Unnamed Site';
    var org = field_(row,['AWARDEE_NM','Awardee Name','Health Center Name','Organization Name','Grantee Name','BHCMIS Organization Name']);
    var city = field_(row,['SITE_CITY','Site City','City']);
    var county = field_(row,['SITE_COUNTY','County','County Name','SITE_COUNTY_NM']);
    var address = field_(row,['SITE_ADDRESS','Site Address','Street Address','Address','Site Street Address']);
    var phone = field_(row,['SITE_PHONE_NUM','Site Phone Number','Phone','Phone Number','Telephone']);
    var website = field_(row,['SITE_URL','Site URL','Website','URL']);
    var siteType = joinUnique_([
      field_(row,['HCC_TYP_DESC','Site Type','Type','Health Center Type']),
      field_(row,['HCC_LOC_DESC','Location Type','Site Setting','Location Description'])
    ], ' / ');
    var latlon = String(field_(row,['LAT_LON','Lat Lon','Latitude Longitude']) || '');
    var lat = field_(row,['LATITUDE','Latitude','LAT']);
    var lon = field_(row,['LONGITUDE','Longitude','LON','LNG']);
    if ((!lat || !lon) && latlon) {
      var m = latlon.match(/(-?\d+(?:\.\d+)?)\s*,?\s+(-?\d+(?:\.\d+)?)/);
      if (m) { lat = m[1]; lon = m[2]; }
    }
    var recordId = field_(row,['HCC_FCT_ID','Site ID','HCC ID','Row_ID','SITE_ID']) || makeId_([state, zip, name, idx]);
    if (seen[recordId]) recordId = recordId + '-' + idx;
    seen[recordId] = true;

    var ruca = rucaMap[zip] || {};
    var forhp = forhpMap[zip] || {};
    var cmsKey = bestCmsKey_(name, org, state, zip, cmsEnrollMap);
    var cms = cmsKey ? cmsEnrollMap[cmsKey] : {};
    var owner = cmsKey && cmsOwnerMap[cmsKey] ? cmsOwnerMap[cmsKey] : bestOwnerByZip_(state, zip, cmsOwnerMap);
    var rucaPrimary = cleanRuca_(ruca.ruca_primary);
    var isRural = Boolean(forhp.is_rural || rucaPrimary === '10' || rucaPrimary === '7' || rucaPrimary === '8' || rucaPrimary === '9');
    normalized.push({
      record_id:String(recordId),
      region: STATE_REGIONS[state] || 'Other',
      state: state,
      name: name,
      organization_name: org,
      site_type: siteType,
      address: address,
      city: city,
      zip: zip,
      county: county || forhp.county || '',
      phone: phone,
      website: website,
      latitude: lat,
      longitude: lon,
      ruca_primary: rucaPrimary || 'Unknown',
      ruca_secondary: ruca.ruca_secondary || '',
      forhp_rural: forhp.label || '',
      is_rural: isRural ? 'true' : 'false',
      cms_legal_name: cms.legal_name || '',
      cms_dba: cms.dba || '',
      cms_organization_type: cms.organization_type || '',
      cms_owner_name: owner.owner_name || '',
      cms_owner_type: owner.owner_type || '',
      source_last_updated: now,
      source_notes: sourceNotes_(ruca, forhp, cms, owner)
    });
  });
  normalized.sort(function(a,b){ return String(a.state+a.name).localeCompare(String(b.state+b.name)); });
  return normalized;
}

function sourceNotes_(ruca, forhp, cms, owner) {
  var notes = [];
  if (ruca && ruca.source) notes.push('RUCA: ' + ruca.source);
  if (forhp && forhp.source) notes.push('FORHP: ' + forhp.source);
  if (cms && cms.source) notes.push('CMS Enrollment matched');
  if (owner && owner.source) notes.push('CMS Owner matched');
  return notes.join(' | ');
}

function buildRucaMap_(rows) {
  var map = {};
  rows.forEach(function(row){
    var zip = cleanZip_(field_(row,['ZIP_CODE','ZIP Code','Zip Code','ZIP','zip','ZCTA','ZIPCODE']));
    if (!zip) return;
    var primary = field_(row,['RUCA_PRIMARY','Primary RUCA Code','Primary RUCA','RUCA1','RUCA Code','RUCA','RUCA_CODE','ZIP_CODE_RUCA1','ruca_primary']);
    var secondary = field_(row,['RUCA_SECONDARY','Secondary RUCA Code','Secondary RUCA','RUCA2','Secondary Code','ZIP_CODE_RUCA2','ruca_secondary']);
    // USDA files sometimes use labels like Primary RUCA code 2020 or contain one field named RUCA1.
    if (!primary) {
      Object.keys(row).some(function(k){
        if (/primary.*ruca|ruca.*primary|ruca1|ruca code/i.test(k)) { primary = row[k]; return true; }
        return false;
      });
    }
    map[zip] = {ruca_primary: cleanRuca_(primary), ruca_secondary: String(secondary || ''), source:'USDA ERS ZIP RUCA'};
  });
  return map;
}

function buildForhpZipMap_(rows) {
  var map = {};
  rows.forEach(function(row){
    var zip = cleanZip_(field_(row,['ZIP','Zip','ZIP Code','ZIP_CODE','Zip Code','ZCTA']));
    if (!zip) return;
    var county = field_(row,['County','COUNTY','County Name','COUNTY_NAME']);
    var label = field_(row,['Rural Status','Rural/Urban','FORHP Rural','FORHP Rural Status','Eligibility','Eligible','Designation','Status','Rural']) || inferForhpLabel_(row);
    var isRural = /rural|eligible|grant|yes|true/i.test(String(label)) && !/metro|neither|not eligible|non-rural/i.test(String(label));
    map[zip] = {is_rural:isRural, label:label, county:county, source:'HRSA FORHP ZIP approximation'};
  });
  return map;
}

function inferForhpLabel_(row) {
  var vals = Object.keys(row).map(function(k){ return String(row[k]); }).join(' | ');
  if (/\bGrant\b/i.test(vals)) return 'Grant';
  if (/\bRural\b/i.test(vals)) return 'Rural';
  if (/\bMetro\b/i.test(vals)) return 'Metro';
  if (/\bNeither\b/i.test(vals)) return 'Neither';
  return '';
}

function buildCmsEnrollmentMap_(rows) {
  var map = {};
  rows.forEach(function(row){
    var state = upper_(field_(row,['state','State','STATE']));
    var zip = cleanZip_(field_(row,['zip_code','zip','Zip Code','ZIP Code','ZIP']));
    var legal = field_(row,['legal_business_name','Legal Business Name','LEGAL BUSINESS NAME','organization_name','Organization Name']);
    var dba = field_(row,['doing_business_as_name','Doing Business As Name','DBA Name','DBA']);
    var type = field_(row,['organization_type','Organization Type','ORG TYPE']);
    var key = makeMatchKey_(legal || dba, state, zip);
    if (!state || !zip || !key) return;
    map[key] = {legal_name:legal, dba:dba, organization_type:type, state:state, zip:zip, source:'CMS FQHC Enrollments'};
    if (dba) map[makeMatchKey_(dba, state, zip)] = map[key];
  });
  return map;
}

function buildCmsOwnerMap_(rows) {
  var map = {};
  rows.forEach(function(row){
    var state = upper_(field_(row,['state','State','STATE']));
    var zip = cleanZip_(field_(row,['zip_code','zip','Zip Code','ZIP Code','ZIP']));
    var legal = field_(row,['organization_name','legal_business_name','Legal Business Name','FQHC Organization Name','Provider Organization Name']);
    var ownerName = field_(row,['owner_name','Owner Name','Associate ID Owner Name','Organization Owner Name','Name']);
    var ownerType = field_(row,['owner_type','Owner Type','Ownership Type','Role']);
    var key = makeMatchKey_(legal, state, zip);
    if (!state || !zip || !key) return;
    if (!map[key]) map[key] = {owner_name:ownerName, owner_type:ownerType, state:state, zip:zip, source:'CMS FQHC All Owners'};
  });
  return map;
}

function bestCmsKey_(name, org, state, zip, map) {
  var candidates = [makeMatchKey_(name,state,zip), makeMatchKey_(org,state,zip)];
  for (var i=0; i<candidates.length; i++) if (map[candidates[i]]) return candidates[i];
  // softer ZIP-only match if name tokens overlap
  var nameNorm = normalizeName_(name + ' ' + org);
  var keys = Object.keys(map);
  for (var j=0; j<keys.length; j++) {
    var item = map[keys[j]];
    if (item.state === state && item.zip === zip) {
      var cmsNorm = normalizeName_((item.legal_name || '') + ' ' + (item.dba || ''));
      if (overlapScore_(nameNorm, cmsNorm) >= 0.45) return keys[j];
    }
  }
  return '';
}

function bestOwnerByZip_(state, zip, map) {
  var keys = Object.keys(map);
  for (var i=0; i<keys.length; i++) if (map[keys[i]].state === state && map[keys[i]].zip === zip) return map[keys[i]];
  return {};
}

function saveNote_(recordId, note) {
  if (!recordId) throw new Error('record_id is required');
  ensureSheets_();
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.NOTES);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var rowIndex = -1;
  for (var i=1; i<values.length; i++) {
    if (String(values[i][0]) === String(recordId)) { rowIndex = i+1; break; }
  }
  var row = NOTE_HEADERS.map(function(h){
    if (h === 'record_id') return recordId;
    if (h === 'last_saved_at') return new Date().toISOString();
    return note[h] || '';
  });
  if (rowIndex > 0) sh.getRange(rowIndex,1,1,row.length).setValues([row]);
  else sh.appendRow(row);
  return true;
}

function saveNotesBulk_(notes) {
  notes.forEach(function(n){ saveNote_(n.record_id, n); });
}

function readNotesMap_() {
  var rows = readObjects_(SHEETS.NOTES);
  var map = {};
  rows.forEach(function(r){ if (r.record_id) map[r.record_id] = r; });
  return map;
}

function ensureSheets_() {
  var ss = getSpreadsheet_();
  ensureSheet_(ss, SHEETS.SOURCE, SOURCE_HEADERS);
  ensureSheet_(ss, SHEETS.NOTES, NOTE_HEADERS);
  ensureSheet_(ss, SHEETS.STATUS, ['name','ok','warning','count','message','refreshed_at']);
}

function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Set Script Property SPREADSHEET_ID to your Google Sheet ID.');
  return active;
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  else {
    var existing = sh.getRange(1,1,1,Math.max(sh.getLastColumn(), headers.length)).getValues()[0].map(String);
    var changed = false;
    headers.forEach(function(h,i){ if (existing[i] !== h) changed = true; });
    if (changed) sh.getRange(1,1,1,headers.length).setValues([headers]);
  }
  sh.setFrozenRows(1);
  return sh;
}

function writeTable_(sheetName, headers, rows) {
  var ss = getSpreadsheet_();
  var sh = ensureSheet_(ss, sheetName, headers);
  sh.clearContents();
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  if (rows.length) {
    var chunk = 1000;
    for (var i=0; i<rows.length; i+=chunk) {
      sh.getRange(i+2,1,Math.min(chunk, rows.length-i),headers.length).setValues(rows.slice(i,i+chunk));
    }
  }
  sh.autoResizeColumns(1, Math.min(headers.length, 12));
}

function writeStatus_(status, started) {
  var rows = status.map(function(s){ return [s.name, s.ok ? 'TRUE' : 'FALSE', s.warning ? 'TRUE' : 'FALSE', s.count || '', s.message || '', s.refreshed_at || new Date().toISOString()]; });
  writeTable_(SHEETS.STATUS, ['name','ok','warning','count','message','refreshed_at'], rows);
}

function getStatus_() {
  var rows = readObjects_(SHEETS.STATUS);
  return rows.map(function(r){
    return {name:r.name, ok:String(r.ok).toUpperCase()==='TRUE', warning:String(r.warning).toUpperCase()==='TRUE', count:r.count, message:r.message, refreshed_at:r.refreshed_at};
  });
}

function readObjects_(sheetName) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getDataRange().getValues();
  return rowsToObjects_(values);
}

function rowsToObjects_(values) {
  if (!values || !values.length) return [];
  var headers = values[0].map(function(h){ return String(h || '').trim(); });
  var out = [];
  for (var i=1; i<values.length; i++) {
    var obj = {};
    var empty = true;
    headers.forEach(function(h,j){
      if (!h) return;
      var v = values[i][j];
      if (v !== '' && v !== null && v !== undefined) empty = false;
      obj[h] = v;
    });
    if (!empty) out.push(obj);
  }
  return out;
}

function csvToObjects_(csv) {
  var values = Utilities.parseCsv(csv);
  return rowsToObjects_(values);
}

function fetchText_(url) {
  var res = UrlFetchApp.fetch(url, {muteHttpExceptions:true, followRedirects:true, headers:{'User-Agent':'Mozilla/5.0 FQHC Tracker'}});
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('HTTP ' + code + ' for ' + url);
  return res.getContentText();
}

function fetchCmsPaged_(baseUrl) {
  var out = [];
  var size = 5000;
  for (var offset=0; offset<50000; offset+=size) {
    var sep = baseUrl.indexOf('?') >= 0 ? '&' : '?';
    var url = baseUrl + sep + 'size=' + size + '&offset=' + offset;
    var txt = fetchText_(url);
    var json = JSON.parse(txt);
    var rows = Array.isArray(json) ? json : (json.data || json.results || []);
    out = out.concat(rows);
    if (rows.length < size) break;
  }
  return out;
}

function fetchXlsxFirstSheet_(url) {
  var res = UrlFetchApp.fetch(url, {muteHttpExceptions:true, followRedirects:true, headers:{'User-Agent':'Mozilla/5.0 FQHC Tracker'}});
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('HTTP ' + code + ' for ' + url);
  var blob = res.getBlob();
  return parseXlsxFirstSheet_(blob);
}

function parseXlsxFirstSheet_(blob) {
  var files = Utilities.unzip(blob);
  var byName = {};
  files.forEach(function(f){ byName[f.getName()] = f.getDataAsString(); });
  var shared = [];
  if (byName['xl/sharedStrings.xml']) {
    var si = byName['xl/sharedStrings.xml'].match(/<si[\s\S]*?<\/si>/g) || [];
    shared = si.map(function(block){
      var texts = block.match(/<t[^>]*>[\s\S]*?<\/t>/g) || [];
      return texts.map(function(t){ return xmlUnescape_(t.replace(/<[^>]+>/g,'')); }).join('');
    });
  }
  var sheetName = Object.keys(byName).filter(function(n){ return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); }).sort()[0];
  if (!sheetName) throw new Error('No worksheet found in XLSX.');
  var xml = byName[sheetName];
  var rows = [];
  var rowBlocks = xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];
  rowBlocks.forEach(function(rowXml){
    var row = [];
    var cells = rowXml.match(/<c\s[^>]*>[\s\S]*?<\/c>/g) || [];
    cells.forEach(function(cXml){
      var ref = (cXml.match(/\sr="([A-Z]+)(\d+)"/) || [])[1] || '';
      var col = lettersToIndex_(ref.replace(/\d/g,''));
      var type = (cXml.match(/\st="([^"]+)"/) || [])[1] || '';
      var vMatch = cXml.match(/<v[^>]*>([\s\S]*?)<\/v>/);
      var val = '';
      if (type === 's' && vMatch) val = shared[Number(vMatch[1])] || '';
      else if (type === 'inlineStr') {
        var tMatch = cXml.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        val = tMatch ? xmlUnescape_(tMatch[1]) : '';
      } else val = vMatch ? xmlUnescape_(vMatch[1]) : '';
      row[col] = val;
    });
    if (row.some(function(v){ return v !== '' && v !== undefined; })) rows.push(row.map(function(v){ return v || ''; }));
  });
  return rows;
}

function lettersToIndex_(letters) {
  var n = 0;
  for (var i=0; i<letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

function field_(row, aliases) {
  for (var i=0; i<aliases.length; i++) {
    if (row[aliases[i]] !== undefined && row[aliases[i]] !== null && row[aliases[i]] !== '') return String(row[aliases[i]]).trim();
  }
  var keys = Object.keys(row);
  for (var j=0; j<aliases.length; j++) {
    var target = normalizeHeader_(aliases[j]);
    for (var k=0; k<keys.length; k++) if (normalizeHeader_(keys[k]) === target && row[keys[k]] !== '') return String(row[keys[k]]).trim();
  }
  return '';
}

function normalizeHeader_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g,''); }
function upper_(s) { return String(s || '').trim().toUpperCase(); }
function cleanZip_(s) { var m = String(s || '').match(/\d{5}/); return m ? m[0] : ''; }
function cleanRuca_(v) { var s = String(v || '').trim(); if (!s) return ''; var m = s.match(/^(\d{1,2})(?:\.\d+)?/); return m ? m[1] : s; }
function makeId_(parts) { return parts.map(function(p){ return String(p || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }).filter(Boolean).join('-').slice(0,120); }
function makeMatchKey_(name,state,zip) { var n = normalizeName_(name); if (!n || !state || !zip) return ''; return state + '|' + zip + '|' + n; }
function normalizeName_(s) { return String(s || '').toLowerCase().replace(/\b(inc|llc|ltd|corp|corporation|the|health|center|clinic|fqhc|federally|qualified|community|medical|services|service)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' '); }
function overlapScore_(a,b) { var A = String(a||'').split(' ').filter(Boolean), B = String(b||'').split(' ').filter(Boolean); if (!A.length || !B.length) return 0; var setB = {}; B.forEach(function(x){setB[x]=true;}); var hit = A.filter(function(x){return setB[x];}).length; return hit / Math.max(A.length, B.length); }
function joinUnique_(arr, sep) { var seen = {}; return arr.filter(function(x){ x=String(x||'').trim(); if(!x || seen[x]) return false; seen[x]=true; return true; }).join(sep || ' / '); }
function xmlUnescape_(s) { return String(s || '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'"); }

function okStatus_(name,count,message) { return {name:name, ok:true, warning:false, count:count, message:message, refreshed_at:new Date().toISOString()}; }
function warnStatus_(name,message) { return {name:name, ok:false, warning:true, count:'', message:message, refreshed_at:new Date().toISOString()}; }
function badStatus_(name,message) { return {name:name, ok:false, warning:false, count:'', message:message, refreshed_at:new Date().toISOString()}; }

function respond_(obj, callback) {
  var text = JSON.stringify(obj || {});
  if (callback) {
    return ContentService.createTextOutput(String(callback).replace(/[^a-zA-Z0-9_.$]/g,'') + '(' + text + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
