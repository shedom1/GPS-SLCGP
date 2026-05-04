
const CONFIG = {
  K12_SOURCE_SPREADSHEET_ID: '1eDW0C7vnnfT7dOjQIk-EHAWeFNdI2iYeiXxH6uy3hfY',
  K12_SOURCE_SHEET_NAME: 'ELSI Export',
  TRACKER_SHEET: 'ProspectTracker',
  HIGHERED_SHEET: 'HigherEd',
  K12_TIERMAP_SHEET: 'K12_TierMap',
  TIER1_CONTACTS_SHEET: 'Tier1Contacts',
  GUIDE_URL: '',
  STATUS_OPTIONS: ['','Not Started','Researching','Assigned','Attempted','Contacted','Meeting Scheduled','Qualified','Nurture','Closed'],
  TIER_FILTERS: [
    { key: 'all_k12', short: 'All K-12', label: 'All K-12 (Locales 11–43)', description: 'Every K-12 district from the linked source sheet with locale codes 11 through 43.', color: '#2563eb' },
    { key: 'tier1', short: 'Tier 1', label: 'Tier 1: K-12 Rural Remote, >30% SAIPE', description: 'K-12 Rural Remote districts with Locale 43 and SAIPE at 30% or greater.', color: '#0f766e' },
    { key: 'tier2', short: 'Tier 2', label: 'Tier 2: K-12 Rural Remote / SAIPE Unknown', description: 'K-12 Rural Remote districts with Locale 43 where SAIPE is not known.', color: '#b45309' },
    { key: 'tier3', short: 'Tier 3', label: 'Tier 3: HigherEd Rural Remote', description: 'Higher-ed Rural Remote institutions that may serve as hubs.', color: '#7c3aed' },
    { key: 'tier4', short: 'Tier 4', label: 'Tier 4: Higher Ed Rural Outreach', description: 'Higher-ed institutions with identified rural outreach programs.', color: '#475569' }
  ],
  REGION_MAP: {
    'KY':'Mid-Atlantic','MD':'Mid-Atlantic','TN':'Mid-Atlantic','VA':'Mid-Atlantic','WV':'Mid-Atlantic',
    'CT':'Northeast','DE':'Northeast','IL':'Northeast','IN':'Northeast','IA':'Northeast','KS':'Northeast','ME':'Northeast','MA':'Northeast','MI':'Northeast','MN':'Northeast','MO':'Northeast','NE':'Northeast','NH':'Northeast','NJ':'Northeast','NY':'Northeast','ND':'Northeast','OH':'Northeast','PA':'Northeast','RI':'Northeast','SD':'Northeast','VT':'Northeast','WI':'Northeast',
    'AL':'Southeast','AR':'Southeast','FL':'Southeast','GA':'Southeast','LA':'Southeast','MS':'Southeast','NC':'Southeast','SC':'Southeast',
    'AK':'West','AZ':'West','CA':'West','CO':'West','HI':'West','ID':'West','MT':'West','NV':'West','NM':'West','OK':'West','OR':'West','TX':'West','UT':'West','WA':'West','WY':'West'
  },
  KEY_STATES: ['MS','IL','NC','AK','OH','OR','ID','AZ','SD','FL','NE','AR','NM','WI','IA','NV','UT','IN','MT','ND','NH','WY','MA','HI']
};

function doGet() {
  ensureTrackerSheet_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('RUS DLT Prospecting Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getInitialPayload() {
  ensureTrackerSheet_();
  const trackerMap = getTrackerMap_();
  const tierMap = getTierMap_();
  const contactsMap = getTier1ContactsMap_();
  const rows = loadK12Rows_(tierMap, contactsMap, trackerMap).concat(loadHigherEdRows_(trackerMap));
  return {
    rows: rows,
    config: {
      statusOptions: CONFIG.STATUS_OPTIONS,
      tierFilters: CONFIG.TIER_FILTERS,
      keyStates: CONFIG.KEY_STATES,
      guideUrl: CONFIG.GUIDE_URL,
      trackerSheetName: CONFIG.TRACKER_SHEET,
      appSpreadsheetUrl: getAppSpreadsheet_().getUrl()
    }
  };
}

function saveTracker(payload) {
  if (!payload || !payload.externalKey) throw new Error('Missing externalKey.');
  const clean = {
    externalKey: String(payload.externalKey).trim(),
    status: String(payload.status || '').trim(),
    assigned_to: String(payload.assigned_to || '').trim(),
    notes: String(payload.notes || '').trim(),
    updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/New_York', 'yyyy-MM-dd HH:mm:ss')
  };
  upsertTrackerRow_(clean);
  return {
    ok: true,
    externalKey: clean.externalKey,
    status: clean.status,
    assigned_to: clean.assigned_to,
    notes: clean.notes,
    updatedAt: clean.updatedAt
  };
}

function getRecordDetail(externalKey) {
  if (!externalKey) throw new Error('Missing externalKey.');
  const trackerMap = getTrackerMap_();
  const tracker = trackerMap[String(externalKey)] || {};
  if (String(externalKey).indexOf('CAND|') === 0 || String(externalKey).indexOf('OUTREACH|') === 0) {
    return getHigherEdDetail_(externalKey, tracker);
  }
  return getK12Detail_(externalKey, tracker);
}

function getK12Detail_(externalKey, tracker) {
  const source = getK12Source_();
  const rows = source.rows;
  const idx = source.idx;
  const targetState = String(externalKey).split('|')[0];
  const targetSlug = String(externalKey).split('|').slice(1).join('|');
  for (var i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const org = cleanDisplay_(raw[idx.organization]);
    const state = cleanDisplay_(raw[idx.state_abbr] || raw[idx.loc_state]).toUpperCase();
    if (!org || !state) continue;
    if (state !== targetState) continue;
    if (slugify_(org) !== targetSlug) continue;
    const fields = [];
    Object.keys(raw).forEach(function(key){
      var value = raw[key];
      if (value === '' || value === null || value === undefined) return;
      fields.push({label:key, value:String(value)});
    });
    if (tracker.status || tracker.assigned_to || tracker.notes || tracker.updatedAt) {
      fields.unshift({label:'Tracker Status', value:tracker.status || ''});
      fields.unshift({label:'Assigned To', value:tracker.assigned_to || ''});
      fields.unshift({label:'Tracker Notes', value:tracker.notes || ''});
      fields.unshift({label:'Tracker Updated', value:tracker.updatedAt || ''});
    }
    return {
      ok:true,
      title: org,
      subtitle: 'K-12 source record',
      externalKey: externalKey,
      fields: fields
    };
  }
  throw new Error('K-12 record not found for ' + externalKey);
}

function getHigherEdDetail_(externalKey, tracker) {
  const sheet = requireSheet_(CONFIG.HIGHERED_SHEET);
  const rows = sheetToObjects_(sheet);
  const row = rows.find(function(r){ return String(r.externalKey) === String(externalKey); });
  if (!row) throw new Error('Higher-ed record not found for ' + externalKey);
  const fields = [];
  Object.keys(row).forEach(function(k){
    if (row[k] === '' || row[k] === null || row[k] === undefined) return;
    fields.push({label: prettifyLabel_(k), value: String(row[k])});
  });
  if (tracker.status || tracker.assigned_to || tracker.notes || tracker.updatedAt) {
    fields.unshift({label:'Tracker Status', value:tracker.status || ''});
    fields.unshift({label:'Assigned To', value:tracker.assigned_to || ''});
    fields.unshift({label:'Tracker Notes', value:tracker.notes || ''});
    fields.unshift({label:'Tracker Updated', value:tracker.updatedAt || ''});
  }
  return {
    ok:true,
    title: row.organization || 'Higher-ed record',
    subtitle: row.tier_label || 'Higher-ed seed row',
    externalKey: externalKey,
    fields: fields
  };
}

function loadK12Rows_(tierMap, contactsMap, trackerMap) {
  const source = getK12Source_();
  const rows = source.rows;
  const idx = source.idx;
  const out = [];
  rows.forEach(function(raw){
    const org = cleanDisplay_(raw[idx.organization]);
    const state = cleanDisplay_(raw[idx.state_abbr] || raw[idx.loc_state]).toUpperCase();
    const localeRaw = cleanDisplay_(raw[idx.locale]);
    const localeCode = localeCodeValue_(localeRaw);
    if (!org || !state || !localeCode || localeCode < 11 || localeCode > 43) return;
    const key = state + '|' + slugify_(org);
    const tier = tierMap[key] || null;
    const contact = contactsMap[key] || null;
    const tracker = trackerMap[key] || {};
    const students = numericText_(raw[idx.students]);
    const schoolCount = numericText_(raw[idx.school_count]);
    out.push({
      externalKey: key,
      tier_short: tier ? String(tier.tier_short || '') : 'All K-12',
      tier_label: tier ? String(tier.tier_label || '') : 'All K-12 (Locales 11–43)',
      tier_order: tier ? (String(tier.tier_short) === 'Tier 1' ? 1 : String(tier.tier_short) === 'Tier 2' ? 2 : 0) : 0,
      segment: 'K-12 District',
      role_fit: 'Spoke Candidate',
      organization: org,
      region: CONFIG.REGION_MAP[state] || '',
      state: state,
      state_name: cleanDisplay_(raw[idx.state_name]),
      city: cleanDisplay_(raw[idx.city]),
      county: cleanDisplay_(raw[idx.county]),
      city_county: [cleanDisplay_(raw[idx.city]), cleanDisplay_(raw[idx.county])].filter(Boolean).join(' / '),
      locale_code: localeCode,
      locale_display: localeRaw,
      saipe_numeric: tier && tier.saipe_numeric !== '' && tier.saipe_numeric != null ? Number(tier.saipe_numeric) : null,
      saipe_display: tier && tier.saipe_percent ? String(tier.saipe_percent) : '',
      basis: tier ? String(tier.basis || '') : ('Live K-12 source; Locale ' + localeCode),
      superintendent_contact: contact ? String(contact.superintendent_contact || '') : '',
      other_contacts: contact ? String(contact.other_contacts_summary || '') : '',
      phone: cleanDisplay_(raw[idx.phone]),
      website: cleanDisplay_(raw[idx.website]),
      students: students ? Number(students) : '',
      school_count: schoolCount ? Number(schoolCount) : '',
      outreach_program: '',
      status: String(tracker.status || ''),
      assigned_to: String(tracker.assigned_to || ''),
      notes: String(tracker.notes || ''),
      updatedAt: String(tracker.updatedAt || ''),
      key_state: CONFIG.KEY_STATES.indexOf(state) > -1 ? 'Round 1 Callouts' : ''
    });
  });
  return out;
}

function loadHigherEdRows_(trackerMap) {
  const sheet = requireSheet_(CONFIG.HIGHERED_SHEET);
  const rows = sheetToObjects_(sheet);
  return rows.map(function(r){
    const key = String(r.externalKey || '');
    const tracker = trackerMap[key] || {};
    return {
      externalKey: key,
      tier_short: String(r.tier_short || ''),
      tier_label: String(r.tier_label || ''),
      tier_order: Number(r.tier_order || 3),
      segment: String(r.segment || 'Higher Ed'),
      role_fit: String(r.role_fit || ''),
      organization: String(r.organization || ''),
      region: String(r.region || (CONFIG.REGION_MAP[r.state] || '')),
      state: String(r.state || ''),
      state_name: String(r.state_name || ''),
      city: String(r.city || ''),
      county: String(r.county || ''),
      city_county: String(r.city_county || [r.city, r.county].filter(Boolean).join(' / ')),
      locale_code: localeCodeValue_(String(r.locale_display || r.locale_code || '')),
      locale_display: String(r.locale_display || r.locale_code || ''),
      saipe_numeric: r.saipe_numeric === '' || r.saipe_numeric == null ? null : Number(r.saipe_numeric),
      saipe_display: String(r.saipe_display || ''),
      basis: String(r.basis || ''),
      superintendent_contact: '',
      other_contacts: String(r.outreach_program || ''),
      phone: String(r.phone || ''),
      website: String(r.website || ''),
      students: String(r.students || ''),
      school_count: String(r.school_count || ''),
      outreach_program: String(r.outreach_program || ''),
      status: String(tracker.status || ''),
      assigned_to: String(tracker.assigned_to || ''),
      notes: String(tracker.notes || ''),
      updatedAt: String(tracker.updatedAt || ''),
      key_state: CONFIG.KEY_STATES.indexOf(String(r.state || '')) > -1 ? 'Round 1 Callouts' : ''
    };
  });
}

function getTierMap_() {
  const sheet = requireSheet_(CONFIG.K12_TIERMAP_SHEET);
  const rows = sheetToObjects_(sheet);
  const out = {};
  rows.forEach(function(r){
    const key = String(r.externalKey || '').trim();
    if (!key) return;
    out[key] = {
      tier_short: String(r.tier_short || ''),
      tier_label: String(r.tier_label || ''),
      basis: String(r.basis || ''),
      saipe_numeric: r.saipe_numeric === '' || r.saipe_numeric == null ? null : Number(r.saipe_numeric),
      saipe_percent: String(r.saipe_percent || '')
    };
  });
  return out;
}

function getTier1ContactsMap_() {
  const sheet = requireSheet_(CONFIG.TIER1_CONTACTS_SHEET);
  const rows = sheetToObjects_(sheet);
  const out = {};
  rows.forEach(function(r){
    const key = String(r.externalKey || '').trim();
    if (!key) return;
    out[key] = {
      superintendent_contact: String(r.superintendent_contact || ''),
      other_contacts_summary: String(r.other_contacts_summary || ''),
      contact_count: String(r.contact_count || '')
    };
  });
  return out;
}

function getTrackerMap_() {
  const sheet = ensureTrackerSheet_();
  const rows = sheetToObjects_(sheet);
  const out = {};
  rows.forEach(function(r){
    const key = String(r.externalKey || '').trim();
    if (!key) return;
    out[key] = {
      status: String(r.status || ''),
      assigned_to: String(r.assigned_to || ''),
      notes: String(r.notes || ''),
      updatedAt: String(r.updatedAt || '')
    };
  });
  return out;
}

function upsertTrackerRow_(payload) {
  const sheet = ensureTrackerSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0].map(String) : ['externalKey','status','assigned_to','notes','updatedAt'];
  if (!values.length) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
  }
  let rowIndex = -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === payload.externalKey) {
      rowIndex = i + 1;
      break;
    }
  }
  const rowValues = [[payload.externalKey, payload.status, payload.assigned_to, payload.notes, payload.updatedAt]];
  if (rowIndex > -1) {
    sheet.getRange(rowIndex,1,1,5).setValues(rowValues);
  } else {
    sheet.appendRow(rowValues[0]);
  }
  SpreadsheetApp.flush();
}

function ensureTrackerSheet_() {
  const ss = getAppSpreadsheet_();
  let sheet = ss.getSheetByName(CONFIG.TRACKER_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.TRACKER_SHEET);
    sheet.getRange(1,1,1,5).setValues([['externalKey','status','assigned_to','notes','updatedAt']]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function requireSheet_(name) {
  const sheet = getAppSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Missing required tab "' + name + '" in the app spreadsheet.');
  return sheet;
}

function getAppSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  const id = PropertiesService.getScriptProperties().getProperty('APP_SPREADSHEET_ID');
  if (!id) throw new Error('Open Apps Script from the app spreadsheet or set APP_SPREADSHEET_ID in script properties.');
  return SpreadsheetApp.openById(id);
}

function sheetToObjects_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return [];
  const headers = values[0].map(function(h){ return String(h || '').trim(); });
  return values.slice(1).filter(function(row){
    return row.some(function(v){ return String(v || '').trim() !== ''; });
  }).map(function(row){
    const o = {};
    headers.forEach(function(h, i){ o[h] = row[i]; });
    return o;
  });
}

function getK12Source_() {
  const ss = SpreadsheetApp.openById(CONFIG.K12_SOURCE_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.K12_SOURCE_SHEET_NAME) || ss.getSheets()[0];
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0];
  const rows = values.slice(1).map(function(r){
    const o = {};
    headers.forEach(function(h,i){ o[h] = r[i]; });
    return o;
  });
  const idx = detectK12Columns_(headers);
  return {sheet:sheet, headers:headers, rows:rows, idx:idx};
}

function detectK12Columns_(headers) {
  function find(patterns){
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i] || '');
      for (var p = 0; p < patterns.length; p++) {
        if (patterns[p].test(h)) return h;
      }
    }
    return '';
  }
  return {
    state_name: find([/State Name \[District\]/i]),
    state_abbr: find([/State Abbr \[District\]/i]),
    organization: find([/Agency Name \[District\]/i]),
    nces_id: find([/Agency ID - NCES Assigned/i]),
    county: find([/County Name \[District\]/i]),
    website: find([/Web Site URL \[District\]/i]),
    city: find([/Location City \[District\]/i]),
    loc_state: find([/Location State Abbr \[District\]/i]),
    phone: find([/Phone Number \[District\]/i]),
    agency_type: find([/Agency Type \[District\]/i]),
    locale: find([/Locale \[District\]/i]),
    students: find([/Total Number Of Students \[District\]/i]),
    school_count: find([/Number Of Schools \[District\]/i])
  };
}

function localeCodeValue_(localeRaw) {
  var m = String(localeRaw || '').match(/(\d{2})/);
  return m ? Number(m[1]) : 0;
}

function numericText_(value) {
  return String(value || '').replace(/[^0-9]/g,'');
}

function cleanDisplay_(value) {
  return String(value == null ? '' : value).trim();
}

function slugify_(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function prettifyLabel_(key) {
  return String(key || '').replace(/_/g,' ').replace(/\b\w/g, function(m){ return m.toUpperCase(); });
}
