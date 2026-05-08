
let STATES=[], PROSPECTS=[];
let stateSort = { col: 0, dir: 'asc' };
let stateCardsVisible = false;
const stateSorters = [
  s => s.state,
  s => s.status || s.openStatus || '',
  s => parseDateValue(s.endDate || s.nextDate || ''),
  s => s.procurementType || '',
  s => Number(s.k12Count || 0),
  s => Number(s.highPriority || 0),
  s => s.summary || '',
  s => s.sourceName || s.sourceUrl || '',
  s => s.state
];
const fmt = new Intl.NumberFormat('en-US');
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
function statusClass(s){s=(s||'').toLowerCase(); if(s.includes('open')) return 'open'; if(s.includes('soon')) return 'soon'; if(s.includes('closed')) return 'closed'; return 'tbd';}
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
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, {numeric:true, sensitivity:'base'});
}
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
  STATES=s; PROSPECTS=p; initIndex();
}
function initIndex(){
  populateFilters();
  renderKpis();
  bindStateSortHeaders();
  renderStates();
  ['#q','#region','#state','#status','#priority'].forEach(id=>$(id)?.addEventListener('input', renderStates));
  $('#resetFilters')?.addEventListener('click',()=>{$$('#q,#region,#state,#status,#priority').forEach(e=>e.value='');renderStates();});
  $('#exportStateCsv')?.addEventListener('click',()=>downloadCsv('slcgp_state_breakdown.csv', filteredStates().map(s=>({State:s.state,Region:s.region,Status:s.status,EndNext:s.endDate||s.nextDate,Procurement:s.procurementType,K12:s.k12Count,HighPriority:s.highPriority,Source:s.sourceUrl}))));
  $('#toggleStateCards')?.addEventListener('click',()=>{
    stateCardsVisible = !stateCardsVisible;
    $('#stateCards')?.classList.toggle('hidden', !stateCardsVisible);
    if($('#toggleStateCards')) $('#toggleStateCards').textContent = stateCardsVisible ? 'Hide state cards' : 'Show state cards';
  });
  $('#printBtn')?.addEventListener('click',()=>window.print());
}
function populateFilters(){
  const regions=[...new Set(STATES.map(s=>s.region))].sort(); const r=$('#region'); if(r) r.innerHTML='<option value="">All regions</option>'+regions.map(v=>`<option>${v}</option>`).join('');
  const st=$('#state'); if(st) st.innerHTML='<option value="">All states</option>'+[...STATES].sort((a,b)=>a.state.localeCompare(b.state)).map(s=>`<option value="${s.abbr}">${s.state}</option>`).join('');
}
function renderKpis(){
  const totalK12=STATES.reduce((a,s)=>a+(s.k12Count||0),0), high=STATES.reduce((a,s)=>a+(s.highPriority||0),0), rural=STATES.reduce((a,s)=>a+(s.ruralCount||0),0), open=STATES.filter(s=>s.openStatus==='Open').length, soon=STATES.filter(s=>/soon|summer|spring/i.test(s.status+' '+s.nextDate)).length;
  const k=$('#kpis'); if(!k) return;
  k.innerHTML=[['States',STATES.length,'All 50 states + D.C.'],['K-12 prospects',fmt.format(totalK12),'Loaded from NCES ELSI CSV'],['Tier 1/2 targets',fmt.format(high),'Remote/rural priority'],['Rural locale count',fmt.format(rural),'NCES rural locales 41-43'],['Open/soon states',`${open}/${soon}`,'Open now / coming soon']].map(x=>`<div class="card kpi-card"><div class="label">${x[0]}</div><div class="value">${x[1]}</div><div class="hint">${x[2]}</div></div>`).join('');
}
function filteredStates(){
  const q=$('#q')?.value.toLowerCase()||'', reg=$('#region')?.value||'', st=$('#state')?.value||'', stat=$('#status')?.value||'', pri=$('#priority')?.value||'';
  return STATES.filter(s=>{
    const hay=[s.state,s.abbr,s.region,s.status,s.procurementType,s.summary].join(' ').toLowerCase();
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
    const end=s.endDate||s.nextDate||'TBD';
    const pct=s.k12Count?Math.round((s.highPriority/s.k12Count)*100):0;
    return `<tr>
      <td><strong>${esc(s.state)}</strong><span class="source-tag">${esc(s.region)}</span></td>
      <td><span class="status ${statusClass(s.status)}">${esc(s.status)}</span></td>
      <td>${esc(end)}</td>
      <td>${esc(s.procurementType)}</td>
      <td class="nowrap"><strong>${fmt.format(s.k12Count||0)}</strong><span class="source-tag">${fmt.format(s.totalSchools||0)} schools</span></td>
      <td><strong>${fmt.format(s.highPriority||0)}</strong><div class="progress-bar" title="${pct}%"><span style="width:${Math.min(100,pct)}%"></span></div></td>
      <td>${esc(s.summary||'')}</td>
      <td>${link(s.sourceUrl,'Source')}</td>
      <td><a class="btn small primary" href="state.html?state=${s.abbr}">Open state</a></td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" class="empty">No states match the filters.</td></tr>`;
  const cards=$('#stateCards'); if(cards){cards.innerHTML=rows.map(s=>`<div class="card state-card"><h3>${esc(s.state)}</h3><div class="meta"><span class="pill">${esc(s.region)}</span><span class="status ${statusClass(s.status)}">${esc(s.status)}</span></div><p>${esc(s.summary)}</p><div class="two-col"><div><strong>${fmt.format(s.k12Count||0)}</strong><br><span class="mini">K-12 prospects</span></div><div><strong>${fmt.format(s.highPriority||0)}</strong><br><span class="mini">Tier 1/2</span></div></div><p class="mini"><strong>Next:</strong> ${esc(s.endDate||s.nextDate||'TBD')}</p><a class="btn primary" href="state.html?state=${s.abbr}">Open State Level Page</a></div>`).join('')}
}
function downloadCsv(filename, rows){
  if(!rows.length) return;
  const headers=Object.keys(rows[0]);
  const csv=[headers.join(',')].concat(rows.map(r=>headers.map(h=>`"${String(r[h]??'').replace(/"/g,'""')}"`).join(','))).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
window.addEventListener('DOMContentLoaded',()=>{requireLogin(); loadData().catch(e=>{console.error(e); document.body.insertAdjacentHTML('beforeend','<div class="empty">Could not load data files.</div>')})});
