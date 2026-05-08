let STATES=[], PROSPECTS=[], CATEGORIES=[], STATE=null, filtered=[], mode='table';
let prospectSort = { col: 3, dir: 'asc' };

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']
];
const REGION_BY_ABBR = {
  DE:'Northeast',KY:'Mid-Atlantic',MD:'Mid-Atlantic',TN:'Mid-Atlantic',VA:'Mid-Atlantic',WV:'Mid-Atlantic',
  CT:'Northeast',IL:'Northeast',IN:'Northeast',IA:'Northeast',KS:'Northeast',ME:'Northeast',MA:'Northeast',MI:'Northeast',MN:'Northeast',MO:'Northeast',NE:'Northeast',NH:'Northeast',NJ:'Northeast',NY:'Northeast',ND:'Northeast',OH:'Northeast',PA:'Northeast',RI:'Northeast',SD:'Northeast',VT:'Northeast',WI:'Northeast',
  AL:'Southeast',AR:'Southeast',FL:'Southeast',GA:'Southeast',LA:'Southeast',MS:'Southeast',NC:'Southeast',SC:'Southeast',
  AK:'West',AZ:'West',CA:'West',CO:'West',HI:'West',ID:'West',MT:'West',NV:'West',NM:'West',OK:'West',OR:'West',TX:'West',UT:'West',WA:'West',WY:'West',DC:'Northeast'
};
const STATUS_TYPES = ['Not Started','Researching','Call Scheduled','Contacted','Interested','Not a fit','Do not contact'];
const COLLATOR = new Intl.Collator('en', {numeric:true, sensitivity:'base'});
const fmt = new Intl.NumberFormat('en-US');
const $ = sel => document.querySelector(sel); const $$ = sel => Array.from(document.querySelectorAll(sel));

function esc(v){return String(v??'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function link(url,text){return url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text||url)}</a>`:'—';}
function statusClass(s){s=(s||'').toLowerCase(); if(s.includes('open') && !s.includes('not open')) return 'open'; if(s.includes('soon') || s.includes('opening') || s.includes('forecast')) return 'soon'; if(s.includes('closed') || s.includes('last open')) return 'closed'; return 'tbd';}
function prospectStatusClass(s){
  s=(s||'Not Started').toLowerCase();
  if(s.includes('interested')) return 'status-interested';
  if(s.includes('contacted')) return 'status-contacted';
  if(s.includes('scheduled')) return 'status-callscheduled';
  if(s.includes('research')) return 'status-researching';
  if(s.includes('not a fit')) return 'status-notfit';
  if(s.includes('do not')) return 'status-donotcontact';
  return 'status-notstarted';
}
function priorityClass(p){p=(p||'').toLowerCase(); if(p.includes('tier 1')) return 'tier1'; if(p.includes('tier 2')) return 'tier2'; if(p.includes('tier 3')) return 'tier3'; return '';}
function compareValues(a,b){ const na = typeof a === 'number', nb = typeof b === 'number'; if(na && nb) return a-b; return COLLATOR.compare(String(a ?? ''), String(b ?? '')); }
function sortedStates(){ return [...STATES].sort((a,b)=>COLLATOR.compare(a.state,b.state)); }
function params(){return new URLSearchParams(location.search)}
function parseDateValue(v){ if(!v) return 9999999999999; const d=new Date(String(v).replace(/^(Deadline|Due|Close|Closes|End|Next)[: ]+/i,'')); return Number.isNaN(d.getTime()) ? String(v).toLowerCase() : d.getTime(); }

function allNotes(){try{return JSON.parse(localStorage.getItem('slcgpProspectNotes')||'{}')}catch(e){return {}}}
function prospectNote(id){return allNotes()[id]||{};}
function shortText(v,n=105){v=String(v||'').trim(); return v.length>n ? v.slice(0,n-1)+'…' : v;}
function noteDate(v){if(!v) return '—'; const d=new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});}
function noteStatus(n){return n?.status || 'Not Started';}
function noteAssigned(n){return n?.assignedTo || '—';}
function noteLast(n){return n?.notes ? shortText(n.notes) : '—';}
function yesNo(v){return v ? 'Yes' : 'No';}
function contactLine(n){ return [n?.contactName, n?.contactEmail, n?.contactPhone].filter(Boolean).join(' | ') || '—'; }
function vehicleLine(n){
  const parts=[];
  if(n?.stateBuyingVehicle) parts.push('Vehicle: Yes');
  if(n?.stateBuyingVehicleName) parts.push(n.stateBuyingVehicleName);
  if(n?.stateBuyingVehicleStatus) parts.push(n.stateBuyingVehicleStatus);
  if(n?.registeredVendor) parts.push('Vendor registered');
  return parts.join(' | ') || '—';
}
function calcCountsForState(abbr){
  const rows = PROSPECTS.filter(p=>p.state===abbr);
  return {
    k12Count: rows.length,
    highPriority: rows.filter(p=>/Tier 1|Tier 2/i.test(p.priority||'')).length,
    ruralCount: rows.filter(p=>p.ruralTag==='Rural').length,
    townCount: rows.filter(p=>/town/i.test(p.ruralTag||'') || /^3[123]/.test(p.locale||'')).length,
    totalStudents: rows.reduce((a,p)=>a+(Number(p.students)||0),0),
    totalSchools: rows.reduce((a,p)=>a+(Number(p.schools)||0),0)
  };
}
function ensureAllStates(raw){
  const byAbbr = Object.fromEntries((raw||[]).map(s=>[s.abbr,s]));
  return US_STATES.map(([abbr,state])=>{
    const counts = calcCountsForState(abbr);
    const existing = byAbbr[abbr] || {};
    return {
      abbr, state,
      region: existing.region || REGION_BY_ABBR[abbr] || 'TBD',
      status: existing.status || 'Monitor / state page TBD',
      openStatus: existing.openStatus || 'Forecasted/TBD',
      startDate: existing.startDate || '', endDate: existing.endDate || '', nextDate: existing.nextDate || '',
      fyMatch: existing.fyMatch || 'FY 2025 federal baseline: confirm state guidance.',
      procurementType: existing.procurementType || 'State process TBD', confidence: existing.confidence || 'Monitor',
      sourceName: existing.sourceName || 'State SAA / cybersecurity page TBD', sourceUrl: existing.sourceUrl || '', bestDrillDownUrl: existing.bestDrillDownUrl || '', advisoryCommitteeUrl: existing.advisoryCommitteeUrl || '', meetingsUrl: existing.meetingsUrl || '',
      summary: existing.summary || 'Monitor the state SAA and cybersecurity grant pages for SLCGP local process updates.',
      timeline: existing.timeline || 'Dates TBD. Confirm whether the current FY window is open, opening soon, closed, or last open.',
      requirements: existing.requirements || 'Confirm applicant eligibility, local government pathway, match, and project scope with the state guidance.',
      accessPath: existing.accessPath || 'State SAA/local application process TBD.',
      targetingNote: existing.targetingNote || 'Use the K-12 and local government prospect list to prepare callouts before the state window opens.',
      immediateNextSteps: existing.immediateNextSteps || ['Confirm state source page and application pathway.','Identify K-12/public-sector contacts.','Track assigned rep, status, notes, vendor registration, and buying vehicle.'],
      sourceUpdated: existing.sourceUpdated || 'Static starter record',
      ...counts,
      ...existing
    };
  });
}
function fyWindow(s){
  const fy = /FY\s*\d{4}/i.exec(s.sourceName+' '+s.summary+' '+s.timeline+' '+s.fyMatch)?.[0]?.replace(/\s+/g,' ') || 'FY 2025';
  const dateRange = [s.startDate, s.endDate].filter(Boolean).join(' – ');
  const statusText = (s.status || s.openStatus || '').toLowerCase();
  let label = `${fy} SLCGP`;
  let detail = dateRange || s.nextDate || s.timeline || 'Dates TBD';
  let cls = 'tbd';
  if((s.openStatus==='Open') || statusText.includes('open')) { label += ': Open'; cls='open'; }
  else if(statusText.includes('coming') || statusText.includes('soon') || statusText.includes('forecast') || /spring|summer|fall|winter/i.test(s.nextDate||'')) { label += ': Opening / Forecasted'; cls='soon'; }
  else if(statusText.includes('closed')) { label += ': Last open / Closed'; cls='closed'; }
  else { label += ': Monitor'; }
  return {label, detail, cls};
}

const prospectSorters = [
  p => p.agencyName || '',
  p => p.county || '',
  p => `${p.city || ''} ${p.zip || ''}`,
  p => p.priority || '',
  p => Number(p.students || 0),
  p => Number(p.schools || 0),
  p => p.phone || '',
  p => p.website || '',
  p => noteAssigned(prospectNote(p.id)),
  p => noteStatus(prospectNote(p.id)),
  p => vehicleLine(prospectNote(p.id)),
  p => noteLast(prospectNote(p.id)),
  p => p.agencyName || ''
];
function bindProspectSortHeaders(){
  const table = $('#prospectTable'); if(!table) return;
  table.querySelectorAll('thead th').forEach((th,i)=>{
    th.classList.add('sortable'); th.setAttribute('title','Click to sort'); th.setAttribute('role','button'); th.tabIndex = 0;
    const toggle=()=>{ prospectSort = { col:i, dir:(prospectSort.col===i && prospectSort.dir==='asc')?'desc':'asc' }; renderProspects(); };
    th.addEventListener('click', toggle);
    th.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggle(); } });
  });
}
function updateProspectSortIndicators(){
  const table = $('#prospectTable'); if(!table) return;
  table.querySelectorAll('thead th').forEach((th,i)=>{
    th.classList.toggle('sort-asc', prospectSort.col===i && prospectSort.dir==='asc');
    th.classList.toggle('sort-desc', prospectSort.col===i && prospectSort.dir==='desc');
    th.setAttribute('aria-sort', prospectSort.col===i ? (prospectSort.dir==='asc'?'ascending':'descending') : 'none');
  });
}

async function loadData(){
  const [s,p,c]=await Promise.all([fetch('data/state_programs.json').then(r=>r.json()), fetch('data/prospects_k12.json').then(r=>r.json()), fetch('data/eligible_org_categories.json').then(r=>r.json())]);
  PROSPECTS=p; STATES=ensureAllStates(s); CATEGORIES=c;
  const abbr=(params().get('state')||'GA').toUpperCase(); STATE=STATES.find(x=>x.abbr===abbr)||STATES[0]; init();
}
function init(){
  document.title=`${STATE.state} SLCGP Prospecting`;
  $('[data-current-user]') && ($('[data-current-user]').textContent=currentUser());
  $('#stateTitle').textContent=`${STATE.state} SLCGP Prospecting`;
  const fy=fyWindow(STATE);
  $('#stateSub').textContent=`${STATE.region} | ${STATE.status} | ${fy.label} | ${fmt.format(STATE.k12Count||0)} K-12 district records loaded`;
  $('#stateBadge').textContent=STATE.abbr;
  populateStateJump();
  renderOverview(); populateProspectFilters(); bindProspectSortHeaders(); renderProspects(); renderCategories();
  ['#pQ','#county','#locale','#tier','#agencyType','#minStudents','#ruralOnly','#websiteOnly'].forEach(id=>$(id)?.addEventListener('input', renderProspects));
  $('#resetP')?.addEventListener('click',()=>{$$('#pQ,#county,#locale,#tier,#agencyType,#minStudents').forEach(e=>e.value=''); $('#ruralOnly').checked=false; $('#websiteOnly').checked=false; renderProspects();});
  $('#exportProspects')?.addEventListener('click',()=>downloadCsv(`${STATE.abbr}_slcgp_k12_prospects.csv`, filtered.map(p=>{ const n=prospectNote(p.id); return {
    NCES_ID:p.id,Agency:p.agencyName,County:p.county,City:p.city,ZIP:p.zip,Phone:p.phone,Website:p.website,Locale:p.locale,Priority:p.priority,Students:p.students,Schools:p.schools,Agency_Type:p.agencyType,
    Assigned_To:n.assignedTo||'',Status:n.status||'',Last_Notes:n.notes||'',Next_Followup:n.nextFollowup||'',Registered_Vendor:yesNo(n.registeredVendor),Vendor_Registration_Date:n.vendorRegistrationDate||'',State_Buying_Vehicle:yesNo(n.stateBuyingVehicle),State_Buying_Vehicle_Name:n.stateBuyingVehicleName||'',State_Buying_Vehicle_Status:n.stateBuyingVehicleStatus||'',Superintendent_or_Contact_Name:n.contactName||'',Contact_Title:n.contactTitle||'',Contact_Email:n.contactEmail||'',Contact_Phone:n.contactPhone||'',Last_Updated:n.updatedAt||'',Updated_By:n.updatedBy||''}; })));
  $('#printBtn')?.addEventListener('click',()=>window.print());
  $('#tableMode')?.addEventListener('click',()=>{mode='table'; renderProspects()});
  $('#cardMode')?.addEventListener('click',()=>{mode='cards'; renderProspects()});
  $('#activityMode')?.addEventListener('click',()=>{mode='activity'; renderProspects()});
  $('#copyCallList')?.addEventListener('click',copyCallList);
  $$('.tab').forEach(t=>t.addEventListener('click',()=>{ $$('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); $$('.tab-panel').forEach(p=>p.classList.add('hidden')); $('#'+t.dataset.tab).classList.remove('hidden'); }));
}
function populateStateJump(){
  const sel=$('#stateJump'); if(!sel) return;
  sel.innerHTML=sortedStates().map(s=>`<option value="${s.abbr}" ${s.abbr===STATE.abbr?'selected':''}>${esc(s.state)} (${s.abbr})</option>`).join('');
  sel.addEventListener('change',()=>{ location.href=`state.html?state=${encodeURIComponent(sel.value)}`; });
}
function renderOverview(){
  const fy=fyWindow(STATE);
  const k=$('#stateKpis');
  k.innerHTML=[['K-12 prospects',STATE.k12Count||0,'district records'],['Tier 1/2',STATE.highPriority||0,'remote/rural targets'],['Rural locales',STATE.ruralCount||0,'NCES 41-43'],['Students',STATE.totalStudents||0,'total enrollment'],['Schools',STATE.totalSchools||0,'operational schools']].map(x=>`<div class="card kpi-card"><div class="label">${x[0]}</div><div class="value">${fmt.format(x[1])}</div><div class="hint">${x[2]}</div></div>`).join('');
  $('#summaryCard').innerHTML=`<h2>State Level Detail</h2><p>${esc(STATE.summary)}</p><div class="meta"><span class="status ${statusClass(STATE.status)}">${esc(STATE.status)}</span><span class="status ${fy.cls}">${esc(fy.label)}</span><span class="pill">${esc(STATE.procurementType)}</span><span class="pill">Confidence: ${esc(STATE.confidence)}</span></div><p><strong>Dates:</strong> ${esc(fy.detail)}</p><p><strong>Funding / match:</strong> ${esc(STATE.fyMatch)}</p><p><strong>Targeting note:</strong> ${esc(STATE.targetingNote)}</p>`;
  $('#timelineCard').innerHTML=`<h2>Timeline & Access</h2><div class="timeline-list"><div class="timeline-item"><strong>SLCGP FY status</strong>${esc(fy.label)}</div><div class="timeline-item"><strong>Open / opening / last date</strong>${esc(fy.detail)}</div><div class="timeline-item"><strong>Timeline</strong>${esc(STATE.timeline)}</div><div class="timeline-item"><strong>How to access funding</strong>${esc(STATE.accessPath)}</div><div class="timeline-item"><strong>Requirements</strong>${esc(STATE.requirements)}</div></div>`;
  const steps=(STATE.immediateNextSteps||[]).map(x=>`<li>${esc(x)}</li>`).join('');
  $('#requirementsCard').innerHTML=`<h2>Federal SLCGP Rules to Keep in View</h2><ul><li>Federal applicant is the Governor-designated State Administrative Agency; local entities use the state process.</li><li>At least 80% of state award value must benefit local governments, and 25% of the federal award must reach rural areas unless an exception applies.</li><li>Public K-12 and public higher education can be eligible when they are agencies or instrumentalities of government; private schools are not eligible.</li><li>For FY 2025 baseline, use 40% non-federal cost share unless the state guidance says otherwise.</li></ul><h3>Immediate next steps</h3><ol>${steps}</ol>`;
  $('#linksCard').innerHTML=`<h2>Best Links</h2><div class="source-list"><div><strong>State source:</strong> ${link(STATE.sourceUrl, STATE.sourceName)}</div><div><strong>Best drill-down:</strong> ${link(STATE.bestDrillDownUrl, 'Open')}</div><div><strong>Advisory committee:</strong> ${link(STATE.advisoryCommitteeUrl, 'Open')}</div><div><strong>Meetings/webinars:</strong> ${link(STATE.meetingsUrl, 'Open')}</div></div><p class="mini">State source note: ${esc(STATE.sourceUpdated||'')}</p>`;
}
function stateProspects(){return PROSPECTS.filter(p=>p.state===STATE.abbr)}
function populateProspectFilters(){
  const rows=stateProspects();
  const counties=[...new Set(rows.map(p=>p.county).filter(Boolean))].sort((a,b)=>COLLATOR.compare(a,b)); $('#county').innerHTML='<option value="">All counties</option>'+counties.map(c=>`<option>${esc(c)}</option>`).join('');
  const locales=[...new Set(rows.map(p=>p.locale).filter(Boolean))].sort((a,b)=>(parseInt(a)-parseInt(b))); $('#locale').innerHTML='<option value="">All locales</option>'+locales.map(c=>`<option>${esc(c)}</option>`).join('');
  const agencies=[...new Set(rows.map(p=>p.agencyType).filter(Boolean))].sort((a,b)=>COLLATOR.compare(a,b)); $('#agencyType').innerHTML='<option value="">All agency types</option>'+agencies.map(c=>`<option>${esc(c)}</option>`).join('');
}
function prospectFilters(){return {q:$('#pQ').value.toLowerCase(), county:$('#county').value, locale:$('#locale').value, tier:$('#tier').value, agencyType:$('#agencyType').value, min:parseInt($('#minStudents').value||'0'), rural:$('#ruralOnly').checked, website:$('#websiteOnly').checked}}
function applyProspectFilters(){
  const f=prospectFilters();
  return stateProspects().filter(p=>{
    const n=prospectNote(p.id);
    const hay=[p.agencyName,p.county,p.city,p.zip,p.locale,p.agencyType,p.phone,p.website,n.assignedTo,n.status,n.notes,n.contactName,n.contactEmail,n.contactPhone,n.contactTitle,n.stateBuyingVehicleName,n.stateBuyingVehicleStatus,n.registeredVendor?'registered vendor':'',n.stateBuyingVehicle?'state buying vehicle':''].join(' ').toLowerCase();
    if(f.q && !hay.includes(f.q)) return false; if(f.county && p.county!==f.county) return false; if(f.locale && p.locale!==f.locale) return false; if(f.agencyType && p.agencyType!==f.agencyType) return false; if(f.min && (p.students||0)<f.min) return false; if(f.rural && p.ruralTag!=='Rural') return false; if(f.website && !p.website) return false;
    if(f.tier && !p.priority.startsWith(f.tier)) return false; return true;
  }).sort((a,b)=>{
    const cmp = compareValues(prospectSorters[prospectSort.col]?.(a), prospectSorters[prospectSort.col]?.(b)) || compareValues(a.county, b.county) || compareValues(a.agencyName, b.agencyName);
    return prospectSort.dir === 'asc' ? cmp : -cmp;
  });
}
function renderProspects(){
  filtered=applyProspectFilters(); updateProspectSortIndicators(); renderStatusCounts(); $('#prospectCount').textContent=fmt.format(filtered.length); $$('#tableMode,#cardMode,#activityMode').forEach(b=>b.classList.remove('primary')); $(mode==='table'?'#tableMode':mode==='cards'?'#cardMode':'#activityMode').classList.add('primary');
  $('#prospectTableWrap').classList.toggle('hidden', mode!=='table'); $('#prospectCards').classList.toggle('hidden', mode!=='cards'); $('#prospectActivityCards').classList.toggle('hidden', mode!=='activity');
  const rows=filtered.slice(0,900); // performance cap for screen; CSV still exports all filtered
  $('#prospectTable tbody').innerHTML=rows.map(p=>{
    const n=prospectNote(p.id);
    return `<tr><td><strong>${esc(p.agencyName)}</strong><span class="source-tag">NCES: ${esc(p.id)}</span></td><td>${esc(p.county)}</td><td>${esc(p.city)} ${esc(p.zip)}</td><td><span class="priority ${priorityClass(p.priority)}">${esc(p.priority.replace(' - ',': '))}</span><span class="source-tag">${esc(p.locale)}</span></td><td>${fmt.format(p.students||0)}</td><td>${fmt.format(p.schools||0)}</td><td>${esc(p.phone||'')}</td><td>${p.website?link(p.website,'Website'):'—'}</td><td>${esc(noteAssigned(n))}</td><td><span class="status ${prospectStatusClass(noteStatus(n))}">${esc(noteStatus(n))}</span></td><td>${esc(vehicleLine(n))}<span class="source-tag">Contact: ${esc(contactLine(n))}</span></td><td>${esc(noteLast(n))}<span class="source-tag">${n.updatedAt?`Updated ${esc(noteDate(n.updatedAt))}`:''}</span></td><td><a class="action-link" href="#" onclick='openNote(${JSON.stringify(p.id)});return false;'>Log</a></td></tr>`;
  }).join('') || `<tr><td colspan="13" class="empty">No K-12 prospects match this filter.</td></tr>`;
  $('#tableLimitNote').textContent = filtered.length>900 ? `Showing first 900 of ${fmt.format(filtered.length)} matches for performance. Export CSV includes all filtered rows.` : '';
  $('#prospectCards').innerHTML=rows.map(p=>{ const n=prospectNote(p.id); return `<div class="card prospect-card"><h3>${esc(p.agencyName)}</h3><div class="meta"><span class="priority ${priorityClass(p.priority)}">${esc(p.priority)}</span><span class="pill">${esc(p.locale)}</span><span class="status ${prospectStatusClass(noteStatus(n))}">${esc(noteStatus(n))}</span></div><p><strong>County:</strong> ${esc(p.county)}<br><strong>Location:</strong> ${esc(p.city)}, ${esc(p.zip)}<br><strong>Students/Schools:</strong> ${fmt.format(p.students||0)} / ${fmt.format(p.schools||0)}</p><p><strong>Assigned:</strong> ${esc(noteAssigned(n))}<br><strong>Contact:</strong> ${esc(contactLine(n))}<br><strong>Vendor/Vehicle:</strong> ${esc(vehicleLine(n))}<br><strong>Last note:</strong> ${esc(noteLast(n))}</p><p>${esc(p.phone||'No phone loaded')} ${p.website?' | '+link(p.website,'Website'):''}</p><a class="action-link" href="#" onclick='openNote(${JSON.stringify(p.id)});return false;'>Log / update prospect</a></div>`; }).join('') || `<div class="empty">No K-12 prospects match this filter.</div>`;
  renderActivityCards();
}
function renderStatusCounts(){
  const root = $('#statusCounts'); if(!root) return;
  const counts = Object.fromEntries(STATUS_TYPES.map(s=>[s,0]));
  let registered=0, buying=0;
  filtered.forEach(p=>{ const n=prospectNote(p.id); const status=noteStatus(n); counts[status]=(counts[status]||0)+1; if(n.registeredVendor) registered++; if(n.stateBuyingVehicle) buying++; });
  root.innerHTML = `<div class="status-count-grid">${STATUS_TYPES.map(s=>`<div class="card status-count-card"><span class="status ${prospectStatusClass(s)}">${esc(s)}</span><strong>${fmt.format(counts[s]||0)}</strong></div>`).join('')}<div class="card status-count-card"><span class="status status-vendor">Registered vendor</span><strong>${fmt.format(registered)}</strong></div><div class="card status-count-card"><span class="status status-buyer">Buying vehicle</span><strong>${fmt.format(buying)}</strong></div></div>`;
}
function renderActivityCards(){
  const notes=allNotes();
  const items=filtered.map(p=>({p,n:notes[p.id]})).filter(x=>x.n).sort((a,b)=>(new Date(b.n.updatedAt||0))- (new Date(a.n.updatedAt||0))).slice(0,900);
  $('#prospectActivityCards').innerHTML = items.map(({p,n})=>`<div class="card activity-card"><div class="meta"><span class="status ${prospectStatusClass(noteStatus(n))}">${esc(noteStatus(n))}</span><span class="pill">Assigned: ${esc(noteAssigned(n))}</span>${n.registeredVendor?'<span class="status status-vendor">Vendor registered</span>':''}${n.stateBuyingVehicle?'<span class="status status-buyer">Buying vehicle</span>':''}</div><h3>${esc(p.agencyName)}</h3><p><strong>Last note:</strong> ${esc(n.notes||'—')}</p><p class="mini"><strong>Updated:</strong> ${esc(noteDate(n.updatedAt))} by ${esc(n.updatedBy||'—')}<br><strong>Next follow-up:</strong> ${esc(n.nextFollowup||'—')}<br><strong>Contact:</strong> ${esc(contactLine(n))}<br><strong>Vehicle:</strong> ${esc(vehicleLine(n))}<br><strong>County:</strong> ${esc(p.county)} | ${esc(p.city)}, ${esc(p.zip)}</p><div class="toolbar"><a class="action-link" href="#" onclick='openNote(${JSON.stringify(p.id)});return false;'>Update activity</a>${p.website?link(p.website,'Website'):''}</div></div>`).join('') || `<div class="empty">No prospect activity has been logged for the current filters yet. Use “Log” from the Table or Cards view to create activity cards.</div>`;
}
function renderCategories(){
  $('#categoriesGrid').innerHTML=CATEGORIES.map(c=>`<div class="card"><h3>${esc(c.name)}</h3><div class="meta"><span class="pill">Fit: ${esc(c.fit)}</span></div><p>${esc(c.eligibility)}</p><p><strong>Who to contact:</strong> ${esc(c.contacts)}</p><p><strong>Project angles:</strong> ${c.useCases.map(esc).join(', ')}</p><button class="btn small" onclick="navigator.clipboard.writeText('${esc(c.name)} ${esc(c.contacts)} ${esc(c.useCases.join(', '))}')">Copy search hints</button></div>`).join('');
}
function checkedAttr(v){return v ? 'checked' : '';}
function openNote(id){
  const p=PROSPECTS.find(x=>x.id===id); if(!p) return;
  const existing=JSON.parse(localStorage.getItem('slcgpProspectNotes')||'{}')[id]||{};
  const panel=document.createElement('aside'); panel.className='note-panel'; panel.innerHTML=`
    <header><div><h3>${esc(p.agencyName)}</h3><p class="mini">${esc(p.county)} | ${esc(p.city)} | NCES ${esc(p.id)}</p></div><button class="btn small ghost" id="closeNote">×</button></header>
    <div class="two-col"><div class="field"><label>Status</label><select id="noteStatus"><option>Not Started</option><option>Researching</option><option>Call Scheduled</option><option>Contacted</option><option>Interested</option><option>Not a fit</option><option>Do not contact</option></select></div><div class="field"><label>Assigned To</label><input id="assigned" value="${esc(existing.assignedTo||currentUser())}"></div></div>
    <div class="two-col"><div class="field"><label>Priority</label><select id="notePriority"><option>High</option><option>Medium</option><option>Low</option></select></div><div class="field"><label>Next follow-up</label><input id="nextFollow" type="date" value="${esc(existing.nextFollowup||'')}"></div></div>
    <div class="two-col"><label class="pill field-check"><input id="registeredVendor" type="checkbox" ${checkedAttr(existing.registeredVendor)}> Registered as vendor</label><div class="field"><label>Vendor registration date</label><input id="vendorRegistrationDate" type="date" value="${esc(existing.vendorRegistrationDate||'')}"></div></div>
    <div class="two-col"><label class="pill field-check"><input id="stateBuyingVehicle" type="checkbox" ${checkedAttr(existing.stateBuyingVehicle)}> State buying vehicle</label><div class="field"><label>Buying vehicle status</label><select id="stateBuyingVehicleStatus"><option>Not Reviewed</option><option>Available</option><option>In Progress</option><option>Yes - Confirmed</option><option>No Known Vehicle</option><option>Needs Follow-up</option></select></div></div>
    <div class="field"><label>State buying vehicle name / contract #</label><input id="stateBuyingVehicleName" value="${esc(existing.stateBuyingVehicleName||'')}" placeholder="State contract, cooperative, purchasing vehicle, contract #..."></div>
    <div class="two-col"><div class="field"><label>Superintendent or contact name</label><input id="contactName" value="${esc(existing.contactName||'')}"></div><div class="field"><label>Contact title</label><input id="contactTitle" value="${esc(existing.contactTitle||'')}" placeholder="Superintendent, IT Director, Grants..."></div></div>
    <div class="two-col"><div class="field"><label>Contact email</label><input id="contactEmail" type="email" value="${esc(existing.contactEmail||'')}"></div><div class="field"><label>Contact phone</label><input id="contactPhone" value="${esc(existing.contactPhone||'')}"></div></div>
    <div class="field"><label>Notes</label><textarea id="noteText" placeholder="Call notes, contact names, grant fit, cyber needs...">${esc(existing.notes||'')}</textarea></div>
    <div class="toolbar"><button class="btn primary" id="saveNote">Save / Log to Sheet</button><button class="btn" id="copyProspect">Copy prospect details</button></div>
    <p class="mini">Saved locally and posted to Google Sheets when config.js includes a deployed Apps Script URL.</p>`;
  document.body.appendChild(panel);
  $('#noteStatus').value=existing.status||'Not Started'; $('#notePriority').value=existing.priority||'High'; $('#stateBuyingVehicleStatus').value=existing.stateBuyingVehicleStatus||'Not Reviewed';
  $('#closeNote').onclick=()=>panel.remove();
  $('#copyProspect').onclick=()=>navigator.clipboard.writeText(`${p.agencyName}\n${p.county}, ${p.city}, ${p.zip}\nPhone: ${p.phone}\nWebsite: ${p.website}\nLocale: ${p.locale}\nPriority: ${p.priority}`);
  $('#saveNote').onclick=()=>{
    const note={
      prospectId:p.id, prospectName:p.agencyName, state:STATE.abbr, county:p.county,
      status:$('#noteStatus').value, assignedTo:$('#assigned').value, priority:$('#notePriority').value, nextFollowup:$('#nextFollow').value,
      registeredVendor:$('#registeredVendor').checked, vendorRegistrationDate:$('#vendorRegistrationDate').value,
      stateBuyingVehicle:$('#stateBuyingVehicle').checked, stateBuyingVehicleName:$('#stateBuyingVehicleName').value, stateBuyingVehicleStatus:$('#stateBuyingVehicleStatus').value,
      contactName:$('#contactName').value, contactTitle:$('#contactTitle').value, contactEmail:$('#contactEmail').value, contactPhone:$('#contactPhone').value,
      notes:$('#noteText').value, updatedAt:new Date().toISOString(), updatedBy:currentUser()
    };
    const all=JSON.parse(localStorage.getItem('slcgpProspectNotes')||'{}'); all[p.id]=note; localStorage.setItem('slcgpProspectNotes', JSON.stringify(all));
    logEvent({eventType:'prospect_note', ...note}); panel.remove(); renderProspects(); alert('Prospect note saved.');
  };
}
function copyCallList(){
  const text=filtered.slice(0,50).map(p=>{ const n=prospectNote(p.id); return `${p.agencyName} | ${p.county} | ${p.city}, ${p.zip} | ${p.phone||''} | ${p.website||''} | ${p.priority} | Assigned: ${n.assignedTo||''} | Status: ${n.status||''} | Vendor: ${yesNo(n.registeredVendor)} | Vehicle: ${n.stateBuyingVehicleName||''} ${n.stateBuyingVehicleStatus||''} | Contact: ${contactLine(n)} | Notes: ${shortText(n.notes||'', 80)}`; }).join('\n');
  navigator.clipboard.writeText(text); alert('Copied top 50 filtered prospects.');
}
function downloadCsv(filename, rows){
  if(!rows.length) return; const headers=Object.keys(rows[0]); const csv=[headers.join(',')].concat(rows.map(r=>headers.map(h=>`"${String(r[h]??'').replace(/"/g,'""')}"`).join(','))).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
window.addEventListener('DOMContentLoaded',()=>{requireLogin(); loadData().catch(e=>{console.error(e); document.body.insertAdjacentHTML('beforeend','<div class="empty">Could not load state data.</div>')})});
