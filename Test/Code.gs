
const CONFIG = {
  APP_SPREADSHEET_ID: '',
  ASSIGNMENTS_SHEET: 'Assignments',
  HIGHER_ED_SHEET: 'HigherEd',
  K12_TIERMAP_SHEET: 'K12_TierMap',
  K12_SOURCE_SPREADSHEET_ID: '1eDW0C7vnnfT7dOjQIk-EHAWeFNdI2iYeiXxH6uy3hfY',
  K12_SOURCE_SHEET_NAME: '',
  STATUS_OPTIONS: ['Not Started', 'Researching', 'Assigned', 'Attempted', 'Contacted', 'Meeting Scheduled', 'Qualified', 'Nurture', 'Closed'],
  TIER_FILTERS: [
    { key: 'all_k12', shortLabel: 'All K-12', label: 'All K-12 (Locales 11–43)', color: '#2759c7', description: 'Shows every K-12 district from the linked source sheet with locale codes 11 through 43, including city, suburban, town, and rural districts.' },
    { key: 'tier1', shortLabel: 'Tier 1', label: 'Tier 1: K-12 Rural Remote, >30% SAIPE', color: '#0f766e', description: 'Highest-priority K-12 call-out list: Rural Remote districts (Locale 43) with SAIPE poverty at 30% or greater.' },
    { key: 'tier2', shortLabel: 'Tier 2', label: 'Tier 2: K-12 Rural Remote / SAIPE Unknown', color: '#9a6700', description: 'Rural Remote K-12 districts (Locale 43) where SAIPE is not currently matched. These are secondary call-out candidates pending poverty confirmation.' },
    { key: 'tier3', shortLabel: 'Tier 3', label: 'Tier 3: HigherEd Rural Remote', color: '#6941c6', description: 'Higher-ed hub candidates in Rural Remote settings, used to identify possible hub institutions that can support rural spokes.' },
    { key: 'tier4', shortLabel: 'Tier 4', label: 'Tier 4: Higher Ed Rural Outreach', color: '#475467', description: 'Confirmed higher-ed institutions with rural outreach programs that may be strong hub, partner, or relationship-building targets.' }
  ],
  REGION_MAP: {
    'KY':'Mid-Atlantic','MD':'Mid-Atlantic','TN':'Mid-Atlantic','VA':'Mid-Atlantic','WV':'Mid-Atlantic',
    'CT':'Northeast','DE':'Northeast','IL':'Northeast','IN':'Northeast','IA':'Northeast','KS':'Northeast','ME':'Northeast','MA':'Northeast','MI':'Northeast','MN':'Northeast','MO':'Northeast','NE':'Northeast','NH':'Northeast','NJ':'Northeast','NY':'Northeast','ND':'Northeast','OH':'Northeast','PA':'Northeast','RI':'Northeast','SD':'Northeast','VT':'Northeast','WI':'Northeast',
    'AL':'Southeast','AR':'Southeast','FL':'Southeast','GA':'Southeast','LA':'Southeast','MS':'Southeast','NC':'Southeast','SC':'Southeast',
    'AK':'West','AZ':'West','CA':'West','CO':'West','HI':'West','ID':'West','MT':'West','NV':'West','NM':'West','OK':'West','OR':'West','TX':'West','UT':'West','WA':'West','WY':'West'
  }
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('RUS DLT Prospecting Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setConfig(appSpreadsheetId, appSheetNames, sourceSpreadsheetId, sourceSheetName) {
  if (!appSpreadsheetId) throw new Error('App spreadsheet ID is required.');
  const props = PropertiesService.getScriptProperties();
  props.setProperty('APP_SPREADSHEET_ID', appSpreadsheetId);
  const names = appSheetNames || {};
  props.setProperty('ASSIGNMENTS_SHEET', names.assignments || CONFIG.ASSIGNMENTS_SHEET);
  props.setProperty('HIGHER_ED_SHEET', names.higherEd || CONFIG.HIGHER_ED_SHEET);
  props.setProperty('K12_TIERMAP_SHEET', names.k12TierMap || CONFIG.K12_TIERMAP_SHEET);
  props.setProperty('K12_SOURCE_SPREADSHEET_ID', sourceSpreadsheetId || CONFIG.K12_SOURCE_SPREADSHEET_ID);
  props.setProperty('K12_SOURCE_SHEET_NAME', sourceSheetName || CONFIG.K12_SOURCE_SHEET_NAME);
  initializeAppSheets();
  return getSetupSummary();
}

function initializeAppSheets() {
  const ss = getAppSpreadsheet_();
  getOrCreateSheet_(ss, getProp_('ASSIGNMENTS_SHEET', CONFIG.ASSIGNMENTS_SHEET), [
    'externalKey','assignedRep','status','lastContact','nextStep','notes','updatedAt'
  ]);
  getOrCreateSheet_(ss, getProp_('HIGHER_ED_SHEET', CONFIG.HIGHER_ED_SHEET), [
    'tier_label','tier_order','segment','role_fit','organization','state','state_name','city','county','locale_display','locale_code',
    'saipe_percent','saipe_numeric','basis','contact_name','contact_title','phone','website','outreach_program','outreach_link',
    'flags','assignedRep','status','lastContact','nextStep','notes','externalKey','region','type','tier_short','tier_full',
    'city_county','saipe_display','basis_flags','contact_display'
  ]);
  getOrCreateSheet_(ss, getProp_('K12_TIERMAP_SHEET', CONFIG.K12_TIERMAP_SHEET), [
    'externalKey','organization','state','locale_code','saipe_numeric','saipe_percent','basis','tier_short','tier_label'
  ]);
  return { ok: true };
}

function getSetupSummary() {
  const appId = getProp_('APP_SPREADSHEET_ID', CONFIG.APP_SPREADSHEET_ID);
  return {
    ok: true,
    appSpreadsheetId: appId,
    assignmentsSheet: getProp_('ASSIGNMENTS_SHEET', CONFIG.ASSIGNMENTS_SHEET),
    higherEdSheet: getProp_('HIGHER_ED_SHEET', CONFIG.HIGHER_ED_SHEET),
    k12TierMapSheet: getProp_('K12_TIERMAP_SHEET', CONFIG.K12_TIERMAP_SHEET),
    k12SourceSpreadsheetId: getProp_('K12_SOURCE_SPREADSHEET_ID', CONFIG.K12_SOURCE_SPREADSHEET_ID),
    k12SourceSheetName: getProp_('K12_SOURCE_SHEET_NAME', CONFIG.K12_SOURCE_SHEET_NAME) || '(first sheet)'
  };
}

function getInitialPayload() {
  initializeAppSheets();
  const assignments = getAssignmentsMap_();
  const tierMap = getK12TierMap_();
  const k12 = loadK12Rows_(assignments, tierMap);
  const higherEd = loadHigherEdRows_(assignments);
  const rows = k12.concat(higherEd);
  return {
    rows: rows,
    config: {
      statusOptions: CONFIG.STATUS_OPTIONS,
      tierFilters: CONFIG.TIER_FILTERS,
      setup: getSetupSummary(),
      generatedAt: new Date().toISOString()
    }
  };
}

function saveRecord(payload) {
  if (!payload || !payload.externalKey) throw new Error('Missing externalKey.');
  const normalized = sanitizeEditablePayload_(payload);
  upsertAssignment_(payload.externalKey, normalized);
  const refreshedAssignments = getAssignmentsMap_();
  const assignment = refreshedAssignments[payload.externalKey] || {};
  return { ok: true, record: Object.assign({ externalKey: payload.externalKey }, assignment) };
}

function bulkAssign(payload) {
  if (!payload || !payload.externalKeys || !payload.externalKeys.length) throw new Error('No filtered rows were provided.');
  const normalized = sanitizeEditablePayload_(payload);
  const hasAny = Object.keys(normalized).length > 0;
  if (!hasAny) throw new Error('Provide at least one editable field.');
  payload.externalKeys.forEach(function(key) { upsertAssignment_(String(key), normalized); });
  return { ok: true, count: payload.externalKeys.length };
}

function getRecordDetail(externalKey) {
  if (!externalKey) throw new Error('Missing externalKey.');
  if (String(externalKey).indexOf('he-') === 0 || String(externalKey).indexOf('3-') === 0 || String(externalKey).indexOf('4-') === 0) {
    return getHigherEdDetail_(externalKey);
  }
  return getK12Detail_(externalKey);
}

function getK12Detail_(externalKey) {
  const parsed = parseK12ExternalKey_(externalKey);
  const source = getK12SourceValues_();
  const values = source.values;
  const headers = source.headers;
  const idx = source.indexMap;

  for (var i = source.dataStartRow; i < values.length; i += 1) {
    const row = values[i];
    const name = cleanDisplay_(row[idx.agencyName]);
    if (!name) continue;
    const state = cleanDisplay_(row[idx.stateAbbr]);
    const nces = cleanDisplay_(row[idx.ncesId]);
    const key = makeK12ExternalKey_(state, nces, name);
    if (key === externalKey) {
      const fields = [];
      headers.forEach(function(header, c) {
        const value = cleanDisplay_(row[c]);
        if (value !== '') fields.push({ label: header, value: value });
      });
      return {
        ok: true,
        title: name,
        subtitle: 'K-12 source record',
        externalKey: externalKey,
        fields: fields
      };
    }
  }
  throw new Error('K-12 detail record not found for ' + externalKey);
}

function getHigherEdDetail_(externalKey) {
  const sheet = getSheetByConfiguredName_('HIGHER_ED_SHEET', CONFIG.HIGHER_ED_SHEET);
  const objects = sheetToObjects_(sheet);
  const row = objects.find(function(r) { return String(r.externalKey) === String(externalKey); });
  if (!row) throw new Error('Higher-ed detail record not found for ' + externalKey);
  const fields = Object.keys(row)
    .filter(function(k) { return row[k] !== '' && row[k] !== null && row[k] !== undefined; })
    .map(function(k) { return { label: prettifyLabel_(k), value: row[k] }; });
  return { ok: true, title: row.organization || 'Higher-ed record', subtitle: row.tier_label || 'Higher-ed source record', externalKey: externalKey, fields: fields };
}

function loadK12Rows_(assignments, tierMap) {
  const source = getK12SourceValues_();
  const values = source.values;
  const idx = source.indexMap;
  const rows = [];

  for (var i = source.dataStartRow; i < values.length; i += 1) {
    const row = values[i];
    const organization = cleanDisplay_(row[idx.agencyName]);
    if (!organization) continue;
    const state = cleanDisplay_(row[idx.stateAbbr]);
    const localeDisplay = cleanDisplay_(row[idx.locale]);
    const localeCode = parseLocaleCode_(localeDisplay);
    if (localeCode < 11 || localeCode > 43) continue;

    const ncesId = cleanDisplay_(row[idx.ncesId]);
    const externalKey = makeK12ExternalKey_(state, ncesId, organization);
    const mapRow = tierMap[externalKey] || tierMap[state + '||' + organization.toUpperCase()] || null;
    const assignment = assignments[externalKey] || {};

    const tierShort = mapRow ? mapRow.tier_short : 'All K-12';
    const tierLabel = mapRow ? mapRow.tier_label : 'All K-12 (Locales 11-43)';
    const tierOrder = mapRow ? (tierShort === 'Tier 1' ? 1 : 2) : 0;
    const saipeNumeric = mapRow && mapRow.saipe_numeric !== '' ? Number(mapRow.saipe_numeric) : '';
    const saipeDisplay = mapRow && mapRow.saipe_percent !== '' ? String(mapRow.saipe_percent) + '%' : '';
    const city = cleanDisplay_(row[idx.city]);
    const county = cleanDisplay_(row[idx.county]);
    const cityCounty = [city, county].filter(Boolean).join(' / ');
    const phone = formatPhone_(cleanDisplay_(row[idx.phone]));
    const website = cleanDisplay_(row[idx.website]);
    const agencyType = cleanDisplay_(row[idx.agencyType]);
    const stateName = cleanDisplay_(row[idx.stateName]);
    const studentCount = cleanDisplay_(row[idx.studentCount]);
    const schoolCount = cleanDisplay_(row[idx.schoolCount]);
    const region = CONFIG.REGION_MAP[state] || 'Unassigned';
    const basis = mapRow ? mapRow.basis : ('Locale ' + localeCode + ' from K-12 source');
    const contactTitle = 'District Contact';

    rows.push({
      externalKey: externalKey,
      source_type: 'k12',
      tier_short: tierShort,
      tier_label: tierLabel,
      tier_order: tierOrder,
      segment: 'School District',
      role_fit: localeCode === 43 ? 'Spoke Candidate' : 'K-12 District',
      organization: organization,
      organization_link_text: organization,
      state: state,
      state_name: stateName,
      region: region,
      city: city,
      county: county,
      city_county: cityCounty,
      locale_code: localeCode,
      locale_display: localeDisplay,
      saipe_numeric: saipeNumeric,
      saipe_display: saipeDisplay,
      basis_flags: basis,
      phone: phone,
      website: website,
      contact_display: contactTitle,
      contact_name: '',
      contact_title: contactTitle,
      outreach_program: '',
      assignedRep: assignment.assignedRep || '',
      status: assignment.status || 'Not Started',
      lastContact: assignment.lastContact || '',
      nextStep: assignment.nextStep || '',
      notes: assignment.notes || '',
      agency_type: agencyType,
      total_students: studentCount,
      school_count: schoolCount,
      nces_id: ncesId
    });
  }
  return rows;
}

function loadHigherEdRows_(assignments) {
  const sheet = getSheetByConfiguredName_('HIGHER_ED_SHEET', CONFIG.HIGHER_ED_SHEET);
  const rows = sheetToObjects_(sheet);
  return rows.map(function(r) {
    const assignment = assignments[r.externalKey] || {};
    return {
      externalKey: r.externalKey,
      source_type: 'highered',
      tier_short: r.tier_short || (String(r.tier_order) === '3' ? 'Tier 3' : 'Tier 4'),
      tier_label: r.tier_label || '',
      tier_order: Number(r.tier_order || 3),
      segment: r.segment || 'Higher Education',
      role_fit: r.role_fit || '',
      organization: r.organization || '',
      organization_link_text: r.organization || '',
      state: r.state || '',
      state_name: r.state_name || '',
      region: r.region || (CONFIG.REGION_MAP[r.state] || 'Unassigned'),
      city: r.city || '',
      county: r.county || '',
      city_county: r.city_county || [r.city, r.county].filter(Boolean).join(' / '),
      locale_code: r.locale_code || '',
      locale_display: r.locale_display || '',
      saipe_numeric: r.saipe_numeric || '',
      saipe_display: r.saipe_display || (r.saipe_percent ? String(r.saipe_percent) + '%' : ''),
      basis_flags: r.basis_flags || r.basis || '',
      phone: formatPhone_(r.phone || ''),
      website: r.website || '',
      contact_display: r.contact_display || [r.contact_name, r.contact_title].filter(Boolean).join(' / '),
      contact_name: r.contact_name || '',
      contact_title: r.contact_title || '',
      outreach_program: r.outreach_program || '',
      assignedRep: assignment.assignedRep || r.assignedRep || '',
      status: assignment.status || r.status || 'Not Started',
      lastContact: assignment.lastContact || r.lastContact || '',
      nextStep: assignment.nextStep || r.nextStep || '',
      notes: assignment.notes || r.notes || '',
      agency_type: r.type || '',
      total_students: '',
      school_count: ''
    };
  });
}

function getK12TierMap_() {
  const sheet = getSheetByConfiguredName_('K12_TIERMAP_SHEET', CONFIG.K12_TIERMAP_SHEET);
  const rows = sheetToObjects_(sheet);
  const map = {};
  rows.forEach(function(r) {
    const externalKey = String(r.externalKey || '').trim();
    if (externalKey) map[externalKey] = r;
    const org = String(r.organization || '').trim().toUpperCase();
    const state = String(r.state || '').trim();
    if (state && org) map[state + '||' + org] = r;
  });
  return map;
}

function getAssignmentsMap_() {
  const sheet = getSheetByConfiguredName_('ASSIGNMENTS_SHEET', CONFIG.ASSIGNMENTS_SHEET);
  const rows = sheetToObjects_(sheet);
  const map = {};
  rows.forEach(function(r) {
    const key = String(r.externalKey || '').trim();
    if (!key) return;
    map[key] = {
      assignedRep: r.assignedRep || '',
      status: r.status || '',
      lastContact: r.lastContact || '',
      nextStep: r.nextStep || '',
      notes: r.notes || '',
      updatedAt: r.updatedAt || ''
    };
  });
  return map;
}

function upsertAssignment_(externalKey, values) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSheetByConfiguredName_('ASSIGNMENTS_SHEET', CONFIG.ASSIGNMENTS_SHEET);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(String);
    const idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });
    let rowNumber = null;
    for (var i = 1; i < data.length; i += 1) {
      if (String(data[i][idx.externalKey]) === String(externalKey)) {
        rowNumber = i + 1;
        break;
      }
    }
    if (!rowNumber) {
      rowNumber = sheet.getLastRow() + 1;
      sheet.getRange(rowNumber, 1, 1, headers.length).setValues([headers.map(function() { return ''; })]);
      sheet.getRange(rowNumber, idx.externalKey + 1).setValue(externalKey);
    }
    Object.keys(values).forEach(function(key) {
      if (idx[key] !== undefined) sheet.getRange(rowNumber, idx[key] + 1).setValue(values[key]);
    });
    if (idx.updatedAt !== undefined) sheet.getRange(rowNumber, idx.updatedAt + 1).setValue(new Date().toISOString());
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function sanitizeEditablePayload_(payload) {
  const fields = ['assignedRep','status','lastContact','nextStep','notes'];
  const out = {};
  fields.forEach(function(f) {
    if (Object.prototype.hasOwnProperty.call(payload, f)) out[f] = payload[f] == null ? '' : String(payload[f]);
  });
  return out;
}

function getK12SourceValues_() {
  const sourceId = getProp_('K12_SOURCE_SPREADSHEET_ID', CONFIG.K12_SOURCE_SPREADSHEET_ID);
  const sourceName = getProp_('K12_SOURCE_SHEET_NAME', CONFIG.K12_SOURCE_SHEET_NAME);
  const ss = SpreadsheetApp.openById(sourceId);
  const sheet = sourceName ? ss.getSheetByName(sourceName) : ss.getSheets()[0];
  if (!sheet) throw new Error('K-12 source sheet not found.');
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) throw new Error('K-12 source sheet is empty.');
  const headerRowIndex = findHeaderRowIndex_(values);
  const headers = values[headerRowIndex].map(function(v) { return String(v).trim(); });
  const indexMap = buildK12IndexMap_(headers);
  return { values: values, headers: headers, dataStartRow: headerRowIndex + 1, indexMap: indexMap };
}

function buildK12IndexMap_(headers) {
  return {
    agencyName: findHeaderIndex_(headers, ['Agency Name [District]', 'Agency Name']),
    stateName: findHeaderIndex_(headers, ['State Name [District] 2024-25', 'State Name [District] Latest available year', 'State Name']),
    stateAbbr: findHeaderIndex_(headers, ['Location State Abbr [District] 2024-25', 'State Abbr [District] Latest available year', 'Location State Abbr', 'State Abbr']),
    ncesId: findHeaderIndex_(headers, ['Agency ID - NCES Assigned [District] Latest available year', 'Agency ID - NCES Assigned', 'Agency ID']),
    county: findHeaderIndex_(headers, ['County Name [District] 2024-25', 'County Name']),
    website: findHeaderIndex_(headers, ['Web Site URL [District] 2024-25', 'Web Site URL']),
    city: findHeaderIndex_(headers, ['Location City [District] 2024-25', 'Location City']),
    phone: findHeaderIndex_(headers, ['Phone Number [District] 2024-25', 'Phone Number']),
    agencyType: findHeaderIndex_(headers, ['Agency Type [District] 2024-25', 'Agency Type']),
    locale: findHeaderIndex_(headers, ['Locale [District] 2024-25', 'Locale']),
    studentCount: findHeaderIndex_(headers, ['Total Students All Grades (Excludes AE) [District] 2024-25', 'Total Students All Grades']),
    schoolCount: findHeaderIndex_(headers, ['Total Number Operational Schools [Public School] 2024-25', 'Total Number Operational Schools'])
  };
}

function findHeaderRowIndex_(values) {
  for (var r = 0; r < Math.min(values.length, 20); r += 1) {
    const joined = values[r].join(' || ');
    if (joined.indexOf('Agency Name') !== -1 && joined.indexOf('Locale') !== -1) return r;
  }
  return 0;
}

function findHeaderIndex_(headers, candidates) {
  for (var i = 0; i < candidates.length; i += 1) {
    for (var c = 0; c < headers.length; c += 1) {
      if (String(headers[c]).trim() === candidates[i]) return c;
    }
  }
  for (var i2 = 0; i2 < candidates.length; i2 += 1) {
    for (var c2 = 0; c2 < headers.length; c2 += 1) {
      if (String(headers[c2]).indexOf(candidates[i2]) !== -1) return c2;
    }
  }
  return -1;
}

function getAppSpreadsheet_() {
  const id = getProp_('APP_SPREADSHEET_ID', CONFIG.APP_SPREADSHEET_ID);
  if (!id) throw new Error('App spreadsheet ID is not configured. Run setConfig(appSpreadsheetId, ...) first.');
  return SpreadsheetApp.openById(id);
}

function getSheetByConfiguredName_(propKey, fallback) {
  const ss = getAppSpreadsheet_();
  const name = getProp_(propKey, fallback);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function getOrCreateSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
  } else if (sheet.getLastRow() >= 1 && sheet.getLastColumn() < headers.length) {
    const existing = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
    const merged = headers.slice();
    const needsReset = existing.join('|') !== merged.slice(0, existing.length).join('|');
    if (needsReset) sheet.getRange(1,1,1,headers.length).setValues([headers]);
  }
  return sheet;
}

function sheetToObjects_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1)
    .filter(function(row) { return row.join('') !== ''; })
    .map(function(row) {
      const obj = {};
      headers.forEach(function(h, idx) { obj[h] = cleanDisplay_(row[idx]); });
      return obj;
    });
}

function parseLocaleCode_(localeText) {
  const match = String(localeText || '').match(/(\d{2})/);
  return match ? Number(match[1]) : -1;
}

function makeK12ExternalKey_(state, ncesId, organization) {
  const base = ncesId ? String(ncesId).replace(/\s+/g,'') : slugify_(organization);
  return 'k12-' + String(state || '').toLowerCase() + '-' + base.toLowerCase();
}

function parseK12ExternalKey_(key) {
  const parts = String(key).split('-');
  return { state: parts[1] || '', tail: parts.slice(2).join('-') || '' };
}

function slugify_(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function formatPhone_(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return '(' + digits.substring(0,3) + ') ' + digits.substring(3,6) + '-' + digits.substring(6);
  return String(value || '');
}

function cleanDisplay_(value) {
  return String(value == null ? '' : value).replace(/\u2020/g, '').trim();
}

function prettifyLabel_(key) {
  return String(key || '').replace(/_/g, ' ').replace(/\b\w/g, function(m) { return m.toUpperCase(); });
}

function getProp_(key, fallback) {
  return PropertiesService.getScriptProperties().getProperty(key) || fallback;
}
