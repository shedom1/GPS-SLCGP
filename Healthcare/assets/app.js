(function(){
  const CONFIG = window.FQHC_TRACKER_CONFIG || {};
  const API_URL = (CONFIG.API_URL || '').trim();
  const STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
  const REGIONS = {
    'Mid-Atlantic':['KY','MD','TN','VA','WV'],
    'Northeast':['CT','DE','IL','IN','IA','KS','ME','MA','MI','MN','MO','NE','NH','NJ','NY','ND','OH','PA','RI','SD','VT','WI'],
    'Southeast':['AL','AR','FL','GA','LA','MS','NC','SC'],
    'West':['AK','AZ','CA','CO','HI','ID','MT','NV','NM','OK','OR','TX','UT','WA','WY']
  };
  const REGION_BY_STATE = Object.entries(REGIONS).reduce((acc,[r,states])=>{states.forEach(s=>acc[s]=r);return acc;},{});
  const RUCA_CODES = ['1','2','3','4','5','6','7','8','9','10','99','Unknown'];
  const NOTE_FIELDS = ['contact_name','contact_email','assigned_to','status','priority','next_followup','notes'];
  const DEFAULT_STATUS = 'Not Started';
  const DEFAULT_PRIORITY = '';

  let records = [];
  let filtered = [];
  let page = 1;
  let sourceStatus = [];
  const notesDraft = new Map();

  const $ = id => document.getElementById(id);
  const els = {
    setupWarning:$('setupWarning'), statusPanel:$('statusPanel'), message:$('message'),
    loadBtn:$('loadBtn'), refreshBtn:$('refreshBtn'), exportBtn:$('exportBtn'), printBtn:$('printBtn'),
    searchInput:$('searchInput'), regionFilter:$('regionFilter'), stateFilter:$('stateFilter'), ruralFilter:$('ruralFilter'), statusFilter:$('statusFilter'),
    sortBy:$('sortBy'), viewMode:$('viewMode'), pageSize:$('pageSize'), clearFiltersBtn:$('clearFiltersBtn'), rucaOptions:$('rucaOptions'),
    tableView:$('tableView'), cardView:$('cardView'), dataTable:$('dataTable'), cardTemplate:$('cardTemplate'),
    prevPage:$('prevPage'), nextPage:$('nextPage'), pageInfo:$('pageInfo'),
    metricTotal:$('metricTotal'), metricFiltered:$('metricFiltered'), metricRural:$('metricRural'), metricFollowup:$('metricFollowup')
  };

  init();

  function init(){
    renderStaticFilters();
    attachEvents();
    if(!API_URL){
      els.setupWarning.classList.remove('hidden');
      showMessage('Admin setup needed: paste the deployed Apps Script Web App URL into config.js. The tracker will not use sample rows or manual source mapping.');
    } else {
      els.setupWarning.classList.add('hidden');
      loadData();
    }
  }

  function renderStaticFilters(){
    Object.keys(REGIONS).forEach(r=>els.regionFilter.append(new Option(r,r)));
    STATES.forEach(s=>els.stateFilter.append(new Option(s,s)));
    RUCA_CODES.forEach(code=>{
      const label = document.createElement('label');
      label.className = 'checkpill';
      label.innerHTML = `<input type="checkbox" value="${escapeHtml(code)}"> ${escapeHtml(code)}`;
      els.rucaOptions.appendChild(label);
    });
  }

  function attachEvents(){
    ['searchInput','regionFilter','stateFilter','ruralFilter','statusFilter','sortBy','viewMode','pageSize'].forEach(id=>{
      els[id].addEventListener('input',()=>{ page=1; applyFilters(); });
      els[id].addEventListener('change',()=>{ page=1; applyFilters(); });
    });
    els.rucaOptions.addEventListener('change',()=>{ page=1; applyFilters(); });
    els.clearFiltersBtn.addEventListener('click',clearFilters);
    els.loadBtn.addEventListener('click',loadData);
    els.refreshBtn.addEventListener('click',refreshSources);
    els.exportBtn.addEventListener('click',exportCsv);
    els.printBtn.addEventListener('click',()=>window.print());
    els.prevPage.addEventListener('click',()=>{ if(page>1){page--; render();} });
    els.nextPage.addEventListener('click',()=>{ const pages=pageCount(); if(page<pages){page++; render();} });
  }

  async function loadData(){
    if(!API_URL) return;
    try{
      setBusy(true,'Loading normalized FQHC data...');
      const res = await apiGet({action:'prospects'});
      if(!res || !Array.isArray(res.records)) throw new Error('The API did not return a records array. Check the Apps Script deployment and permissions.');
      records = res.records.map(normalizeClientRecord);
      sourceStatus = res.status || [];
      records.forEach(r=>notesDraft.set(r.record_id, pick(r, NOTE_FIELDS)));
      renderStatus();
      applyFilters();
      showMessage(`Loaded ${records.length.toLocaleString()} records. Source mapping was handled by Apps Script.`);
    }catch(err){
      showMessage(`Load failed: ${err.message || err}. Open README.md and confirm the Apps Script Web App is deployed as “Anyone with the link.”`, true);
    }finally{
      setBusy(false);
    }
  }

  async function refreshSources(){
    if(!API_URL) return;
    try{
      setBusy(true,'Refreshing HRSA/CMS/RUCA/FORHP sources in Apps Script...');
      const res = await apiGet({action:'refresh'});
      sourceStatus = res.status || [];
      renderStatus();
      showMessage(res.message || 'Refresh complete. Reloading data...');
      await loadData();
    }catch(err){
      showMessage(`Refresh failed: ${err.message || err}. This usually means Apps Script authorization or source URL access needs to be approved by the admin.`, true);
    }finally{
      setBusy(false);
    }
  }

  function applyFilters(){
    const q = norm(els.searchInput.value);
    const region = els.regionFilter.value;
    const state = els.stateFilter.value;
    const rural = els.ruralFilter.value;
    const status = els.statusFilter.value;
    const selectedRuca = new Set([...els.rucaOptions.querySelectorAll('input:checked')].map(i=>i.value));
    filtered = records.filter(r=>{
      const note = notesDraft.get(r.record_id) || {};
      if(region && r.region !== region) return false;
      if(state && r.state !== state) return false;
      if(rural === 'yes' && !r.is_rural) return false;
      if(rural === 'no' && r.is_rural) return false;
      if(status && (note.status || r.status || DEFAULT_STATUS) !== status) return false;
      if(selectedRuca.size){
        const val = r.ruca_primary || 'Unknown';
        if(!selectedRuca.has(String(val))) return false;
      }
      if(q){
        const blob = [r.name,r.organization_name,r.site_type,r.address,r.city,r.state,r.zip,r.county,r.phone,r.website,r.cms_legal_name,r.cms_owner_name,note.contact_name,note.contact_email,note.assigned_to,note.status,note.priority,note.notes].join(' ').toLowerCase();
        if(!blob.includes(q)) return false;
      }
      return true;
    });
    sortFiltered();
    renderMetrics();
    render();
  }

  function sortFiltered(){
    const key = els.sortBy.value;
    filtered.sort((a,b)=>{
      const na = notesDraft.get(a.record_id) || {}, nb = notesDraft.get(b.record_id) || {};
      const va = sortValue(a, na, key), vb = sortValue(b, nb, key);
      return String(va).localeCompare(String(vb), undefined, {numeric:true, sensitivity:'base'});
    });
  }

  function sortValue(r,n,key){
    if(key === 'priority_sort') return priorityRank(n.priority || r.priority);
    if(key === 'rural_sort') return r.is_rural ? '0' : '1';
    if(key === 'next_followup') return n.next_followup || r.next_followup || '9999-12-31';
    return r[key] || '';
  }

  function priorityRank(p){ return ({High:'0',Medium:'1',Low:'2'}[p] || '9') + (p||''); }

  function render(){
    const view = els.viewMode.value;
    els.tableView.classList.toggle('hidden', view !== 'table');
    els.cardView.classList.toggle('hidden', view !== 'cards');
    if(view === 'table') renderTable(); else renderCards();
    renderPager();
  }

  function currentPageRows(){
    const size = parseInt(els.pageSize.value,10) || 100;
    const start = (page-1)*size;
    return filtered.slice(start, start+size);
  }
  function pageCount(){ return Math.max(1, Math.ceil(filtered.length / (parseInt(els.pageSize.value,10) || 100))); }

  function renderPager(){
    const pages = pageCount();
    if(page > pages) page = pages;
    els.pageInfo.textContent = `Page ${filtered.length ? page : 0} of ${filtered.length ? pages : 0} — ${filtered.length.toLocaleString()} filtered`;
    els.prevPage.disabled = page <= 1;
    els.nextPage.disabled = page >= pages;
  }

  function renderTable(){
    const headers = ['Name','Region','State','City','ZIP','RUCA','Rural','Type','Phone','Website','Contact Name','Contact Email','Assigned To','Status','Priority','Next Follow-up','Notes','Save'];
    els.dataTable.tHead.innerHTML = `<tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
    const rows = currentPageRows().map(r=>{
      const n = notesDraft.get(r.record_id) || {};
      return `<tr data-id="${escapeHtml(r.record_id)}">
        <td class="cell-name">${escapeHtml(r.name)}<br><small>${escapeHtml(r.organization_name || '')}</small></td>
        <td class="cell-small">${regionChip(r.region)}</td>
        <td class="cell-small">${escapeHtml(r.state)}</td>
        <td class="cell-med">${escapeHtml(r.city)}</td>
        <td class="cell-small">${escapeHtml(r.zip)}</td>
        <td class="cell-small">${escapeHtml(r.ruca_primary || 'Unknown')}</td>
        <td class="cell-small">${r.is_rural ? '<span class="chip chip-rural">Rural</span>' : '<span class="chip chip-urban">No/Unknown</span>'}</td>
        <td class="cell-med">${escapeHtml(r.site_type || '')}</td>
        <td class="cell-med">${escapeHtml(r.phone || '')}</td>
        <td class="cell-med">${linkify(r.website)}</td>
        <td>${inputHtml(r,'contact_name',n.contact_name)}</td>
        <td>${inputHtml(r,'contact_email',n.contact_email,'email')}</td>
        <td>${inputHtml(r,'assigned_to',n.assigned_to)}</td>
        <td>${selectHtml(r,'status',n.status || DEFAULT_STATUS,['Not Started','Researching','Contacted','Follow Up','Qualified','Not a Fit','Do Not Contact'])}</td>
        <td>${selectHtml(r,'priority',n.priority || DEFAULT_PRIORITY,['','High','Medium','Low'])}</td>
        <td>${inputHtml(r,'next_followup',n.next_followup,'date')}</td>
        <td>${textareaHtml(r,'notes',n.notes)}</td>
        <td><button class="btn small save-row">Save</button></td>
      </tr>`;
    }).join('');
    els.dataTable.tBodies[0].innerHTML = rows || `<tr><td colspan="18">No records match the current filters.</td></tr>`;
    els.dataTable.tBodies[0].querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('input',onNoteEdit));
    els.dataTable.tBodies[0].querySelectorAll('.save-row').forEach(btn=>btn.addEventListener('click',saveRowFromButton));
  }

  function renderCards(){
    els.cardView.innerHTML = '';
    const rows = currentPageRows();
    if(!rows.length){ els.cardView.innerHTML = '<p>No records match the current filters.</p>'; return; }
    rows.forEach(r=>{
      const n = notesDraft.get(r.record_id) || {};
      const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
      setText(node,'name',r.name);
      setText(node,'subtitle',[r.organization_name,r.site_type].filter(Boolean).join(' • '));
      const chip = node.querySelector('[data-field="region_chip"]'); chip.outerHTML = regionChip(r.region);
      setText(node,'location',`${r.address ? r.address + ', ' : ''}${r.city || ''}, ${r.state || ''} ${r.zip || ''}`.trim());
      setText(node,'ruca',r.ruca_primary || 'Unknown');
      setText(node,'rural',r.is_rural ? 'Rural / likely rural' : 'No / unknown');
      setText(node,'phone',r.phone || '');
      node.querySelector('[data-field="website"]').innerHTML = linkify(r.website);
      setText(node,'cms',[r.cms_legal_name,r.cms_owner_name].filter(Boolean).join(' / '));
      const noteGrid = node.querySelector('.note-grid');
      noteGrid.innerHTML = `
        ${fieldBlock(r,'Contact Name','contact_name',n.contact_name)}
        ${fieldBlock(r,'Email','contact_email',n.contact_email,'email')}
        ${fieldBlock(r,'Assigned To','assigned_to',n.assigned_to)}
        <label>Status${selectHtml(r,'status',n.status || DEFAULT_STATUS,['Not Started','Researching','Contacted','Follow Up','Qualified','Not a Fit','Do Not Contact'])}</label>
        <label>Priority${selectHtml(r,'priority',n.priority || DEFAULT_PRIORITY,['','High','Medium','Low'])}</label>
        ${fieldBlock(r,'Next Follow-up','next_followup',n.next_followup,'date')}
        <label>Notes${textareaHtml(r,'notes',n.notes)}</label>
        <button class="btn small save-row" data-id="${escapeHtml(r.record_id)}">Save Notes</button>`;
      noteGrid.querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('input',onNoteEdit));
      noteGrid.querySelector('.save-row').addEventListener('click',saveRowFromButton);
      els.cardView.appendChild(node);
    });
  }

  function onNoteEdit(e){
    const id = e.target.dataset.id || e.target.closest('[data-id]')?.dataset.id;
    const field = e.target.dataset.noteField;
    if(!id || !field) return;
    const note = notesDraft.get(id) || {};
    note[field] = e.target.value;
    notesDraft.set(id, note);
  }

  function saveRowFromButton(e){
    const id = e.target.dataset.id || e.target.closest('[data-id]')?.dataset.id;
    if(!id) return;
    const note = notesDraft.get(id) || {};
    saveNote(id, note, e.target);
  }

  async function saveNote(recordId, note, button){
    if(!API_URL) return;
    const old = button ? button.textContent : '';
    if(button){ button.textContent = 'Saving...'; button.disabled = true; }
    try{
      await apiPostNoCors({action:'saveNote', record_id:recordId, note:note});
      if(button){ button.textContent = 'Saved'; setTimeout(()=>{button.textContent=old || 'Save'; button.disabled=false;},900); }
    }catch(err){
      if(button){ button.textContent = 'Retry'; button.disabled=false; }
      showMessage(`Save failed for ${recordId}: ${err.message || err}`, true);
    }
  }

  function inputHtml(r,field,value,type='text'){
    return `<input class="inline-input" type="${type}" data-id="${escapeHtml(r.record_id)}" data-note-field="${field}" value="${escapeAttr(value||'')}">`;
  }
  function textareaHtml(r,field,value){
    return `<textarea class="inline-textarea" data-id="${escapeHtml(r.record_id)}" data-note-field="${field}">${escapeHtml(value||'')}</textarea>`;
  }
  function selectHtml(r,field,value,opts){
    return `<select class="inline-select" data-id="${escapeHtml(r.record_id)}" data-note-field="${field}">${opts.map(o=>`<option value="${escapeAttr(o)}" ${String(o)===String(value)?'selected':''}>${escapeHtml(o || '—')}</option>`).join('')}</select>`;
  }
  function fieldBlock(r,label,field,value,type='text'){ return `<label>${escapeHtml(label)}${inputHtml(r,field,value,type)}</label>`; }
  function setText(root,field,text){ root.querySelector(`[data-field="${field}"]`).textContent = text || ''; }

  function renderStatus(){
    const cards = (sourceStatus || []).map(s=>{
      const cls = s.ok ? 'status-ok' : (s.warning ? 'status-warn' : 'status-bad');
      return `<div class="status-card ${cls}"><strong>${escapeHtml(s.name || 'Source')}</strong><span>${escapeHtml(s.message || '')}${s.count!==undefined ? `\nRows: ${Number(s.count).toLocaleString()}` : ''}${s.refreshed_at ? `\n${escapeHtml(s.refreshed_at)}` : ''}</span></div>`;
    }).join('');
    els.statusPanel.innerHTML = cards || '<div class="status-card status-warn"><strong>No status yet</strong><span>Click Load Data or Refresh Sources.</span></div>';
  }

  function renderMetrics(){
    const due = filtered.filter(r=>{
      const d = (notesDraft.get(r.record_id)||{}).next_followup;
      return d && d <= todayISO();
    }).length;
    els.metricTotal.textContent = records.length.toLocaleString();
    els.metricFiltered.textContent = filtered.length.toLocaleString();
    els.metricRural.textContent = filtered.filter(r=>r.is_rural).length.toLocaleString();
    els.metricFollowup.textContent = due.toLocaleString();
  }

  function clearFilters(){
    els.searchInput.value=''; els.regionFilter.value=''; els.stateFilter.value=''; els.ruralFilter.value=''; els.statusFilter.value=''; els.sortBy.value='state';
    els.rucaOptions.querySelectorAll('input').forEach(i=>i.checked=false); page=1; applyFilters();
  }

  function exportCsv(){
    const headers = ['Record_ID','Region','State','Name','Organization','Type','Street','City','ZIP','County','RUCA_Primary','RUCA_Secondary','Rural','Phone','Website','CMS_Legal_Name','CMS_DBA','CMS_Owner_Name','Contact_Name','Contact_Email','Assigned_To','Status','Priority','Next_Followup','Notes'];
    const lines = [headers.join(',')];
    filtered.forEach(r=>{
      const n = notesDraft.get(r.record_id) || {};
      const vals = [r.record_id,r.region,r.state,r.name,r.organization_name,r.site_type,r.address,r.city,r.zip,r.county,r.ruca_primary,r.ruca_secondary,r.is_rural?'Yes':'No/Unknown',r.phone,r.website,r.cms_legal_name,r.cms_dba,r.cms_owner_name,n.contact_name,n.contact_email,n.assigned_to,n.status,n.priority,n.next_followup,n.notes];
      lines.push(vals.map(csvEscape).join(','));
    });
    const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `fqhc_prospects_${todayISO()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  function normalizeClientRecord(r){
    const zip = cleanZip(r.zip || r.site_zip || '');
    const state = (r.state || '').toUpperCase();
    const region = r.region || REGION_BY_STATE[state] || 'Other';
    const ruca = String(r.ruca_primary || r.ruca || 'Unknown').replace(/\.0$/,'') || 'Unknown';
    const isRural = !!(r.is_rural === true || String(r.is_rural).toLowerCase() === 'true' || String(r.rural || '').match(/yes|rural|eligible|likely/i) || ruca === '10' || ['7','8','9'].includes(ruca));
    return {
      record_id: r.record_id || `${state}-${zip}-${norm(r.name || r.site_name || '').slice(0,40)}`,
      name: r.name || r.site_name || r.cms_dba || r.cms_legal_name || 'Unnamed Site',
      organization_name: r.organization_name || r.awardee_name || '',
      site_type: r.site_type || r.type || '',
      address: r.address || r.street || '',
      city: r.city || '', state, zip, region,
      county: r.county || '', phone: r.phone || '', website: r.website || '',
      ruca_primary: ruca, ruca_secondary: r.ruca_secondary || '', is_rural: isRural,
      cms_legal_name: r.cms_legal_name || '', cms_dba: r.cms_dba || '', cms_owner_name: r.cms_owner_name || '',
      contact_name: r.contact_name || '', contact_email: r.contact_email || '', assigned_to: r.assigned_to || '',
      status: r.status || DEFAULT_STATUS, priority: r.priority || '', next_followup: r.next_followup || '', notes: r.notes || ''
    };
  }

  function apiGet(params){
    // JSONP avoids CORS problems between GitHub Pages and Apps Script.
    return new Promise((resolve,reject)=>{
      const cb = '__fqhc_cb_' + Math.random().toString(36).slice(2);
      const timeout = setTimeout(()=>{ cleanup(); reject(new Error('API timeout')); }, 120000);
      function cleanup(){ clearTimeout(timeout); delete window[cb]; script.remove(); }
      window[cb] = data => { cleanup(); if(data && data.error) reject(new Error(data.error)); else resolve(data); };
      const qs = new URLSearchParams({...params, callback:cb, t:Date.now()}).toString();
      const script = document.createElement('script');
      script.onerror = () => { cleanup(); reject(new Error('Could not load Apps Script response. Check Web App URL and access setting.')); };
      script.src = `${API_URL}${API_URL.includes('?')?'&':'?'}${qs}`;
      document.body.appendChild(script);
    });
  }

  async function apiPostNoCors(payload){
    // Fire-and-forget save. Apps Script receives it; browser does not need a CORS-readable response.
    await fetch(API_URL, {method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload)});
    return true;
  }

  function setBusy(isBusy,msg){
    [els.loadBtn, els.refreshBtn].forEach(b=>b.disabled = isBusy);
    if(msg) showMessage(msg);
  }
  function showMessage(text,isError=false){
    els.message.textContent = text; els.message.classList.remove('hidden');
    els.message.style.background = isError ? '#fef2f2' : '#eef6ff';
    els.message.style.borderColor = isError ? '#fecaca' : '#bfdbfe';
    els.message.style.color = isError ? '#7f1d1d' : '#163b5c';
  }
  function regionChip(region){ const cls = 'region-' + String(region||'other').toLowerCase().replace(/[^a-z0-9]+/g,'-'); return `<span class="chip ${cls}">${escapeHtml(region||'Other')}</span>`; }
  function linkify(url){ if(!url) return ''; const u = /^https?:\/\//i.test(url) ? url : `https://${url}`; return `<a href="${escapeAttr(u)}" target="_blank" rel="noopener">Website</a>`; }
  function norm(s){ return String(s||'').trim().toLowerCase(); }
  function cleanZip(s){ const m = String(s||'').match(/\d{5}/); return m ? m[0] : String(s||'').trim(); }
  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function pick(obj,fields){ return fields.reduce((a,f)=>{a[f]=obj[f]||''; return a;},{}); }
  function csvEscape(v){ const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }
  function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function escapeAttr(s){ return escapeHtml(s).replace(/`/g,'&#096;'); }
})();
