(() => {
  const CFG = window.FQHC_TRACKER_CONFIG || {};
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const RUCAS = ['1','2','3','4','5','6','7','8','9','10','99','Unknown'];
  const state = {
    rawSites: [], rucaByZip: new Map(), forhpByZip: new Map(), cmsEnrollments: [], cmsOwners: [],
    records: [], filtered: [], page: 1, view: 'table', sortBy: 'state', sortDir: 'asc', notes: loadNotes(),
    sourceStatus: {}, manifest: null
  };

  const els = {
    statusPanel: $('#statusPanel'), statusTitle: $('#statusTitle'), statusText: $('#statusText'), noDataPanel: $('#noDataPanel'),
    metrics: $('#metrics'), sourceStatusGrid: $('#sourceStatusGrid'), lastUpdated: $('#lastUpdated'),
    search: $('#searchInput'), region: $('#regionFilter'), state: $('#stateFilter'), rural: $('#ruralFilter'), rucaChecks: $('#rucaChecks'), type: $('#typeFilter'), status: $('#statusFilter'), sortBy: $('#sortBy'), sortDir: $('#sortDir'),
    tableBody: $('#resultsTable tbody'), tableView: $('#tableView'), cardView: $('#cardView'), pageSize: $('#pageSize'), pageInfo: $('#pageInfo'), activeFilters: $('#activeFilters'),
    detailDialog: $('#detailDialog'), detailContent: $('#detailContent'), sourceDialog: $('#sourceDialog')
  };

  document.addEventListener('DOMContentLoaded', () => {
    wireEvents();
    initFilters();
    renderSourceStatus();
    renderAll();
  });

  function wireEvents(){
    $('#refreshBtn').addEventListener('click', loadData);
    $('#sourceBtn').addEventListener('click', () => els.sourceDialog.showModal());
    $('#printBtn').addEventListener('click', () => window.print());
    $('#exportBtn').addEventListener('click', exportFilteredCsv);
    $('#clearRucaBtn').addEventListener('click', () => { $$('#rucaChecks input').forEach(cb => cb.checked = false); state.page = 1; renderAll(); });
    $('#tableViewBtn').addEventListener('click', () => setView('table'));
    $('#cardViewBtn').addEventListener('click', () => setView('card'));
    $('#prevPage').addEventListener('click', () => { if(state.page > 1){ state.page--; renderResults(); } });
    $('#nextPage').addEventListener('click', () => { const max = maxPage(); if(state.page < max){ state.page++; renderResults(); } });
    [els.search, els.region, els.state, els.rural, els.type, els.status, els.sortBy, els.sortDir, els.pageSize].forEach(el => {
      ['input','change'].forEach(evt => el.addEventListener(evt, () => { state.sortBy = els.sortBy.value; state.sortDir = els.sortDir.value; state.page = 1; renderAll(); }));
    });
    els.rucaChecks.addEventListener('change', () => { state.page = 1; renderAll(); });
    $$('#resultsTable th[data-sort]').forEach(th => th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sortBy === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc'; else state.sortBy = key;
      els.sortBy.value = state.sortBy; els.sortDir.value = state.sortDir; state.page = 1; renderAll();
    }));
    $('#hrsaFile').addEventListener('change', e => handleCsvUpload(e, rows => { state.rawSites = rows; markStatus('HRSA Sites','loaded',`${rows.length.toLocaleString()} uploaded rows`); buildRecords(); renderAll(); setStatus('Loaded HRSA sites from upload', `${rows.length.toLocaleString()} rows loaded.`); }));
    $('#rucaFile').addEventListener('change', e => handleAnyTableUpload(e, rows => { state.rucaByZip = buildRucaMap(rows); markStatus('RUCA ZIP','loaded',`${state.rucaByZip.size.toLocaleString()} uploaded ZIP rows`); buildRecords(); renderAll(); setStatus('Loaded RUCA from upload', `${state.rucaByZip.size.toLocaleString()} ZIP rows loaded.`); }));
    $('#forhpFile').addEventListener('change', e => handleAnyTableUpload(e, rows => { state.forhpByZip = buildForhpMap(rows); markStatus('FORHP Rural ZIP','loaded',`${state.forhpByZip.size.toLocaleString()} uploaded ZIP rows`); buildRecords(); renderAll(); setStatus('Loaded FORHP rural ZIPs from upload', `${state.forhpByZip.size.toLocaleString()} ZIP rows loaded.`); }));
    $('#notesFile').addEventListener('change', e => handleCsvUpload(e, importNotes));
  }

  function initFilters(){
    fillSelect(els.region, ['All Regions', ...Object.keys(CFG.regions || {})], els.region.value);
    fillSelect(els.state, ['All States', ...allStates()], els.state.value);
    renderRucaChecks();
    fillSelect(els.type, ['All Types'], els.type.value);
    fillSelect(els.status, ['All Statuses', ...(CFG.statusOptions || [])], els.status.value);
  }

  function renderRucaChecks(){
    els.rucaChecks.innerHTML = RUCAS.map(code => `<label title="${escapeAttr(rucaDescription(code))}"><input type="checkbox" value="${escapeAttr(code)}"> ${escapeHtml(code)}</label>`).join('');
  }

  async function loadData(){
    setStatus('Loading local GitHub data...', 'Checking /data/ files first. This avoids browser CORS blocks from HRSA, CMS, USDA, and other outside domains.', true);
    resetStatuses();
    const files = CFG.localFiles || {};

    await loadManifest(files.manifestJson);
    await loadLocalCsv(files.hrsaSitesCsv, 'HRSA Sites').then(rows => { state.rawSites = rows; markStatus('HRSA Sites','loaded',`${rows.length.toLocaleString()} local rows`); }).catch(err => markStatus('HRSA Sites','missing',friendlyError(err)));
    await loadLocalCsv(files.rucaZipCsv, 'RUCA ZIP').then(rows => { state.rucaByZip = buildRucaMap(rows); markStatus('RUCA ZIP','loaded',`${state.rucaByZip.size.toLocaleString()} ZIPs`); }).catch(err => markStatus('RUCA ZIP','missing',friendlyError(err)));
    await loadLocalCsv(files.forhpZipCsv, 'FORHP Rural ZIP').then(rows => { state.forhpByZip = buildForhpMap(rows); markStatus('FORHP Rural ZIP','loaded',`${state.forhpByZip.size.toLocaleString()} ZIPs`); }).catch(err => markStatus('FORHP Rural ZIP','missing',friendlyError(err)));
    await loadLocalJson(files.cmsEnrollmentsJson, 'CMS Enrollments').then(rows => { state.cmsEnrollments = rows; markStatus('CMS Enrollments','loaded',`${rows.length.toLocaleString()} local rows`); }).catch(err => markStatus('CMS Enrollments','missing',friendlyError(err)));
    await loadLocalJson(files.cmsOwnersJson, 'CMS Owners').then(rows => { state.cmsOwners = rows; markStatus('CMS Owners','loaded',`${rows.length.toLocaleString()} local rows`); }).catch(err => markStatus('CMS Owners','missing',friendlyError(err)));

    if(!state.rawSites.length && CFG.browserRemoteFallback){
      await tryRemoteFallback();
    }

    buildRecords();
    renderAll();
    const loaded = state.records.length;
    const missing = Object.values(state.sourceStatus).filter(s => s.state !== 'loaded').length;
    if(loaded){
      setStatus('Data loaded', `${loaded.toLocaleString()} FQHC/site records loaded. ${missing ? `${missing} enrichment source(s) missing or not refreshed.` : 'All configured sources loaded.'}`);
    } else {
      setStatus('No official FQHC records loaded', 'The sample notes file is only a notes template. Run the GitHub Action/script to create data/hrsa_sites.csv, or upload the HRSA sites CSV manually.');
    }
  }

  async function loadManifest(path){
    if(!path) return;
    try {
      const manifest = await loadLocalJson(path, 'Manifest');
      state.manifest = manifest;
      els.lastUpdated.textContent = manifest?.refreshed_at ? `Data refreshed: ${manifest.refreshed_at}` : '';
      markStatus('Manifest','loaded',manifest?.refreshed_at || 'loaded');
    } catch(err){
      els.lastUpdated.textContent = '';
      markStatus('Manifest','missing','No refresh manifest found');
    }
  }

  async function tryRemoteFallback(){
    const urls = CFG.sourceUrls || {};
    try {
      const text = await fetchText(urls.hrsaSitesCsv, 'Remote HRSA Sites');
      state.rawSites = parseCsv(text);
      markStatus('HRSA Sites','loaded',`${state.rawSites.length.toLocaleString()} remote rows`);
    } catch(err){
      markStatus('HRSA Sites','failed',`Remote browser fetch failed: ${friendlyError(err)}`);
    }
  }

  async function loadLocalCsv(path, label){
    if(!path) throw new Error(`${label} path missing`);
    const text = await fetchText(path, label);
    return parseCsv(text);
  }

  async function loadLocalJson(path, label){
    if(!path) throw new Error(`${label} path missing`);
    const text = await fetchText(path, label);
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed;
  }

  async function fetchText(url, label){
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error(`${label}: ${res.status} ${res.statusText || ''}`.trim());
    return res.text();
  }

  function parseCsv(text){
    if(window.Papa){
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
      return parsed.data.filter(r => Object.values(r).some(v => String(v || '').trim()));
    }
    return fallbackCsvParse(text);
  }

  function fallbackCsvParse(text){
    const lines = String(text || '').split(/\r?\n/).filter(Boolean);
    const headers = splitCsvLine(lines.shift() || '');
    return lines.map(line => Object.fromEntries(splitCsvLine(line).map((v,i) => [headers[i] || `col_${i}`, v])));
  }
  function splitCsvLine(line){
    const out=[]; let cur='', q=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"' && line[i+1]==='"'){cur+='"'; i++; continue;}
      if(ch==='"'){q=!q; continue;}
      if(ch===',' && !q){out.push(cur); cur=''; continue;}
      cur+=ch;
    }
    out.push(cur); return out;
  }

  function parseWorkbook(arrayBuffer){
    if(!window.XLSX) throw new Error('SheetJS library not loaded');
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    for(const name of wb.SheetNames){
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
      if(rows.length) return rows;
    }
    return [];
  }

  function handleCsvUpload(e, cb){
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => cb(parseCsv(String(reader.result || '')));
    reader.readAsText(file);
  }

  function handleAnyTableUpload(e, cb){
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lower = file.name.toLowerCase();
      const rows = lower.endsWith('.csv') ? parseCsv(String(reader.result || '')) : parseWorkbook(reader.result);
      cb(rows);
    };
    if(file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file); else reader.readAsArrayBuffer(file);
  }

  function buildRecords(){
    const enrollmentIndex = buildEnrollmentIndex(state.cmsEnrollments);
    const ownerIndex = buildOwnerIndex(state.cmsOwners);
    state.records = state.rawSites.map(row => normalizeSite(row, enrollmentIndex, ownerIndex)).filter(r => r.name || r.zip || r.state);
    updateDynamicFilters();
  }

  function normalizeSite(row, enrollmentIndex, ownerIndex){
    const name = value(row, ['site_name','Site Name','SITE_NM','SiteName','Name','Site']);
    const org = value(row, ['hc_name','Health Center Name','Health Center','Grantee Name','Grantee Organization Name','Organization Name','Health Center Program Awardee Name','Awardee Name']);
    const type = value(row, ['site_type_desc','loc_type_desc','hc_type','Health Center Type','Site Type','Site Subtype','Health Center Program Type','Site Setting','SiteStatus']) || 'Health Center Site';
    const street = value(row, ['site_address','Site Address','Site Street Address','Address','Street Address','LOCATION_ADDRESS','Address Line 1']);
    const city = value(row, ['site_city','Site City','City','SITE_CITY','LOCATION_CITY']);
    const st = normalizeState(value(row, ['site_state','Site State','State','ST','LOCATION_STATE','Site State Abbreviation']));
    const zip = normalizeZip(value(row, ['site_zipcode','Site ZIP Code','Site ZIP','ZIP Code','Zip Code','ZIP','LOCATION_ZIP','Postal Code']));
    const county = value(row, ['site_county_full','site_county','Site County','County','County Name','COUNTY']);
    const phone = cleanPhone(value(row, ['site_phone','Telephone Number','Site Telephone Number','Phone','PHONE','Site Phone Number']));
    const website = cleanUrl(value(row, ['site_website','Site Web Address','Site Website','Web Address','Website','URL','Site URL']));
    const email = value(row, ['Email','E-mail','Contact Email','Site Email','Organization Email']);
    const hours = value(row, ['op_hrs_per_wk','Operating Hours per Week','Hours','Weekly Hours']);
    const hcNumber = value(row, ['hc_id','bhcmis_id','bphc_id','Health Center Number','Health Center ID','Grant Number','BHCMISID','BPHC Assigned Number']);
    const latitude = value(row, ['site_latitude','Latitude','LAT']);
    const longitude = value(row, ['site_longitude','Longitude','LON','LNG']);
    const region = regionForState(st);
    const ruca = state.rucaByZip.get(zip) || { code: '', description: '', source: '' };
    const forhp = state.forhpByZip.get(zip) || { rural: '', source: '' };
    const rural = deriveRural(forhp, ruca);
    const key = recordKey(st, zip, name || org, street);
    const note = state.notes[key] || {};
    const enrollment = enrollmentIndex.get(zipNameKey(zip, name || org)) || enrollmentIndex.get(zipNameKey(zip, org)) || null;
    const owner = ownerIndex.get(zipNameKey(zip, org || name)) || ownerIndex.get(zipNameKey(zip, name)) || null;
    return { key, sourceRow: row, name: name || org || 'Unnamed site', org, type, street, city, state: st, zip, county, phone, website, email, hours, hcNumber, region, latitude, longitude, rucaCode: ruca.code || '', rucaDescription: ruca.description || '', ruralStatus: rural.status, ruralSource: rural.source, enrollment, owner, note };
  }

  function buildRucaMap(rows){
    const map = new Map();
    rows.forEach(row => {
      const zip = normalizeZip(value(row, ['ZIP_CODE','ZIP Code','ZIP','ZCTA','Zip Code','ZIPCODE','zip','zip_code']));
      if(!zip) return;
      const codeRaw = value(row, ['RUCA1','RUCA Code','Primary RUCA Code','Primary RUCA code','RUCA_CODE','Primary RUCA','RUCA','ruca_primary_code','ZIP RUCA Code','primary_ruca_code','ruca_code']);
      const code = normalizeRuca(codeRaw);
      const desc = value(row, ['Primary RUCA Description','Classification Description','RUCA Description','Description','Primary RUCA code description','description','ruca_description']);
      map.set(zip, { code, description: desc || rucaDescription(code), source: 'USDA RUCA ZIP' });
    });
    return map;
  }

  function buildForhpMap(rows){
    const map = new Map();
    rows.forEach(row => {
      const zip = normalizeZip(value(row, ['ZIP Code','ZIP_CODE','ZIP','Zip','ZIPCODE','zip','zip_code']));
      if(!zip) return;
      const raw = value(row, ['FORHP Rural','FORHP_Rural','FORHP rural','Rural','Rural Status','Rural_Eligibility','FORHP Rural Approximation','Rural Flag','rural','rural_flag']);
      let rural = '';
      if(/yes|rural|eligible|true|1/i.test(String(raw))) rural = 'Yes';
      else if(/no|not|false|0/i.test(String(raw))) rural = 'No';
      map.set(zip, { rural, raw, source: 'HRSA FORHP ZIP Approximation' });
    });
    return map;
  }

  function buildEnrollmentIndex(rows){
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const zip = normalizeZip(value(row, ['ZIP Code','ZIP_CD','ZIP','PRACTICE_LOCATION_ZIP','LOCATION_ZIP','ADDRESS_ZIP','zip_code']));
      const name = value(row, ['ORGANIZATION_NAME','Legal Business Name','LBN','LEGAL_BUSINESS_NAME','DOING_BUSINESS_AS_NAME','Doing Business As Name','DBA Name','ASSOCIATE_NAME','organization_name']);
      if(zip && name) map.set(zipNameKey(zip, name), row);
    });
    return map;
  }

  function buildOwnerIndex(rows){
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const zip = normalizeZip(value(row, ['ZIP Code','ZIP_CD','ZIP','OWNER_ZIP','Ownership Address ZIP','ADDRESS_ZIP','zip_code']));
      const name = value(row, ['ORGANIZATION_NAME','OWNER_NAME','Ownership Name','Owner Name','ASSOCIATE_NAME','Legal Business Name','organization_name']);
      if(zip && name) map.set(zipNameKey(zip, name), row);
    });
    return map;
  }

  function deriveRural(forhp, ruca){
    if(forhp.rural === 'Yes') return { status: 'Rural', source: forhp.source };
    if(forhp.rural === 'No') return { status: 'Not Rural', source: forhp.source };
    const c = parseFloat(String(ruca.code || '').replace(/[^0-9.]/g,''));
    if(Number.isFinite(c)) return { status: c >= 4 && c <= 10 ? 'Rural' : 'Not Rural', source: 'Derived from RUCA code' };
    return { status: 'Unknown', source: 'No rural/RUCA match' };
  }

  function renderAll(){
    applyFilters(); renderMetrics(); renderResults(); renderActiveFilters(); renderSourceStatus();
    els.noDataPanel.classList.toggle('hidden', state.records.length > 0);
  }

  function applyFilters(){
    const q = els.search.value.trim().toLowerCase();
    const region = els.region.value;
    const st = els.state.value;
    const rural = els.rural.value;
    const selectedRuca = getSelectedRucaValues();
    const type = els.type.value;
    const status = els.status.value;
    state.filtered = state.records.filter(r => {
      const noteText = Object.values(r.note || {}).join(' ');
      const blob = [r.name,r.org,r.type,r.street,r.city,r.state,r.zip,r.county,r.phone,r.website,r.email,noteText,r.rucaCode,r.rucaDescription].join(' ').toLowerCase();
      if(q && !blob.includes(q)) return false;
      if(region && region !== 'All Regions' && r.region !== region) return false;
      if(st && st !== 'All States' && r.state !== st) return false;
      if(rural === 'rural' && r.ruralStatus !== 'Rural') return false;
      if(rural === 'not-rural' && r.ruralStatus !== 'Not Rural') return false;
      if(rural === 'unknown' && r.ruralStatus !== 'Unknown') return false;
      if(selectedRuca.length){
        const code = r.rucaCode ? String(r.rucaCode) : 'Unknown';
        if(!selectedRuca.includes(code)) return false;
      }
      if(type && type !== 'All Types' && r.type !== type) return false;
      const recStatus = r.note.status || 'New';
      if(status && status !== 'All Statuses' && recStatus !== status) return false;
      return true;
    });
    sortRecords(state.filtered);
  }

  function sortRecords(arr){
    const dir = state.sortDir === 'desc' ? -1 : 1;
    const key = state.sortBy;
    arr.sort((a,b) => {
      let av, bv;
      if(key === 'ruca'){ av = parseFloat(a.rucaCode || '999'); bv = parseFloat(b.rucaCode || '999'); return (av-bv)*dir || a.name.localeCompare(b.name); }
      if(key === 'followup'){ av = a.note.nextFollowup || '9999-99-99'; bv = b.note.nextFollowup || '9999-99-99'; return av.localeCompare(bv)*dir || a.name.localeCompare(b.name); }
      if(key === 'priority'){ av = priorityRank(a.note.priority); bv = priorityRank(b.note.priority); return (av-bv)*dir || a.name.localeCompare(b.name); }
      av = String(key === 'name' ? a.name : key === 'region' ? a.region : key === 'rural' ? a.ruralStatus : a.state || '').toLowerCase();
      bv = String(key === 'name' ? b.name : key === 'region' ? b.region : key === 'rural' ? b.ruralStatus : b.state || '').toLowerCase();
      return av.localeCompare(bv) * dir || a.name.localeCompare(b.name);
    });
  }
  function priorityRank(v){ return ({High:1,Medium:2,Low:3})[v] || 9; }

  function renderMetrics(){
    const total = state.filtered.length;
    const rural = state.filtered.filter(r => r.ruralStatus === 'Rural').length;
    const states = new Set(state.filtered.map(r => r.state).filter(Boolean)).size;
    const withPhone = state.filtered.filter(r => r.phone).length;
    const withWebsite = state.filtered.filter(r => r.website).length;
    const withEmail = state.filtered.filter(r => r.email || r.note.contactEmail).length;
    const cards = [['Filtered Sites', total], ['Rural / FORHP', rural], ['States', states], ['Phone Available', withPhone], ['Website Available', withWebsite], ['Email Available', withEmail]];
    els.metrics.innerHTML = cards.map(([label,val]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${Number(val).toLocaleString()}</strong></div>`).join('');
  }

  function renderResults(){
    const pageSize = parseInt(els.pageSize.value, 10) || 50;
    const max = maxPage(); if(state.page > max) state.page = max;
    const start = (state.page - 1) * pageSize;
    const rows = state.filtered.slice(start, start + pageSize);
    els.pageInfo.textContent = `${state.page} / ${max} • ${state.filtered.length.toLocaleString()} records`;
    if(state.view === 'table') renderTable(rows); else renderCards(rows);
  }

  function renderTable(rows){
    els.tableBody.innerHTML = rows.map(r => `
      <tr>
        <td>${regionChip(r.region)}</td>
        <td><strong>${escapeHtml(r.state || '')}</strong></td>
        <td class="name-cell"><strong>${escapeHtml(r.name)}</strong><span class="subtext">${escapeHtml(r.org || '')}</span><span class="subtext">${escapeHtml(r.street || '')}</span></td>
        <td>${ruralChip(r.ruralStatus)}<span class="subtext">${escapeHtml(r.ruralSource || '')}</span></td>
        <td><strong>${escapeHtml(r.rucaCode || '—')}</strong><span class="subtext">${escapeHtml(r.rucaDescription || '')}</span></td>
        <td>${escapeHtml(r.type || '')}</td>
        <td>${escapeHtml([r.city, r.county].filter(Boolean).join(' / '))}<span class="subtext">${escapeHtml(r.zip || '')}</span></td>
        <td class="contact-stack">${r.phone ? `<span>${escapeHtml(r.phone)}</span>` : ''}${(r.email || r.note.contactEmail) ? `<span>${escapeHtml(r.email || r.note.contactEmail)}</span>` : '<span class="subtext">Email not in source</span>'}${r.note.contactName ? `<span class="subtext">${escapeHtml(r.note.contactName)}</span>` : ''}</td>
        <td>${r.website ? `<a class="website-link" href="${escapeAttr(r.website)}" target="_blank" rel="noreferrer">Open site</a>` : '<span class="subtext">—</span>'}</td>
        <td>${statusChip(r.note.status || 'New')}<span class="subtext">${escapeHtml(r.note.priority || '')} ${escapeHtml(r.note.nextFollowup || '')}</span></td>
        <td class="table-actions no-print"><button type="button" data-detail="${escapeAttr(r.key)}">Open</button></td>
      </tr>`).join('') || `<tr><td colspan="11" class="subtext">No records match the current filters, or no official data has been loaded.</td></tr>`;
    els.tableBody.querySelectorAll('[data-detail]').forEach(btn => btn.addEventListener('click', () => openDetail(btn.dataset.detail)));
  }

  function renderCards(rows){
    els.cardView.innerHTML = rows.map(r => `
      <article class="card">
        <div class="meta">${regionChip(r.region)} ${ruralChip(r.ruralStatus)} ${statusChip(r.note.status || 'New')}</div>
        <h3>${escapeHtml(r.name)}</h3>
        <p class="muted">${escapeHtml(r.org || '')}</p>
        <p>${escapeHtml([r.street, r.city, r.state, r.zip].filter(Boolean).join(', '))}</p>
        <p><strong>RUCA:</strong> ${escapeHtml(r.rucaCode || '—')} <span class="muted">${escapeHtml(r.rucaDescription || '')}</span></p>
        <p><strong>Contact:</strong> ${escapeHtml([r.phone, r.email || r.note.contactEmail].filter(Boolean).join(' • ') || 'Email not in source')}</p>
        <p><strong>Follow-up:</strong> ${escapeHtml(r.note.nextFollowup || '—')} ${r.note.priority ? `• ${escapeHtml(r.note.priority)}` : ''}</p>
        <div class="card-actions no-print"><button type="button" data-detail="${escapeAttr(r.key)}">Open Details</button></div>
      </article>`).join('') || `<p class="muted">No cards match the current filters, or no official data has been loaded.</p>`;
    els.cardView.querySelectorAll('[data-detail]').forEach(btn => btn.addEventListener('click', () => openDetail(btn.dataset.detail)));
  }

  function openDetail(key){
    const r = state.records.find(x => x.key === key); if(!r) return;
    const n = r.note || {};
    els.detailContent.innerHTML = `
      <h2>${escapeHtml(r.name)}</h2>
      <p class="muted">${escapeHtml(r.org || '')}</p>
      <div class="detail-grid">
        <section class="detail-box">
          <h3>Official source fields</h3>
          ${detailLine('Address', [r.street,r.city,r.state,r.zip].filter(Boolean).join(', '))}
          ${detailLine('County', r.county)}${detailLine('Phone', r.phone)}${detailLine('Website', r.website ? `<a href="${escapeAttr(r.website)}" target="_blank" rel="noreferrer">${escapeHtml(r.website)}</a>` : '—')}${detailLine('Source Email', r.email || 'Not in source')}${detailLine('Hours', r.hours)}${detailLine('Health Center ID', r.hcNumber)}
        </section>
        <section class="detail-box">
          <h3>Prospecting context</h3>
          ${detailLine('Region', r.region)}${detailLine('Rural Status', `${r.ruralStatus} — ${r.ruralSource}`)}${detailLine('RUCA', `${r.rucaCode || '—'} ${r.rucaDescription || ''}`)}${detailLine('CMS Enrollment Match', r.enrollment ? 'Possible match loaded' : 'No match loaded')}${detailLine('CMS Ownership Match', r.owner ? 'Possible match loaded' : 'No match loaded')}${detailLine('Lat / Long', [r.latitude,r.longitude].filter(Boolean).join(', '))}
        </section>
      </div>
      <section class="detail-box" style="margin-top:12px">
        <h3>Rep prospecting notes</h3>
        <div class="detail-form" data-note-form="${escapeAttr(r.key)}">
          <label>Contact Name <input name="contactName" value="${escapeAttr(n.contactName || '')}" placeholder="Verified contact name" /></label>
          <label>Email <input name="contactEmail" value="${escapeAttr(n.contactEmail || '')}" placeholder="Verified email" /></label>
          <label>Assigned To <input name="assignedTo" value="${escapeAttr(n.assignedTo || '')}" placeholder="Rep" /></label>
          <label>Status <select name="status">${(CFG.statusOptions || []).map(s => `<option ${s === (n.status || 'New') ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select></label>
          <label>Priority <select name="priority"><option ${!n.priority ? 'selected' : ''}></option>${(CFG.priorityOptions || []).map(p => `<option ${p === n.priority ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}</select></label>
          <label>Next Follow-up <input type="date" name="nextFollowup" value="${escapeAttr(n.nextFollowup || '')}" /></label>
          <textarea name="notes" placeholder="Notes, outreach result, solution fit, buyer titles, source of email...">${escapeHtml(n.notes || '')}</textarea>
        </div>
        <p class="hint">Notes save automatically to this browser. Use Export CSV to preserve/share, and Rep Notes CSV Import to reload.</p>
      </section>`;
    els.detailDialog.showModal();
    els.detailContent.querySelectorAll('[data-note-form] input, [data-note-form] select, [data-note-form] textarea').forEach(input => {
      input.addEventListener('input', saveDetailForm);
      input.addEventListener('change', saveDetailForm);
    });
  }

  function saveDetailForm(e){
    const form = e.target.closest('[data-note-form]');
    const key = form.dataset.noteForm;
    const data = Object.fromEntries($$('input,select,textarea').filter(el => form.contains(el)).map(el => [el.name, el.value]));
    state.notes[key] = data;
    saveNotes(state.notes);
    const rec = state.records.find(r => r.key === key); if(rec) rec.note = data;
    renderAll();
  }

  function updateDynamicFilters(){
    const current = els.type.value;
    const types = [...new Set(state.records.map(r => r.type).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    fillSelect(els.type, ['All Types', ...types], current);
  }

  function setView(view){
    state.view = view;
    $('#tableViewBtn').classList.toggle('active', view === 'table');
    $('#cardViewBtn').classList.toggle('active', view === 'card');
    els.tableView.classList.toggle('hidden', view !== 'table');
    els.cardView.classList.toggle('hidden', view !== 'card');
    renderResults();
  }

  function maxPage(){ return Math.max(1, Math.ceil(state.filtered.length / (parseInt(els.pageSize.value, 10) || 50))); }

  function renderActiveFilters(){
    const parts = [];
    if(els.search.value.trim()) parts.push(`Search: ${els.search.value.trim()}`);
    for(const [label, el, all] of [['Region', els.region, 'All Regions'], ['State', els.state, 'All States'], ['Type', els.type, 'All Types'], ['Status', els.status, 'All Statuses']]) if(el.value && el.value !== all) parts.push(`${label}: ${el.value}`);
    const selectedRuca = getSelectedRucaValues();
    if(selectedRuca.length) parts.push(`RUCA: ${selectedRuca.join(', ')}`);
    if(els.rural.value !== 'all') parts.push(`Rural: ${els.rural.options[els.rural.selectedIndex].text}`);
    els.activeFilters.innerHTML = parts.length ? `<strong>Active filters:</strong> ${parts.map(p => `<span class="chip unknown">${escapeHtml(p)}</span>`).join(' ')}` : '';
  }

  function exportFilteredCsv(){
    const rows = state.filtered.map(r => ({
      Key:r.key, Region:r.region, State:r.state, Name:r.name, Organization:r.org, Type:r.type, Rural:r.ruralStatus, Rural_Source:r.ruralSource, RUCA:r.rucaCode, RUCA_Description:r.rucaDescription,
      Street:r.street, City:r.city, County:r.county, ZIP:r.zip, Phone:r.phone, Website:r.website, Source_Email:r.email, Latitude:r.latitude, Longitude:r.longitude,
      Contact_Name:r.note.contactName || '', Contact_Email:r.note.contactEmail || '', Assigned_To:r.note.assignedTo || '', Status:r.note.status || 'New', Priority:r.note.priority || '', Next_Followup:r.note.nextFollowup || '', Notes:r.note.notes || ''
    }));
    const csv = window.Papa ? Papa.unparse(rows) : fallbackCsvStringify(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fqhc_prospect_lookup_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function fallbackCsvStringify(rows){
    const headers = Object.keys(rows[0] || {});
    const esc = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
    return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
  }

  function importNotes(rows){
    let count = 0;
    rows.forEach(row => {
      const key = row.Key || recordKey(normalizeState(row.State), normalizeZip(row.ZIP), row.Name || row.Organization, row.Street);
      if(!key) return;
      state.notes[key] = {
        contactName: row.Contact_Name || row.contactName || '', contactEmail: row.Contact_Email || row.contactEmail || '', assignedTo: row.Assigned_To || row.assignedTo || '', status: row.Status || 'New', priority: row.Priority || '', nextFollowup: row.Next_Followup || row.nextFollowup || '', notes: row.Notes || row.notes || ''
      };
      count++;
    });
    saveNotes(state.notes); buildRecords(); renderAll(); setStatus('Imported rep notes', `${count.toLocaleString()} note rows imported.`);
  }

  function resetStatuses(){
    state.sourceStatus = {
      'Manifest': { state:'missing', msg:'Not checked' },
      'HRSA Sites': { state:'missing', msg:'Not checked' },
      'RUCA ZIP': { state:'missing', msg:'Not checked' },
      'FORHP Rural ZIP': { state:'missing', msg:'Not checked' },
      'CMS Enrollments': { state:'missing', msg:'Not checked' },
      'CMS Owners': { state:'missing', msg:'Not checked' }
    };
    renderSourceStatus();
  }
  function markStatus(label, status, msg){ state.sourceStatus[label] = { state: status, msg }; renderSourceStatus(); }
  function renderSourceStatus(){
    const entries = Object.entries(state.sourceStatus).length ? Object.entries(state.sourceStatus) : Object.entries({
      'Manifest': { state:'missing', msg:'Not loaded' }, 'HRSA Sites': { state:'missing', msg:'Not loaded' }, 'RUCA ZIP': { state:'missing', msg:'Not loaded' }, 'FORHP Rural ZIP': { state:'missing', msg:'Not loaded' }, 'CMS Enrollments': { state:'missing', msg:'Not loaded' }, 'CMS Owners': { state:'missing', msg:'Not loaded' }
    });
    els.sourceStatusGrid.innerHTML = entries.map(([name, s]) => `<div class="source-pill ${escapeAttr(s.state)}"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(s.msg || s.state)}</span></div>`).join('');
  }

  function value(row, candidates){
    if(!row) return '';
    const keys = Object.keys(row);
    for(const c of candidates){
      if(Object.prototype.hasOwnProperty.call(row, c) && row[c] !== null && row[c] !== undefined && String(row[c]).trim() !== '') return String(row[c]).trim();
      const found = keys.find(k => norm(k) === norm(c));
      if(found && String(row[found] || '').trim() !== '') return String(row[found]).trim();
    }
    return '';
  }

  function norm(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]/g,''); }
  function normalizeZip(v){ const s = String(v || '').trim(); const m = s.match(/\d{5}/); return m ? m[0] : ''; }
  function normalizeState(v){ return String(v || '').trim().toUpperCase().slice(0,2); }
  function normalizeRuca(v){ const s = String(v || '').trim(); const m = s.match(/99|10|[1-9](?:\.\d+)?/); return m ? String(Math.trunc(parseFloat(m[0]))) : ''; }
  function cleanPhone(v){ const s = String(v || '').trim(); return s.replace(/\.0$/,''); }
  function cleanUrl(v){ let s = String(v || '').trim(); if(!s) return ''; if(!/^https?:\/\//i.test(s)) s = 'https://' + s; return s; }
  function rucaDescription(code){ return ({'1':'Metropolitan core','2':'Metropolitan high commuting','3':'Metropolitan low commuting','4':'Micropolitan core','5':'Micropolitan high commuting','6':'Micropolitan low commuting','7':'Small town core','8':'Small town high commuting','9':'Small town low commuting','10':'Rural area','99':'Not coded','Unknown':'No RUCA match loaded'})[String(code)] || ''; }
  function recordKey(st, zip, name, street=''){ return [st || '', zip || '', slug(name || ''), slug(street || '')].join('|'); }
  function zipNameKey(zip, name){ return `${zip}|${slug(name)}`; }
  function slug(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,80); }
  function regionForState(st){ for(const [region, states] of Object.entries(CFG.regions || {})) if(states.includes(st)) return region; return 'Unassigned'; }
  function allStates(){ return [...new Set(Object.values(CFG.regions || {}).flat())].sort(); }
  function fillSelect(sel, values, current=''){
    const existing = current || sel.value;
    sel.innerHTML = values.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join('');
    if(existing && values.includes(existing)) sel.value = existing;
  }
  function getSelectedRucaValues(){ return $$('#rucaChecks input:checked').map(cb => cb.value); }
  function setStatus(title, text, loading=false){ els.statusTitle.textContent = title; els.statusText.textContent = text || ''; els.statusPanel.classList.toggle('loading', !!loading); }
  function friendlyError(err){ return String(err?.message || err || '').replace(/^.*?: /,'').slice(0,110) || 'missing'; }
  function regionChip(region){ return `<span class="chip region-${escapeAttr(region || '').replace(/\s/g,'-')}">${escapeHtml(region || 'Unassigned')}</span>`; }
  function ruralChip(status){ const c = status === 'Rural' ? 'rural' : status === 'Not Rural' ? 'not-rural' : 'unknown'; return `<span class="chip ${c}">${escapeHtml(status || 'Unknown')}</span>`; }
  function statusChip(status){ return `<span class="chip status">${escapeHtml(status || 'New')}</span>`; }
  function detailLine(label, value){ return `<p><strong>${escapeHtml(label)}:</strong> ${String(value || '—')}</p>`; }
  function escapeHtml(s){ return String(s ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
  function escapeAttr(s){ return escapeHtml(s).replace(/'/g,'&#39;'); }
  function loadNotes(){ try { return JSON.parse(localStorage.getItem('fqhcTrackerNotes') || '{}'); } catch { return {}; } }
  function saveNotes(notes){ localStorage.setItem('fqhcTrackerNotes', JSON.stringify(notes)); }
})();
