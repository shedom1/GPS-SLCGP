let STATES=[], PROSPECTS=[];
let stateSort = { col: 0, dir: 'asc' };
let stateCardsVisible = false;

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']
];
const REGION_BY_ABBR = {
  DE:'Northeast',KY:'Mid-Atlantic',MD:'Mid-Atlantic',TN:'Mid-Atlantic',VA:'Mid-Atlantic',WV:'Mid-Atlantic',
  CT:'Northeast',IL:'Northeast',IN:'Northeast',IA:'Northeast',KS:'Northeast',ME:'Northeast',MA:'Northeast',MI:'Northeast',MN:'Northeast',MO:'Northeast',NE:'Northeast',NH:'Northeast',NJ:'Northeast',NY:'Northeast',ND:'Northeast',OH:'Northeast',PA:'Northeast',RI:'Northeast',SD:'Northeast',VT:'Northeast',WI:'Northeast',
  AL:'Southeast',AR:'Southeast',FL:'Southeast',GA:'Southeast',LA:'Southeast',MS:'Southeast',NC:'Southeast',SC:'Southeast',
  AK:'West',AZ:'West',CA:'West',CO:'West',HI:'West',ID:'West',MT:'West',NV:'West',NM:'West',OK:'West',OR:'West',TX:'West',UT:'West',WA:'West',WY:'West',DC:'Northeast'
};
const COLLATOR = new Intl.Collator('en', {numeric:true, sensitivity:'base'});
const fmt = new Intl.NumberFormat('en-US');
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function statusClass(s){
  s=(s||'').toLowerCase();
  if(s.includes('open') && !s.includes('not open')) return 'open';
  if(s.includes('soon') || s.includes('opening') || s.includes('forecast')) return 'soon';
  if(s.includes('closed') || s.includes('last open')) return 'closed';
  return 'tbd';
}
function priorityClass(p){p=(p||'').toLowerCase(); if(p.includes('tier 1')) return 'tier1'; if(p.includes('tier 2')) return 'tier2'; if(p.includes('tier 3')) return 'tier3'; return '';}
function esc(v){return String(v??'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function link(url,text){return url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text||url)}</a>`:'—';}
function parseDateValue(v){
  if(!v) return 9999999999999;
  const d = new Date(String(v).replace(/^(Deadline|Due|Close|Closes|End|Next)[: ]+/i,''));
  return Number.isNaN(d.getTime()) ? String(v).toLowerCase() : d.getTime();
}
function compareValues(a,b){
  const na = typeof a === 'number', nb = typeof b === 'number';
  if(na && nb) return a-b;
  return COLLATOR.compare(String(a ?? ''), String(b ?? ''));
}
function sortedStates(){ return [...STATES].sort((a,b)=>COLLATOR.compare(a.state,b.state)); }
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
function fySortValue(s){ return parseDateValue(s.endDate || s.nextDate || s.startDate || s.timeline || ''); }

const stateSorters = [
  s => s.state,
  s => s.status || s.openStatus || '',
  s => fySortValue(s),
  s => s.procurementType || '',
  s => Number(s.k12Count || 0),
  s => Number(s.highPriority || 0),
  s => s.summary || '',
  s => s.sourceName || s.sourceUrl || '',
  s => s.state
];

function bindStateSortHeaders(){
  const table = $('#statesTable'); if(!table) return;
  table.querySelectorAll('thead th').forEach((th,i)=>{
    th.classList.add('sortable');
    th.setAttribute('title','Click to sort');
    th.setAttribute('role','button');
    th.tabIndex = 0;
    const toggle=()=>{ stateSort = { col:i, dir:(stateSort.col===i && stateSort.dir==='asc')?'desc':'asc' }; renderStates(); };
    th.addEventListener('click', toggle);
    th.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggle(); } });
  });
}
function updateStateSortIndicators(){
  const table = $('#statesTable'); if(!table) return;
  table.querySelectorAll('thead th').forEach((th,i)=>{
    th.classList.toggle('sort-asc', stateSort.col===i && stateSort.dir==='asc');
    th.classList.toggle('sort-desc', stateSort.col===i && stateSort.dir==='desc');
    th.setAttribute('aria-sort', stateSort.col===i ? (stateSort.dir==='asc'?'ascending':'descending') : 'none');
  });
}
async function loadData(){
  const [s,p]=await Promise.all([fetch('data/state_programs.json').then(r=>r.json()), fetch('data/prospects_k12.json').then(r=>r.json())]);
  PROSPECTS=p; STATES=ensureAllStates(s); initIndex();
}
function initIndex(){
  $('[data-current-user]') && ($('[data-current-user]').textContent=currentUser());
  populateFilters();
  renderKpis();
  bindStateSortHeaders();
  renderStates();
  ['#q','#region','#state','#status','#priority'].forEach(id=>$(id)?.addEventListener('input', renderStates));
  $('#resetFilters')?.addEventListener('click',()=>{$$('#q,#region,#state,#status,#priority').forEach(e=>e.value='');renderStates();});
  $('#exportStateCsv')?.addEventListener('click',()=>downloadCsv('slcgp_state_breakdown.csv', filteredStates().map(s=>{ const fy=fyWindow(s); return {State:s.state,Region:s.region,Status:s.status,SLCGP_FY:fy.label,Dates:fy.detail,Procurement:s.procurementType,K12:s.k12Count,HighPriority:s.highPriority,Source:s.sourceUrl}; })));
  $('#toggleStateCards')?.addEventListener('click',()=>{
    stateCardsVisible = !stateCardsVisible;
    $('#stateCards')?.classList.toggle('hidden', !stateCardsVisible);
    if($('#toggleStateCards')) $('#toggleStateCards').textContent = stateCardsVisible ? 'Hide state cards' : 'Show state cards';
  });
  $('#printBtn')?.addEventListener('click',()=>window.print());
}
function populateFilters(){
  const regions=[...new Set(STATES.map(s=>s.region).filter(Boolean))].sort((a,b)=>COLLATOR.compare(a,b));
  const r=$('#region'); if(r) r.innerHTML='<option value="">All regions</option>'+regions.map(v=>`<option>${esc(v)}</option>`).join('');
  const st=$('#state'); if(st) st.innerHTML='<option value="">All states</option>'+sortedStates().map(s=>`<option value="${s.abbr}">${esc(s.state)} (${s.abbr})</option>`).join('');
}
function renderKpis(){
  const totalK12=STATES.reduce((a,s)=>a+(s.k12Count||0),0), high=STATES.reduce((a,s)=>a+(s.highPriority||0),0), rural=STATES.reduce((a,s)=>a+(s.ruralCount||0),0), open=STATES.filter(s=>fyWindow(s).cls==='open').length, soon=STATES.filter(s=>fyWindow(s).cls==='soon').length;
  const k=$('#kpis'); if(!k) return;
  k.innerHTML=[['States',STATES.length,'All 50 states + D.C.'],['K-12 prospects',fmt.format(totalK12),'Loaded from NCES ELSI CSV'],['Tier 1/2 targets',fmt.format(high),'Remote/rural priority'],['Rural locale count',fmt.format(rural),'NCES rural locales 41-43'],['Open/opening states',`${open}/${soon}`,'Open now / forecasted']].map(x=>`<div class="card kpi-card"><div class="label">${x[0]}</div><div class="value">${x[1]}</div><div class="hint">${x[2]}</div></div>`).join('');
}
function filteredStates(){
  const q=$('#q')?.value.toLowerCase()||'', reg=$('#region')?.value||'', st=$('#state')?.value||'', stat=$('#status')?.value||'', pri=$('#priority')?.value||'';
  return STATES.filter(s=>{
    const fy=fyWindow(s);
    const hay=[s.state,s.abbr,s.region,s.status,s.openStatus,s.procurementType,s.summary,fy.label,fy.detail].join(' ').toLowerCase();
    if(q && !hay.includes(q)) return false;
    if(reg && s.region!==reg) return false;
    if(st && s.abbr!==st) return false;
    if(stat && s.openStatus!==stat) return false;
    if(pri==='high' && (s.highPriority||0)===0) return false;
    return true;
  }).sort((a,b)=>{
    const cmp = compareValues(stateSorters[stateSort.col]?.(a), stateSorters[stateSort.col]?.(b));
    return stateSort.dir === 'asc' ? cmp : -cmp;
  });
}
function renderStates(){
  const rows=filteredStates();
  updateStateSortIndicators();
  $('#visibleCount').textContent=fmt.format(rows.length);
  const table=$('#statesTable tbody'); if(!table) return;
  table.innerHTML=rows.map(s=>{
    const fy=fyWindow(s);
    const pct=s.k12Count?Math.round((s.highPriority/s.k12Count)*100):0;
    return `<tr>
      <td><strong>${esc(s.state)}</strong><span class="source-tag">${esc(s.region)}</span></td>
      <td><span class="status ${statusClass(s.status)}">${esc(s.status)}</span></td>
      <td><span class="status ${fy.cls}">${esc(fy.label)}</span><span class="source-tag">${esc(fy.detail)}</span></td>
      <td>${esc(s.procurementType)}</td>
      <td class="nowrap"><strong>${fmt.format(s.k12Count||0)}</strong><span class="source-tag">${fmt.format(s.totalSchools||0)} schools</span></td>
      <td><strong>${fmt.format(s.highPriority||0)}</strong><div class="progress-bar" title="${pct}%"><span style="width:${Math.min(100,pct)}%"></span></div></td>
      <td>${esc(s.summary||'')}</td>
      <td>${link(s.sourceUrl,'Source')}</td>
      <td><a class="action-link" href="state.html?state=${s.abbr}" aria-label="Open ${esc(s.state)} state page">Open</a></td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" class="empty">No states match the filters.</td></tr>`;
  const cards=$('#stateCards');
  if(cards){cards.innerHTML=rows.map(s=>{ const fy=fyWindow(s); return `<div class="card state-card"><h3>${esc(s.state)}</h3><div class="meta"><span class="pill">${esc(s.region)}</span><span class="status ${statusClass(s.status)}">${esc(s.status)}</span><span class="status ${fy.cls}">${esc(fy.label)}</span></div><p>${esc(s.summary)}</p><div class="two-col"><div><strong>${fmt.format(s.k12Count||0)}</strong><br><span class="mini">K-12 prospects</span></div><div><strong>${fmt.format(s.highPriority||0)}</strong><br><span class="mini">Tier 1/2</span></div></div><p class="mini"><strong>Dates:</strong> ${esc(fy.detail)}</p><a class="action-link" href="state.html?state=${s.abbr}">Open state page</a></div>`; }).join('')}
}
function downloadCsv(filename, rows){
  if(!rows.length) return;
  const headers=Object.keys(rows[0]);
  const csv=[headers.join(',')].concat(rows.map(r=>headers.map(h=>`"${String(r[h]??'').replace(/"/g,'""')}"`).join(','))).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
window.addEventListener('DOMContentLoaded',()=>{requireLogin(); loadData().catch(e=>{console.error(e); document.body.insertAdjacentHTML('beforeend','<div class="empty">Could not load data files.</div>')})});
