
let STATES=[], PROSPECTS=[], CATEGORIES=[], STATE=null, filtered=[], mode='table';
const fmt = new Intl.NumberFormat('en-US');
const $ = sel => document.querySelector(sel); const $$ = sel => Array.from(document.querySelectorAll(sel));
function esc(v){return String(v??'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function link(url,text){return url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text||url)}</a>`:'—';}
function statusClass(s){s=(s||'').toLowerCase(); if(s.includes('open')) return 'open'; if(s.includes('soon')) return 'soon'; if(s.includes('closed')) return 'closed'; return 'tbd';}
function priorityClass(p){p=(p||'').toLowerCase(); if(p.includes('tier 1')) return 'tier1'; if(p.includes('tier 2')) return 'tier2'; if(p.includes('tier 3')) return 'tier3'; return '';}
function params(){return new URLSearchParams(location.search)}
async function loadData(){
  const [s,p,c]=await Promise.all([fetch('data/state_programs.json').then(r=>r.json()), fetch('data/prospects_k12.json').then(r=>r.json()), fetch('data/eligible_org_categories.json').then(r=>r.json())]);
  STATES=s; PROSPECTS=p; CATEGORIES=c; const abbr=(params().get('state')||'GA').toUpperCase(); STATE=STATES.find(x=>x.abbr===abbr)||STATES[0]; init();
}
function init(){
  document.title=`${STATE.state} SLCGP Prospecting`;
  $('[data-current-user]') && ($('[data-current-user]').textContent=currentUser());
  $('#stateTitle').textContent=`${STATE.state} SLCGP Prospecting`;
  $('#stateSub').textContent=`${STATE.region} | ${STATE.status} | ${fmt.format(STATE.k12Count||0)} K-12 district records loaded`;
  $('#stateBadge').textContent=STATE.abbr;
  renderOverview(); populateProspectFilters(); renderProspects(); renderCategories();
  ['#pQ','#county','#locale','#tier','#agencyType','#minStudents','#ruralOnly','#websiteOnly'].forEach(id=>$(id)?.addEventListener('input', renderProspects));
  $('#resetP')?.addEventListener('click',()=>{$$('#pQ,#county,#locale,#tier,#agencyType,#minStudents').forEach(e=>e.value=''); $('#ruralOnly').checked=false; $('#websiteOnly').checked=false; renderProspects();});
  $('#exportProspects')?.addEventListener('click',()=>downloadCsv(`${STATE.abbr}_slcgp_k12_prospects.csv`, filtered.map(p=>({NCES_ID:p.id,Agency:p.agencyName,County:p.county,City:p.city,ZIP:p.zip,Phone:p.phone,Website:p.website,Locale:p.locale,Priority:p.priority,Students:p.students,Schools:p.schools,Agency_Type:p.agencyType}))));
  $('#printBtn')?.addEventListener('click',()=>window.print());
  $('#tableMode')?.addEventListener('click',()=>{mode='table'; renderProspects()});
  $('#cardMode')?.addEventListener('click',()=>{mode='cards'; renderProspects()});
  $('#copyCallList')?.addEventListener('click',copyCallList);
  $$('.tab').forEach(t=>t.addEventListener('click',()=>{ $$('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); $$('.tab-panel').forEach(p=>p.classList.add('hidden')); $('#'+t.dataset.tab).classList.remove('hidden'); }));
}
function renderOverview(){
  const k=$('#stateKpis');
  k.innerHTML=[['K-12 prospects',STATE.k12Count||0,'district records'],['Tier 1/2',STATE.highPriority||0,'remote/rural targets'],['Rural locales',STATE.ruralCount||0,'NCES 41-43'],['Students',STATE.totalStudents||0,'total enrollment'],['Schools',STATE.totalSchools||0,'operational schools']].map(x=>`<div class="card kpi-card"><div class="label">${x[0]}</div><div class="value">${fmt.format(x[1])}</div><div class="hint">${x[2]}</div></div>`).join('');
  $('#summaryCard').innerHTML=`<h2>State Level Detail</h2><p>${esc(STATE.summary)}</p><div class="meta"><span class="status ${statusClass(STATE.status)}">${esc(STATE.status)}</span><span class="pill">${esc(STATE.procurementType)}</span><span class="pill">Confidence: ${esc(STATE.confidence)}</span></div><p><strong>Funding / match:</strong> ${esc(STATE.fyMatch)}</p><p><strong>Targeting note:</strong> ${esc(STATE.targetingNote)}</p>`;
  $('#timelineCard').innerHTML=`<h2>Timeline & Access</h2><div class="timeline-list"><div class="timeline-item"><strong>Window / next date</strong>${esc(STATE.endDate||STATE.nextDate||'TBD')}</div><div class="timeline-item"><strong>Timeline</strong>${esc(STATE.timeline)}</div><div class="timeline-item"><strong>How to access funding</strong>${esc(STATE.accessPath)}</div><div class="timeline-item"><strong>Requirements</strong>${esc(STATE.requirements)}</div></div>`;
  const steps=(STATE.immediateNextSteps||[]).map(x=>`<li>${esc(x)}</li>`).join('');
  $('#requirementsCard').innerHTML=`<h2>Federal SLCGP Rules to Keep in View</h2><ul><li>Federal applicant is the Governor-designated State Administrative Agency; local entities use the state process.</li><li>At least 80% of state award value must benefit local governments, and 25% of the federal award must reach rural areas unless an exception applies.</li><li>Public K-12 and public higher education can be eligible when they are agencies or instrumentalities of government; private schools are not eligible.</li><li>For FY 2025 baseline, use 40% non-federal cost share unless the state guidance says otherwise.</li></ul><h3>Immediate next steps</h3><ol>${steps}</ol>`;
  $('#linksCard').innerHTML=`<h2>Best Links</h2><div class="source-list"><div><strong>State source:</strong> ${link(STATE.sourceUrl, STATE.sourceName)}</div><div><strong>Best drill-down:</strong> ${link(STATE.bestDrillDownUrl, 'Open')}</div><div><strong>Advisory committee:</strong> ${link(STATE.advisoryCommitteeUrl, 'Open')}</div><div><strong>Meetings/webinars:</strong> ${link(STATE.meetingsUrl, 'Open')}</div></div><p class="mini">State source note: ${esc(STATE.sourceUpdated||'')}</p>`;
}
function stateProspects(){return PROSPECTS.filter(p=>p.state===STATE.abbr)}
function populateProspectFilters(){
  const rows=stateProspects();
  const counties=[...new Set(rows.map(p=>p.county).filter(Boolean))].sort(); $('#county').innerHTML='<option value="">All counties</option>'+counties.map(c=>`<option>${esc(c)}</option>`).join('');
  const locales=[...new Set(rows.map(p=>p.locale).filter(Boolean))].sort((a,b)=>(parseInt(a)-parseInt(b))); $('#locale').innerHTML='<option value="">All locales</option>'+locales.map(c=>`<option>${esc(c)}</option>`).join('');
  const agencies=[...new Set(rows.map(p=>p.agencyType).filter(Boolean))].sort(); $('#agencyType').innerHTML='<option value="">All agency types</option>'+agencies.map(c=>`<option>${esc(c)}</option>`).join('');
}
function prospectFilters(){return {q:$('#pQ').value.toLowerCase(), county:$('#county').value, locale:$('#locale').value, tier:$('#tier').value, agencyType:$('#agencyType').value, min:parseInt($('#minStudents').value||'0'), rural:$('#ruralOnly').checked, website:$('#websiteOnly').checked}}
function applyProspectFilters(){
  const f=prospectFilters();
  return stateProspects().filter(p=>{
    const hay=[p.agencyName,p.county,p.city,p.zip,p.locale,p.agencyType,p.phone,p.website].join(' ').toLowerCase();
    if(f.q && !hay.includes(f.q)) return false; if(f.county && p.county!==f.county) return false; if(f.locale && p.locale!==f.locale) return false; if(f.agencyType && p.agencyType!==f.agencyType) return false; if(f.min && (p.students||0)<f.min) return false; if(f.rural && p.ruralTag!=='Rural') return false; if(f.website && !p.website) return false;
    if(f.tier && !p.priority.startsWith(f.tier)) return false; return true;
  }).sort((a,b)=>a.priority.localeCompare(b.priority)||a.county.localeCompare(b.county)||a.agencyName.localeCompare(b.agencyName));
}
function renderProspects(){
  filtered=applyProspectFilters(); $('#prospectCount').textContent=fmt.format(filtered.length); $$('#tableMode,#cardMode').forEach(b=>b.classList.remove('primary')); $(mode==='table'?'#tableMode':'#cardMode').classList.add('primary');
  $('#prospectTableWrap').classList.toggle('hidden', mode!=='table'); $('#prospectCards').classList.toggle('hidden', mode!=='cards');
  const rows=filtered.slice(0,900); // performance cap for screen; CSV still exports all filtered
  $('#prospectTable tbody').innerHTML=rows.map(p=>`<tr><td><strong>${esc(p.agencyName)}</strong><span class="source-tag">NCES: ${esc(p.id)}</span></td><td>${esc(p.county)}</td><td>${esc(p.city)} ${esc(p.zip)}</td><td><span class="priority ${priorityClass(p.priority)}">${esc(p.priority.replace(' - ',': '))}</span><span class="source-tag">${esc(p.locale)}</span></td><td>${fmt.format(p.students||0)}</td><td>${fmt.format(p.schools||0)}</td><td>${esc(p.phone||'')}</td><td>${p.website?link(p.website,'Website'):'—'}</td><td><button class="btn small" onclick='openNote(${JSON.stringify(p.id)})'>Log note</button></td></tr>`).join('') || `<tr><td colspan="9" class="empty">No K-12 prospects match this filter.</td></tr>`;
  $('#tableLimitNote').textContent = filtered.length>900 ? `Showing first 900 of ${fmt.format(filtered.length)} matches for performance. Export CSV includes all filtered rows.` : '';
  $('#prospectCards').innerHTML=rows.map(p=>`<div class="card prospect-card"><h3>${esc(p.agencyName)}</h3><div class="meta"><span class="priority ${priorityClass(p.priority)}">${esc(p.priority)}</span><span class="pill">${esc(p.locale)}</span></div><p><strong>County:</strong> ${esc(p.county)}<br><strong>Location:</strong> ${esc(p.city)}, ${esc(p.zip)}<br><strong>Students/Schools:</strong> ${fmt.format(p.students||0)} / ${fmt.format(p.schools||0)}</p><p>${esc(p.phone||'No phone loaded')} ${p.website?' | '+link(p.website,'Website'):''}</p><button class="btn small primary" onclick='openNote(${JSON.stringify(p.id)})'>Log prospect note</button></div>`).join('') || `<div class="empty">No K-12 prospects match this filter.</div>`;
}
function renderCategories(){
  $('#categoriesGrid').innerHTML=CATEGORIES.map(c=>`<div class="card"><h3>${esc(c.name)}</h3><div class="meta"><span class="pill">Fit: ${esc(c.fit)}</span></div><p>${esc(c.eligibility)}</p><p><strong>Who to contact:</strong> ${esc(c.contacts)}</p><p><strong>Project angles:</strong> ${c.useCases.map(esc).join(', ')}</p><button class="btn small" onclick="navigator.clipboard.writeText('${esc(c.name)} ${esc(c.contacts)} ${esc(c.useCases.join(', '))}')">Copy search hints</button></div>`).join('');
}
function openNote(id){
  const p=PROSPECTS.find(x=>x.id===id); if(!p) return;
  const existing=JSON.parse(localStorage.getItem('slcgpProspectNotes')||'{}')[id]||{};
  const panel=document.createElement('aside'); panel.className='note-panel'; panel.innerHTML=`
    <header><div><h3>${esc(p.agencyName)}</h3><p class="mini">${esc(p.county)} | ${esc(p.city)} | NCES ${esc(p.id)}</p></div><button class="btn small ghost" id="closeNote">×</button></header>
    <div class="two-col"><div class="field"><label>Status</label><select id="noteStatus"><option>Not Started</option><option>Researching</option><option>Call Scheduled</option><option>Contacted</option><option>Interested</option><option>Not a fit</option><option>Do not contact</option></select></div><div class="field"><label>Assigned To</label><input id="assigned" value="${esc(existing.assignedTo||currentUser())}"></div></div>
    <div class="two-col"><div class="field"><label>Priority</label><select id="notePriority"><option>High</option><option>Medium</option><option>Low</option></select></div><div class="field"><label>Next follow-up</label><input id="nextFollow" type="date" value="${esc(existing.nextFollowup||'')}"></div></div>
    <div class="field"><label>Notes</label><textarea id="noteText" placeholder="Call notes, contact names, grant fit, cyber needs...">${esc(existing.notes||'')}</textarea></div>
    <div class="toolbar"><button class="btn primary" id="saveNote">Save / Log to Sheet</button><button class="btn" id="copyProspect">Copy prospect details</button></div>
    <p class="mini">Saved locally and posted to Google Sheets when config.js includes a deployed Apps Script URL.</p>`;
  document.body.appendChild(panel);
  $('#noteStatus').value=existing.status||'Not Started'; $('#notePriority').value=existing.priority||'High';
  $('#closeNote').onclick=()=>panel.remove();
  $('#copyProspect').onclick=()=>navigator.clipboard.writeText(`${p.agencyName}\n${p.county}, ${p.city}, ${p.zip}\nPhone: ${p.phone}\nWebsite: ${p.website}\nLocale: ${p.locale}\nPriority: ${p.priority}`);
  $('#saveNote').onclick=()=>{
    const note={prospectId:p.id, prospectName:p.agencyName, state:STATE.abbr, county:p.county, status:$('#noteStatus').value, assignedTo:$('#assigned').value, priority:$('#notePriority').value, nextFollowup:$('#nextFollow').value, notes:$('#noteText').value, updatedAt:new Date().toISOString(), updatedBy:currentUser()};
    const all=JSON.parse(localStorage.getItem('slcgpProspectNotes')||'{}'); all[p.id]=note; localStorage.setItem('slcgpProspectNotes', JSON.stringify(all));
    logEvent({eventType:'prospect_note', ...note}); panel.remove(); alert('Prospect note saved.');
  };
}
function copyCallList(){
  const text=filtered.slice(0,50).map(p=>`${p.agencyName} | ${p.county} | ${p.city}, ${p.zip} | ${p.phone||''} | ${p.website||''} | ${p.priority}`).join('\n');
  navigator.clipboard.writeText(text); alert('Copied top 50 filtered prospects.');
}
function downloadCsv(filename, rows){
  if(!rows.length) return; const headers=Object.keys(rows[0]); const csv=[headers.join(',')].concat(rows.map(r=>headers.map(h=>`"${String(r[h]??'').replace(/"/g,'""')}"`).join(','))).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
window.addEventListener('DOMContentLoaded',()=>{requireLogin(); loadData().catch(e=>{console.error(e); document.body.insertAdjacentHTML('beforeend','<div class="empty">Could not load state data.</div>')})});
