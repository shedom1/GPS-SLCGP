
const ALL_STATE_VALUE='ALL';
const DLT_MAP='https://ruraldevelopment.maps.arcgis.com/apps/webappviewer/index.html?id=15a73830555645ae93d2fa773ed8e971';
const STATE_FIPS={AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',DC:'11',FL:'12',GA:'13',HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56'};
const STATE_NAMES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'41',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
STATE_NAMES.OR='Oregon';
const NCES_SCHOOLS='https://services1.arcgis.com/Ua5sjt3LWTPigjyD/ArcGIS/rest/services/School_Characteristics_Current/FeatureServer/0/query';
const NCES_DISTRICTS='https://services1.arcgis.com/Ua5sjt3LWTPigjyD/ArcGIS/rest/services/School_District_Characteristics_Current/FeatureServer/1/query';

const ELSI_DISTRICTS_CSV = 'data/ELSI_K12_School_Districts_2025_Scoring_Tool.csv';
const ELSI_DISTRICTS_CSV_OPTIONS = [
  'data/ELSI_K12_School_Districts_2025_Scoring_Tool.csv',
  'data/ELSI K-12 School Districts 2025-Scoring Tool.csv',
  './data/ELSI_K12_School_Districts_2025_Scoring_Tool.csv',
  './data/ELSI K-12 School Districts 2025-Scoring Tool.csv'
];
const PRIOR_AWARDS_CSV = 'data/rus_dlt_all_sites_2026-05-08.csv';
let elsiDistrictCache = null;
let elsiDistrictSourceUrl = '';
function cleanElsi(v){v=String(v??'').trim();return (v==='†'||v==='-'||v==='–')?'':v;}
function findElsiHeaderIndex(rows){
  return Math.max(0, rows.findIndex(r=>r.some(c=>/Agency Name/i.test(String(c))) && r.some(c=>/Web Site URL/i.test(String(c))) && r.some(c=>/Agency ID.*NCES/i.test(String(c)))));
}
function elsiObjectsFromCsv(text){
  const rows=parseCSV(text); const hi=findElsiHeaderIndex(rows); const headers=rows[hi].map(h=>String(h||'').trim());
  return rows.slice(hi+1).map(r=>rowToObject(headers,r)).filter(o=>cleanElsi(o['Agency Name']) || cleanElsi(o['Agency Name [District] 2024-25']));
}
async function loadElsiDistricts(){
  if(elsiDistrictCache) return elsiDistrictCache;
  const attempts=[];
  for(const url of ELSI_DISTRICTS_CSV_OPTIONS){
    try{
      const res=await fetch(url,{cache:'no-store'});
      if(!res.ok){attempts.push(`${url}: HTTP ${res.status}`);continue;}
      const text=await res.text();
      const parsed=elsiObjectsFromCsv(text);
      if(!parsed.length){attempts.push(`${url}: loaded but no rows parsed`);continue;}
      elsiDistrictCache=parsed;
      elsiDistrictSourceUrl=url;
      return elsiDistrictCache;
    }catch(e){attempts.push(`${url}: ${e.message}`)}
  }
  throw new Error('Could not load bundled ELSI/NCES district CSV. Tried '+attempts.join(' | '));
}
function elsiObjToDistrictFeature(o){
  const state=cleanElsi(o['Location State Abbr [District] 2024-25'] || o['State Abbr [District] Latest available year']).toUpperCase();
  return {attributes:{
    LEA_NAME: cleanElsi(o['Agency Name [District] 2024-25'] || o['Agency Name']),
    LEAID: cleanElsi(o['Agency ID - NCES Assigned [District] Latest available year']),
    CONAME: cleanElsi(o['County Name [District] 2024-25']),
    LSTREET1: cleanElsi(o['Location Address 1 [District] 2024-25']),
    LSTREET2: cleanElsi(o['Location Address 2 [District] 2024-25']),
    LCITY: cleanElsi(o['Location City [District] 2024-25']),
    LSTATE: state,
    STABR: state,
    LZIP: cleanElsi(o['Location ZIP [District] 2024-25']),
    PHONE: cleanElsi(o['Phone Number [District] 2024-25']),
    WEBSITE: cleanElsi(o['Web Site URL [District] 2024-25']),
    LOCALE_TEXT: cleanElsi(o['Locale [District] 2024-25']),
    MEMBER: cleanElsi(o['Total Students All Grades (Excludes AE) [District] 2024-25']),
    SCH: cleanElsi(o['Total Number Operational Schools [Public School] 2024-25']),
    TYPE_TEXT: cleanElsi(o['Agency Type [District] 2024-25']),
    CBSA: cleanElsi(o['CBSA Name [District] 2024-25']),
    CSA: cleanElsi(o['CSA Name [District] 2024-25']),
    METRO_MICRO: cleanElsi(o['Metro Micro Area Code [District] 2024-25']),
    Lat: cleanElsi(o['Latitude [District] 2024-25']),
    Long: cleanElsi(o['Longitude [District] 2024-25'])
  }};
}
function districtFeatureFromElsiLeaId(leaId){
  const rows=elsiDistrictCache||[];
  const found=rows.find(o=>cleanElsi(o['Agency ID - NCES Assigned [District] Latest available year'])===String(leaId));
  return found?elsiObjToDistrictFeature(found):null;
}
function filterElsiDistricts(rows, {state, term='', county='', city='', agency='', address=''}={}){
  const st=String(state||'').toUpperCase(); const t=norm(term||agency); const c=norm(county), ci=norm(city), ad=norm(address);
  return rows.filter(o=>{
    const f=elsiObjToDistrictFeature(o).attributes;
    if(st && st!==ALL_STATE_VALUE && String(f.LSTATE||'').toUpperCase()!==st) return false;
    if(t && !norm([f.LEA_NAME,f.LEAID,f.TYPE_TEXT].join(' ')).includes(t)) return false;
    if(c && !norm(f.CONAME).includes(c)) return false;
    if(ci && !norm(f.LCITY).includes(ci)) return false;
    if(ad && !norm([f.LSTREET1,f.LSTREET2,f.LCITY,f.LZIP].join(' ')).includes(ad)) return false;
    return true;
  });
}

const HIGHER_ED='https://services2.arcgis.com/FiaPA4ga0iQKduv3/ArcGIS/rest/services/Colleges_and_Universities_View/FeatureServer/0/query';
const HRSA_XLSX='https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.xlsx';
const HRSA_CSV='https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv';
const HRSA_LOCAL_XLSX='data/Health_Center_Service_Delivery_and_LookAlike_Sites.xlsx';
const HRSA_LOCAL_CSV='data/Health_Center_Service_Delivery_and_LookAlike_Sites.csv';
let prospects=[]; let placeCache={}; let saipeCache={}; let hrsaLookupCache=null; let sortState={key:'objectiveScore',dir:'desc'}; let columnWidths={};
const COLS=[
  ['selected','Select',54,'bool'],['fitLabel','Fit',82,'text'],['reviewReason','Review Reason',190,'text'],['lookupSuggestion','Lookup Suggestion',245,'text'],['objectiveScore','Obj.',60,'number'],['ruralityScore','D-1',55,'number'],['economicScore','D-2',55,'number'],['saipePercent','SAIPE %',72,'number'],['cityPopulation','2020 Pop',82,'number'],['type','Type',98,'text'],['schoolCount','# Schools',76,'number'],['organization','Organization / Entity',170,'text'],['siteName','Site',180,'text'],['address','Address',175,'text'],['city','City',90,'text'],['county','County',105,'text'],['state','State',48,'text'],['zip','ZIP',70,'text'],['phone','Phone',108,'text'],['email','Email',165,'text'],['website','Website',165,'text'],['sourceLocale','Locale',70,'text'],['description','Description from source fields',240,'text'],['source','Source',140,'text'],['map','USDA Map',76,'text']
];
function init(){const sel=document.getElementById('pfState');const all=document.createElement('option');all.value=ALL_STATE_VALUE;all.textContent='ALL — Target score scan';sel.appendChild(all);Object.keys(STATE_FIPS).forEach(abbr=>{const o=document.createElement('option');o.value=abbr;o.textContent=`${abbr} — ${STATE_NAMES[abbr]}`;sel.appendChild(o)});sel.value=ALL_STATE_VALUE;const awardSel=document.getElementById('awardState');if(awardSel){const ao=document.createElement('option');ao.value='';ao.textContent='Use prospect state / All';awardSel.appendChild(ao);Object.keys(STATE_FIPS).forEach(abbr=>{const o=document.createElement('option');o.value=abbr;o.textContent=`${abbr} — ${STATE_NAMES[abbr]}`;awardSel.appendChild(o)});}COLS.forEach(c=>columnWidths[c[0]]=c[2]);renderTable();updateMetrics();}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function firstUrl(v){v=String(v||'').trim();if(!v)return '';const m=v.match(/https?:\/\/[^\s,;]+|www\.[^\s,;]+|[A-Za-z0-9.-]+\.[A-Za-z]{2,}[^\s,;]*/);return m?m[0]:v}
function firstEmail(v){v=String(v||'').trim();const m=v.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);return m?m[0]:v}
function websiteCell(v){const url=firstUrl(v);if(!url)return '';const href=/^https?:\/\//i.test(url)?url:'https://'+url;return `<a href="${esc(href)}" target="_blank" rel="noopener" title="${esc(v)}">${esc(url)}</a>`}
function emailCell(v){const e=firstEmail(v);if(!e)return '';return /@/.test(e)?`<a href="mailto:${esc(e)}" title="${esc(v)}">${esc(e)}</a>`:esc(e)}
function norm(s){return String(s||'').toLowerCase().replace(/\b(county|parish|borough|municipality|city and borough|city|town|village|cdp|unified government|balance)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function sqlText(s){return String(s||'').replace(/'/g,"''").trim();}
function onlyDigits(s){return String(s||'').replace(/\D/g,'');}
function setStatus(s){document.getElementById('pfStatus').innerHTML=s||'';}
function setBusy(on,msg='Working...'){const pill=document.getElementById('busyPill');const text=document.getElementById('busyText');if(text)text.textContent=msg;if(pill)pill.classList.toggle('hidden',!on);document.querySelectorAll('button').forEach(b=>{if(b.closest('#hrsaFallback'))return;b.disabled=!!on&&!(b.textContent||'').includes('Clear')});}
function nextFrame(){return new Promise(resolve=>requestAnimationFrame(resolve));}
function csvCell(v){v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function download(name,content,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
function cleanCountyFips(cnty,st){let d=onlyDigits(cnty);if(d.length===3&&st&&STATE_FIPS[st])d=STATE_FIPS[st]+d;return d.padStart(5,'0').slice(-5)}
function fieldKey(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim()}
function pick(o,keys){const ks=Object.keys(o||{});for(const k of keys){if(o[k]!==undefined&&String(o[k]).trim()!=='')return String(o[k]).trim();const target=fieldKey(k);const found=ks.find(x=>fieldKey(x)===target);if(found&&String(o[found]).trim()!=='')return String(o[found]).trim()}return ''}
function charterFlagFromAttrs(a){
  const keys=['CHARTER_TEXT','CHARTER','CHARTER_YN','CHARTER_IND','CHARTERSTATUS','CHARTER_STATUS','IS_CHARTER'];
  const vals=keys.map(k=>String(a?.[k]??'').trim()).filter(Boolean);
  const joined=vals.join(' ').toLowerCase();
  return /\byes\b|\by\b|\btrue\b|\b1\b|charter school/.test(joined);
}
function k12TypeFromAttrs(a){return charterFlagFromAttrs(a)?'Charter School':'K-12'}
function buildDesc(s){const bits=[];if(s.type==='K-12 District'){bits.push('NCES public school district record');if(s.siteName)bits.push(`district office: ${s.siteName}`);if(s.sourceLocale)bits.push(`locale: ${s.sourceLocale}`);if(s.schoolCount)bits.push(`school count: ${s.schoolCount}`);if(s.enrollment)bits.push(`students: ${s.enrollment}`)}else if(s.type==='K-12'||s.type==='Charter School'){bits.push(s.type==='Charter School'?'NCES public charter school record':'NCES public school record');if(s.organization)bits.push(`district: ${s.organization}`);if(s.sourceLocale)bits.push(`locale: ${s.sourceLocale}`);if(s.enrollment)bits.push(`enrollment: ${s.enrollment}`)}else if(s.type==='Rural Health'){bits.push('HRSA health center service delivery/look-alike site record');if(s.organization)bits.push(`health center: ${s.organization}`)}else if(s.type==='Higher Ed'){bits.push('Higher-ed institution/campus source record');if(s.sourceLocale)bits.push(`locale: ${s.sourceLocale}`)}if(s.county)bits.push(`county: ${s.county}`);if(s.city||s.state)bits.push(`location: ${[s.city,s.state].filter(Boolean).join(', ')}`);return bits.join('; ')+(bits.length?'.':'')}
function siteHasCoords(s){return !isNaN(parseFloat(s.lat))&&!isNaN(parseFloat(s.lon))}
function distanceMiles(lat1,lon1,lat2,lon2){const R=3958.7613;const toRad=x=>x*Math.PI/180;const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function sourceLinkFor(s){if(s&&siteHasCoords(s)){const lon=parseFloat(s.lon),lat=parseFloat(s.lat);return `${DLT_MAP}&center=${encodeURIComponent(lon+','+lat)}&level=12`;}return DLT_MAP;}
async function arcgisQueryAll(url,where,fields,cap=25000){
  let out=[],offset=0,page=2000;
  while(out.length<cap){
    const params=new URLSearchParams({
      where:where||'1=1',
      outFields:fields||'*',
      returnGeometry:'false',
      f:'json',
      sqlFormat:'standard',
      resultRecordCount:String(Math.min(page,cap-out.length)),
      resultOffset:String(offset)
    });
    let data=null;
    try{
      const res=await fetch(`${url}?${params.toString()}`);
      if(!res.ok)throw new Error('GET '+res.status);
      data=await res.json();
    }catch(getErr){
      const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:params});
      if(!res.ok)throw new Error('Source returned '+res.status);
      data=await res.json();
    }
    if(data.error){
      const msg=[data.error.message,(data.error.details||[]).join('; ')].filter(Boolean).join(' — ');
      throw new Error(msg||JSON.stringify(data.error));
    }
    const features=data.features||[];
    out.push(...features);
    if(!data.exceededTransferLimit||!features.length)break;
    offset+=features.length;
    if(out.length%10000===0){setBusy(true,`⏱️ Still searching source records... ${out.length.toLocaleString()} loaded`);await nextFrame();}
  }
  return out;
}
function scopeWhere(field,st){return st===ALL_STATE_VALUE?'1=1':`${field}='${st}'`}
function scopeLabel(st){return st===ALL_STATE_VALUE?'ALL STATES':st}
function runAllStatesTargetScore(){document.getElementById('pfState').value=ALL_STATE_VALUE;document.getElementById('pfMode').value='high';document.getElementById('pfIncludeReview').checked=true;document.getElementById('pfK12Districts').checked=true;document.getElementById('pfCharter').checked=true;document.getElementById('pfHealthcare').checked=true;document.getElementById('pfHigherEd').checked=true;findProspects()}
function showNeedsReviewOnly(){document.getElementById('pfMode').value='needsReview';document.getElementById('pfIncludeReview').checked=true;findProspects()}
async function arcgisQuery(url,where,fields,count=2000){return arcgisQueryAll(url,where,fields,count)}
function wherePart(field,val){return val?` AND UPPER(${field}) LIKE '%${sqlText(val).toUpperCase()}%'`:''}
function whereOrPart(fields,val){if(!val)return '';const q=sqlText(val).toUpperCase();return ` AND (${fields.map(f=>`UPPER(${f}) LIKE '%${q}%'`).join(' OR ')})`}
function textMatch(haystack,needle){return !needle||norm(String(haystack||'')).includes(norm(needle))}
function prospectMatchesTextFilters(r,agency,address){
  const agencyText=[r.organization,r.siteName,r.sourceId,r.description].join(' ');
  const addressText=[r.address,r.city,r.county,r.state,r.zip].join(' ');
  return textMatch(agencyText,agency)&&textMatch(addressText,address);
}
async function findProspects(){
  const st=document.getElementById('pfState').value;
  const county=document.getElementById('pfCounty').value.trim();
  const city=document.getElementById('pfCity').value.trim();
  const agency=document.getElementById('pfAgency').value.trim();
  const address=document.getElementById('pfAddress').value.trim();
  const displayLimit=Math.max(25,Math.min(200000,parseInt(document.getElementById('pfMax').value)||5000));
  const useK12Districts=document.getElementById('pfK12Districts').checked;
  const useK12=document.getElementById('pfK12').checked;
  const useCharter=document.getElementById('pfCharter').checked;
  const useH=document.getElementById('pfHealthcare').checked;
  const useHE=document.getElementById('pfHigherEd').checked;
  if(!useK12Districts&&!useK12&&!useCharter&&!useH&&!useHE){setBusy(false);setStatus('Select at least one prospect type.');return}
  prospects=[];renderTable();
  setBusy(true,'⏱️ Searching source records...');
  setStatus(`⏱️ Searching complete source record sets for <strong>${scopeLabel(st)}</strong>${county?`, county: ${esc(county)}`:''}${city?`, city: ${esc(city)}`:''}${agency?`, agency/org: ${esc(agency)}`:''}${address?`, address: ${esc(address)}`:''}...`);
  let rows=[];const errors=[];const sourceCap=st===ALL_STATE_VALUE?200000:25000;
  if(useK12Districts){
    try{
      setBusy(true,'⏱️ Searching local ELSI/NCES district CSV with websites...');
      const local=await loadElsiDistricts();
      rows.push(...filterElsiDistricts(local,{state:st,county,city,agency,address}).map(o=>k12DistrictToSite(elsiObjToDistrictFeature(o))));
    }catch(e){errors.push('K-12 district CSV failed: '+e.message)}
  }
  if(useK12||useCharter){
    try{
      setBusy(true,useCharter&&!useK12?'⏱️ Searching NCES charter school records...':'⏱️ Searching NCES school-site records...');
      const f='*';
      let where=scopeWhere('STABR',st);
      const schoolRows=(await arcgisQueryAll(NCES_SCHOOLS,where,f,sourceCap)).map(k12ToSite);
      rows.push(...(useK12 ? schoolRows : schoolRows.filter(r=>r.type==='Charter School')));
    }catch(e){errors.push('K-12 school/charter layer failed: '+e.message)}
  }
  if(useHE){
    try{
      setBusy(true,'⏱️ Searching higher-ed / technical-school records...');
      const f='*';
      let where=scopeWhere('STABBR',st);
      rows.push(...(await arcgisQueryAll(HIGHER_ED,where,f,sourceCap)).map(higherToSite));
    }catch(e){errors.push('Higher-ed failed: '+e.message)}
  }
  if(useH){
    try{
      setBusy(true,'⏱️ Searching HRSA health-center records...');
      const items=await getHRSALookupItems();
      rows.push(...items.filter(x=>st===ALL_STATE_VALUE||x.state===st).filter(x=>!county||norm(x.county).includes(norm(county))).filter(x=>!city||norm(x.city).includes(norm(city))).filter(x=>prospectMatchesTextFilters(x,agency,address)).map(x=>({...x,id:crypto.randomUUID()})));
    }catch(e){errors.push(e.message)}
  }
  rows=dedupe(rows)
    .filter(r=>st===ALL_STATE_VALUE||String(r.state||'').toUpperCase()===st)
    .filter(r=>!county||norm(r.county).includes(norm(county)))
    .filter(r=>!city||norm(r.city).includes(norm(city)))
    .filter(r=>prospectMatchesTextFilters(r,agency,address));
  const sourceCount=rows.length;
  setBusy(true,`⏱️ Adding Census population + SAIPE data... 0/${sourceCount.toLocaleString()}`);
  setStatus(`⏱️ Found <strong>${sourceCount}</strong> source record(s) before eligibility filters. Adding Census place population and SAIPE data...`);
  let processed=0;
  for(const r of rows){
    if(!r.cityPopulation&&(r.ruralityPlace||r.city))await enrichPlacePop(r);
    if(!r.saipePercent)await enrichSaipe(r);
    scoreRow(r);
    processed++;
    if(processed===1||processed%25===0||processed===sourceCount){
      setBusy(true,`⏱️ Adding Census population + SAIPE data... ${processed.toLocaleString()}/${sourceCount.toLocaleString()}`);
      setStatus(`⏱️ Adding Census population + SAIPE data... <strong>${processed.toLocaleString()}</strong> of <strong>${sourceCount.toLocaleString()}</strong> source record(s) processed.`);
      await nextFrame();
    }
  }
  const screened=applyProspectFilters(rows);
  prospects=sortRows(screened).slice(0,displayLimit);
  renderTable();updateMetrics();
  setBusy(false);
  const high=screened.filter(x=>x.fitLabel==='High Fit').length;
  const review=countNeedsReview(screened);
  const hidden=Math.max(0,screened.length-prospects.length);
  const filteredOut=Math.max(0,sourceCount-screened.length);
  const exactMsg=(document.getElementById('pfShowExactMatches')?.checked!==false&&hasExplicitLookupSearch())?' Name/address match override is ON, so matched source rows display even when they are below target score.':'';
  setStatus(`<strong>${prospects.length}</strong> row(s) displayed from <strong>${sourceCount}</strong> source record(s). <strong>${high}</strong> high fit; <strong>${review}</strong> review-needed.${filteredOut?` ${filteredOut} source row(s) hidden by score/SAIPE/population filters.`:''}${hidden?` ${hidden} additional filtered rows hidden by Display Limit.`:''}${exactMsg} ${errors.length?'<br><span style="color:#92400e">'+esc(errors.join(' | '))+'</span>':''}`)
}
function k12DistrictToSite(f){const a=f.attributes||{},g=f.geometry||{},cent=f.centroid||{};const s={id:crypto.randomUUID(),selected:false,include:false,type:'K-12 District',source:'ELSI/NCES K-12 School Districts 2025 CSV',sourceId:a.LEAID||'',organization:a.LEA_NAME||'',siteName:a.LEA_NAME||'',address:[a.LSTREET1,a.LSTREET2].filter(Boolean).join(' '),city:a.LCITY||'',ruralityPlace:'',state:a.LSTATE||'',zip:a.LZIP||'',county:a.CONAME||'',countyFips:cleanCountyFips(a.COID,a.LSTATE),phone:pick(a,['PHONE','TEL','TELEPHONE']),email:pick(a,['EMAIL','E_MAIL','CONTACT_EMAIL','CONTACTEMAIL','LEA_EMAIL','ADMIN_EMAIL']),website:pick(a,['WEBSITE','WEB_SITE','URL','WEBADDR','LEA_URL','LEA_WEBSITE','WWW']),sourceLocale:a.LOCALE_TEXT||'',enrollment:a.MEMBER||'',schoolCount:a.SCH||'',designation:'Hub',contiguous:'Unknown',outsideNonRural:'Unknown',censusRural:'Unknown',cityPopulation:'',saipePercent:'',ruralityScore:null,economicScore:null,lat:g.y||cent.y||a.Lat||'',lon:g.x||cent.x||a.Long||'',notes:'Prospect Finder result from official NCES district layer; district office imported as a potential hub/anchor. Add specific school sites before final scoring.'};s.description=buildDesc(s);return s}
function k12ToSite(f){const a=f.attributes||{},g=f.geometry||{};const s={id:crypto.randomUUID(),selected:false,include:false,type:k12TypeFromAttrs(a),source:'NCES CCD Public School Characteristics',sourceId:a.NCESSCH||'',organization:a.LEA_NAME||'',siteName:a.SCH_NAME||'',address:[a.LSTREET1,a.LSTREET2].filter(Boolean).join(' '),city:a.LCITY||'',ruralityPlace:'',state:a.LSTATE||a.STABR||'',zip:a.LZIP||'',county:a.NMCNTY||'',countyFips:cleanCountyFips(a.CNTY,a.STABR),phone:pick(a,['PHONE','TEL','TELEPHONE']),email:pick(a,['EMAIL','E_MAIL','CONTACT_EMAIL','CONTACTEMAIL','SCHOOL_EMAIL','ADMIN_EMAIL']),website:pick(a,['WEBSITE','WEB_SITE','URL','WEBADDR','SCH_URL','SCHOOL_URL','WWW']),sourceLocale:a.ULOCALE||'',enrollment:a.MEMBER||a.TOTAL||'',designation:'End-User',contiguous:'Unknown',outsideNonRural:'Unknown',censusRural:'Unknown',cityPopulation:'',saipePercent:'',ruralityScore:null,economicScore:null,lat:g.y||a.LATCOD||'',lon:g.x||a.LONCOD||'',notes:'Prospect Finder result from official NCES school layer; verify DLT map and site role before scoring.'};s.description=buildDesc(s);return s}
function higherToSite(f){const a=f.attributes||{},g=f.geometry||{};const s={id:crypto.randomUUID(),selected:false,include:false,type:'Higher Ed',source:'IPEDS / ArcGIS Colleges and Universities Feature Layer',sourceId:a.UNITID||'',organization:a.F1SYSNAM||a.INSTNM||'',siteName:a.INSTNM||'',address:a.ADDR||'',city:a.CITY||'',ruralityPlace:'',state:a.STABBR||'',zip:a.ZIP||'',county:a.COUNTYNM||'',countyFips:cleanCountyFips(a.COUNTYCD,a.STABBR),phone:pick(a,['GENTELE','PHONE','TELEPHONE']),email:pick(a,['EMAIL','E_MAIL','CONTACT_EMAIL','ADMIN_EMAIL','FAIDEMAIL']),website:pick(a,['WEBADDR','WEBSITE','URL','ADMINURL','FAIDURL','APPLURL']),sourceLocale:a.LOCALE||'',enrollment:'',designation:'End-User',contiguous:'Unknown',outsideNonRural:'Unknown',censusRural:'Unknown',cityPopulation:'',saipePercent:'',ruralityScore:null,economicScore:null,lat:g.y||a.LATITUDE||'',lon:g.x||a.LONGITUD||'',notes:'Prospect Finder result from higher-ed source layer; verify DLT map and site role before scoring.'};s.description=buildDesc(s);return s}
function hrsaToSite(o){const state=(pick(o,['Site State Abbreviation','Site State','State','State Abbreviation'])||'').toUpperCase();const siteName=pick(o,['Site Name','Health Center Site Name','Name']);if(!siteName||!state)return null;const fips=cleanCountyFips(pick(o,['County FIPS Code','County Equivalent FIPS Code','County Equivalent Code','County Code','County FIPS','Site County FIPS']),state);const s={id:crypto.randomUUID(),selected:false,include:false,type:'Rural Health',source:'HRSA Health Center Service Delivery and Look-Alike Sites XLSX',sourceId:pick(o,['Site ID','Site Number','BHCMIS ID','Grant Number','Health Center Number']),organization:pick(o,['Health Center Name','Organization Name','Awardee Name']),siteName,address:pick(o,['Site Address','Address','Street Address']),city:pick(o,['Site City','City']),ruralityPlace:'',state,zip:pick(o,['Site Postal Code','ZIP','Zip Code']),county:pick(o,['County Equivalent Name','County','Site County']),countyFips:fips,phone:pick(o,['Site Telephone Number','Phone','Telephone','Telephone Number']),email:pick(o,['Site Email Address','Site Email','Email','Contact Email','E-mail','E-Mail Address']),website:pick(o,['Site Web Address','Website','Web Address','URL','Site URL']),sourceLocale:'',enrollment:'',designation:'End-User',contiguous:'Unknown',outsideNonRural:'Unknown',censusRural:'Unknown',cityPopulation:'',saipePercent:'',ruralityScore:null,economicScore:null,lat:pick(o,['Latitude','Site Latitude','Site Latitude Number']),lon:pick(o,['Longitude','Site Longitude','Site Longitude Number']),notes:'Prospect Finder result from HRSA source; verify telemedicine use, site role, and DLT map before scoring.'};s.description=buildDesc(s);return s}
async function getHRSALookupItems(){
  if(hrsaLookupCache?.length)return hrsaLookupCache;
  if(!window.XLSX)throw new Error('HRSA needs the XLSX fallback upload because the XLSX parser did not load.');
  const attempts=[
    {label:'local bundled HRSA XLSX',url:HRSA_LOCAL_XLSX,type:'xlsx'},
    {label:'local bundled HRSA CSV',url:HRSA_LOCAL_CSV,type:'csv'},
    {label:'official HRSA XLSX',url:HRSA_XLSX,type:'xlsx'},
    {label:'official HRSA CSV',url:HRSA_CSV,type:'csv'}
  ];
  const failures=[];
  for(const a of attempts){
    try{
      const res=await fetch(a.url,{cache:'no-store'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      let items=[];
      if(a.type==='csv'){
        const rows=parseCSV(await res.text());
        const headers=rows[0]||[];
        items=rows.slice(1).map(r=>rowToObject(headers,r)).map(hrsaToSite).filter(Boolean);
      }else{
        const buf=await res.arrayBuffer();
        const wb=XLSX.read(buf,{type:'array'});
        items=workbookToHRSASites(wb);
      }
      if(!items.length)throw new Error('No usable HRSA rows found.');
      hrsaLookupCache=items;
      setStatus(`<strong>${items.length.toLocaleString()}</strong> HRSA records loaded as a full-table lookup from ${esc(a.label)}. State/county/city filters are applied locally after the full source table loads.`);
      return items;
    }catch(e){failures.push(`${a.label}: ${e.message}`);}
  }
  throw new Error('HRSA full-table lookup could not load from a bundled file or live HRSA download. This usually means the HRSA file was not included in /data or the browser blocked the official HRSA download. Upload the full HRSA XLSX/CSV with HRSA Fallback Upload. Details: '+failures.join(' | '));
}
function workbookToHRSASites(wb){let best={score:-1,objects:[],sheetName:''};wb.SheetNames.forEach(name=>{const matrix=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:'',raw:false});if(!matrix.length)return;let headerIndex=matrix.findIndex(r=>{const t=r.map(x=>String(x||'').toLowerCase()).join(' | ');return(t.includes('site name')||t.includes('health center name'))&&(t.includes('state')||t.includes('site state'))});if(headerIndex<0)headerIndex=0;const headers=matrix[headerIndex].map(h=>String(h||'').trim());const objects=matrix.slice(headerIndex+1).map(row=>{const o={};headers.forEach((h,i)=>{if(h)o[h]=row[i]??''});return o}).filter(o=>Object.values(o).some(v=>String(v).trim()!==''));const score=objects.length+headers.filter(h=>/site|health|center|state|county|address|phone|web/i.test(h)).length*1000;if(score>best.score)best={score,objects,sheetName:name}});return best.objects.map(hrsaToSite).filter(Boolean)}
function showHrsaFallback(){document.getElementById('hrsaFallback').classList.toggle('hidden')}
function importHRSALookupFile(){const file=document.getElementById('hrsaFile')?.files?.[0];if(!file){setStatus('Select the HRSA XLSX or CSV lookup file first.');return}const lower=file.name.toLowerCase();setStatus(`Loading uploaded HRSA lookup file: <strong>${esc(file.name)}</strong>...`);const reader=new FileReader();reader.onload=()=>{try{let items=[];if(lower.endsWith('.csv')){const rows=parseCSV(reader.result);const headers=rows[0];items=rows.slice(1).map(r=>rowToObject(headers,r)).map(hrsaToSite).filter(Boolean)}else{if(!window.XLSX)throw new Error('XLSX parser did not load.');const wb=XLSX.read(reader.result,{type:'array'});items=workbookToHRSASites(wb)}if(!items.length)throw new Error('No usable HRSA rows found.');hrsaLookupCache=items;setStatus(`<strong>${items.length.toLocaleString()}</strong> HRSA lookup rows loaded from ${esc(file.name)} as the full-table healthcare source. State/county/city filters will be applied locally when you run the prospect search.`)}catch(e){setStatus(`<span style="color:#b42318">HRSA upload failed: ${esc(e.message)}</span>`)}};if(lower.endsWith('.csv'))reader.readAsText(file);else reader.readAsArrayBuffer(file)}
function parseCSV(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(q){if(c==='"'&&n==='"'){cell+='"';i++}else if(c==='"'){q=false}else cell+=c}else{if(c==='"')q=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell=''}else if(c==='\r'){}else cell+=c}}if(cell.length||row.length){row.push(cell);rows.push(row)}return rows.filter(r=>r.some(x=>String(x).trim()!==''))}
function rowToObject(headers,row){const o={};headers.forEach((h,i)=>o[h.trim()]=row[i]??'');return o}
async function enrichPlacePop(s){const st=s.state.toUpperCase(),fips=STATE_FIPS[st];if(!fips)return;if(!placeCache[st]){try{const res=await fetch(`https://api.census.gov/data/2020/dec/dhc?get=NAME,P1_001N&for=place:*&in=state:${fips}&key=b40f531183c077ba1f8973f7920be189d5cb8d2d`);const data=await res.json();const map={};data.slice(1).forEach(r=>{const name=r[0].replace(/,.*$/,'');map[norm(name)]={name:r[0],pop:parseInt(r[1])}});placeCache[st]=map}catch(e){s.notes=appendNote(s.notes,'Census place API failed');return}}const lookup=(s.ruralityPlace||s.city||'').trim();const m=placeCache[st][norm(lookup)];if(m){s.cityPopulation=m.pop;if(!s.ruralityPlace)s.ruralityPlace=m.name.replace(/,.*$/,'');s.censusSuggestion=null;s.censusSuggestionStatus='matched';s.notes=appendNote(s.notes,`Census place match for rurality: ${m.name}`)}else{const suggestion=bestCensusPlaceSuggestion(lookup,placeCache[st]);if(suggestion&&s.censusSuggestionStatus!=='rejected'){s.censusSuggestion=suggestion;s.notes=appendNote(s.notes,`Suggested close Census place match: ${suggestion.name}`)}s.notes=appendNote(s.notes,`No exact 2020 Census place match for '${lookup}'; approve a close match or verify Census Rural / DLT map`)}}
async function enrichSaipe(s){const st=s.state.toUpperCase(),fips=STATE_FIPS[st];if(!fips)return;if(!saipeCache[st]){try{const res=await fetch(`https://api.census.gov/data/timeseries/poverty/saipe?get=NAME,SAEPOVRTALL_PT&for=county:*&in=state:${fips}&YEAR=2023&key=b40f531183c077ba1f8973f7920be189d5cb8d2d`);const data=await res.json();const byFips={},byName={};data.slice(1).forEach(r=>{const obj={name:r[0],rate:parseFloat(r[1]),state:r[3],county:r[4],fips:r[3]+r[4]};byFips[obj.fips]=obj;byName[norm(obj.name.replace(/,.*$/,''))]=obj});saipeCache[st]={byFips,byName}}catch(e){s.notes=appendNote(s.notes,'SAIPE API failed');return}}let m=null;const f=cleanCountyFips(s.countyFips,st);if(f&&f.length===5)m=saipeCache[st].byFips[f];if(!m&&s.county)m=saipeCache[st].byName[norm(s.county)];if(m){s.saipePercent=m.rate;if(!s.countyFips)s.countyFips=m.fips;if(!s.county)s.county=m.name.replace(/,.*$/,'');s.saipeSuggestion=null;s.saipeSuggestionStatus='matched'}else{const suggestion=bestSaipeCountySuggestion(s.county,saipeCache[st]);if(suggestion&&s.saipeSuggestionStatus!=='rejected'){s.saipeSuggestion=suggestion;s.notes=appendNote(s.notes,`Suggested close SAIPE county match: ${suggestion.name}`)}s.notes=appendNote(s.notes,'No exact county SAIPE match; approve a close county match or check county/FIPS')}}
function appendNote(old,n){old=old||'';return old.includes(n)?old:(old?old+'; ':'')+n}
function editDistance(a,b){a=String(a||'');b=String(b||'');const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let prev=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i++){const cur=[i];for(let j=1;j<=n;j++){cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));}prev=cur;}return prev[n];}
function similarity(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;if(a===b)return 1;const max=Math.max(a.length,b.length);let score=1-(editDistance(a,b)/max);if(a.includes(b)||b.includes(a))score=Math.max(score,.86);const at=a.split(' ')[0],bt=b.split(' ')[0];if(at&&bt&&at===bt)score+=.04;return Math.min(1,score);}
function bestCensusPlaceSuggestion(lookup,map){lookup=String(lookup||'').trim();if(!lookup||!map)return null;let best=null;Object.values(map).forEach(v=>{const place=(v.name||'').replace(/,.*$/,'');const score=similarity(lookup,place);if(!best||score>best.score)best={name:v.name,pop:v.pop,score};});return best&&best.score>=.72?best:null;}
function bestSaipeCountySuggestion(county,cache){county=String(county||'').trim();if(!county||!cache||!cache.byName)return null;let best=null;Object.values(cache.byName).forEach(v=>{const cname=(v.name||'').replace(/,.*$/,'');const score=similarity(county,cname);if(!best||score>best.score)best={name:v.name,rate:v.rate,fips:v.fips,score};});return best&&best.score>=.72?best:null;}
function suggestionLabel(s,kind){if(kind==='census'&&s.censusSuggestion){const x=s.censusSuggestion;return `${x.name} — pop ${Number(x.pop||0).toLocaleString()} (${Math.round((x.score||0)*100)}% close)`;}if(kind==='saipe'&&s.saipeSuggestion){const x=s.saipeSuggestion;return `${x.name} — SAIPE ${x.rate}% (${Math.round((x.score||0)*100)}% close)`;}return '';}
function econScore(p){const n=parseFloat(p);if(isNaN(n))return null;if(n>=30)return 30;if(n>=20)return 20;if(n>=10)return 10;return 0}
function isNcesRuralLocale(v){const txt=String(v||'');const m=txt.match(/\b(4[123])\b/);return /Rural/i.test(txt)||(m&&['41','42','43'].includes(m[1]))}
function ruralityScore(s){if(s.contiguous==='Yes')return 0;if(s.censusRural==='Yes')return 40;const pop=parseInt(String(s.cityPopulation||'').replace(/,/g,''));if(isNaN(pop))return null;if(pop>20000&&isNcesRuralLocale(s.sourceLocale)){s.notes=appendNote(s.notes,'D-1 review: NCES rural locale conflicts with postal-city population. Verify actual Rurality Place/CDP and DLT map.');return null}if(pop<=5000)return 40;if(pop<=10000)return 30;if(pop<=20000)return 20;return 0}
function isBlank(v){return v===null||v===undefined||String(v).trim()==='';}
function hasNumeric(v){return !isBlank(v)&&!isNaN(Number(String(v).replace(/,/g,'')));}
function buildReviewReason(s){
  const reasons=[];
  if(!hasNumeric(s.cityPopulation))reasons.push(s.censusSuggestion?'2020 Pop close match suggested':'2020 Pop not verified');
  if(!hasNumeric(s.saipePercent))reasons.push(s.saipeSuggestion?'SAIPE close match suggested':'SAIPE not verified');
  if(s.ruralityScore===null&&hasNumeric(s.cityPopulation))reasons.push('D-1 place/map review');
  if(/No exact 2020 Census place match|No 2020 Census place match|Census place API failed/i.test(String(s.notes||''))&&!reasons.some(x=>x.includes('2020 Pop')))reasons.push(s.censusSuggestion?'2020 Pop close match suggested':'2020 Pop not verified');
  if(/No exact county SAIPE match|No county SAIPE match|SAIPE API failed/i.test(String(s.notes||''))&&!reasons.some(x=>x.includes('SAIPE')))reasons.push(s.saipeSuggestion?'SAIPE close match suggested':'SAIPE not verified');
  if(s.censusSuggestionStatus==='rejected'&&!reasons.some(x=>x.includes('Census suggestion rejected')))reasons.push('Census suggestion rejected');
  if(s.saipeSuggestionStatus==='rejected'&&!reasons.some(x=>x.includes('SAIPE suggestion rejected')))reasons.push('SAIPE suggestion rejected');
  return reasons.join('; ');
}
function isNeedsReview(r){return !!(r.reviewReason||(r.fitLabel==='Review'||r.fitLabel==='Needs Review'));}
function countNeedsReview(rows){return rows.filter(isNeedsReview).length;}
function scoreRow(s){
  s.economicScore=econScore(s.saipePercent);
  s.ruralityScore=ruralityScore(s);
  s.objectiveScore=(s.ruralityScore==null||s.economicScore==null)?null:Number(s.ruralityScore)+Number(s.economicScore);
  s.reviewReason=buildReviewReason(s);
  const minObj=parseFloat(document.getElementById('pfMinObjective').value)||50;
  if(s.objectiveScore!==null&&s.objectiveScore>=minObj)s.fitLabel='High Fit';
  else if(s.reviewReason)s.fitLabel='Needs Review';
  else if(Number(s.economicScore)>=20)s.fitLabel='Economic Fit';
  else s.fitLabel='Lower Fit';
  return s;
}
function hasExplicitLookupSearch(){return !!((document.getElementById('pfAgency')?.value||'').trim()||(document.getElementById('pfAddress')?.value||'').trim());}
function applyProspectFilters(rows){
  const mode=document.getElementById('pfMode').value;
  const includeReview=document.getElementById('pfIncludeReview').checked;
  const showExact=(document.getElementById('pfShowExactMatches')?.checked!==false)&&hasExplicitLookupSearch();
  const minObj=parseFloat(document.getElementById('pfMinObjective').value)||0;
  const minSaipe=parseFloat(document.getElementById('pfMinSaipe').value)||0;
  const maxPop=parseFloat(document.getElementById('pfMaxPop').value)||Infinity;
  if(showExact&&mode!=='needsReview')return rows;
  return rows.filter(r=>{
    const sai=Number(r.saipePercent);
    const pop=Number(String(r.cityPopulation||'').replace(/,/g,''));
    const popOk=!r.cityPopulation||isNaN(pop)||pop<=maxPop;
    const saiOk=isNaN(sai)||sai>=minSaipe;
    const high=r.objectiveScore!==null&&r.objectiveScore>=minObj;
    const review=includeReview&&isNeedsReview(r);
    if(mode==='needsReview')return isNeedsReview(r);
    if(mode==='all')return popOk&&saiOk;
    if(mode==='review')return popOk&&saiOk&&(high||review);
    return popOk&&saiOk&&high;
  });
}
function dedupe(rows){const seen=new Set(),out=[];rows.forEach(r=>{const k=norm([r.type,r.sourceId,r.organization,r.siteName,r.address,r.city,r.state].join('|'));if(!seen.has(k)){seen.add(k);out.push(r)}});return out}
function fitPill(v){const cls=v==='High Fit'?'green':(v==='Review'||v==='Needs Review')?'amber':v==='Economic Fit'?'blue':'red';return `<span class="pill ${cls}">${esc(v||'')}</span>`}
function scorePill(v,max){if(v===null||v===undefined||v==='')return '<span class="pill amber">Review</span>';const n=Number(v);const cls=n>=max*.75?'green':n>=max*.45?'blue':'red';return `<span class="pill ${cls}">${n.toFixed(0)}</span>`}
function lookupSuggestionCell(r){
  const bits=[];
  if(r.censusSuggestionStatus==='approved')bits.push('<span class="approved">Pop approved</span>');
  else if(r.censusSuggestionStatus==='rejected')bits.push('<span class="rejected">Pop suggestion rejected</span>');
  else if(r.censusSuggestion)bits.push(`<div><span class="suggest-label"><strong>Pop:</strong> ${esc(suggestionLabel(r,'census'))}</span><div class="suggest-actions"><button class="approve" onclick="approveLookupSuggestion('${r.id}','census')">Approve</button><button class="reject" onclick="rejectLookupSuggestion('${r.id}','census')">Reject</button></div></div>`);
  if(r.saipeSuggestionStatus==='approved')bits.push('<span class="approved">SAIPE approved</span>');
  else if(r.saipeSuggestionStatus==='rejected')bits.push('<span class="rejected">SAIPE suggestion rejected</span>');
  else if(r.saipeSuggestion)bits.push(`<div><span class="suggest-label"><strong>SAIPE:</strong> ${esc(suggestionLabel(r,'saipe'))}</span><div class="suggest-actions"><button class="approve" onclick="approveLookupSuggestion('${r.id}','saipe')">Approve</button><button class="reject" onclick="rejectLookupSuggestion('${r.id}','saipe')">Reject</button></div></div>`);
  return bits.length?`<div class="lookup-suggest">${bits.join('')}</div>`:(isNeedsReview(r)?'<span class="smalltxt">Manual lookup</span>':'');
}
function approveLookupSuggestion(id,kind){const r=prospects.find(x=>x.id===id);if(!r)return;if(kind==='census'&&r.censusSuggestion){const x=r.censusSuggestion;r.cityPopulation=x.pop;r.ruralityPlace=(x.name||'').replace(/,.*$/,'');r.censusSuggestionStatus='approved';r.notes=appendNote(r.notes,`Approved close Census place match: ${x.name}`);r.censusSuggestion=null;}if(kind==='saipe'&&r.saipeSuggestion){const x=r.saipeSuggestion;r.saipePercent=x.rate;r.countyFips=x.fips;r.county=(x.name||'').replace(/,.*$/,'');r.saipeSuggestionStatus='approved';r.notes=appendNote(r.notes,`Approved close SAIPE county match: ${x.name}`);r.saipeSuggestion=null;}scoreRow(r);renderTable();setStatus('Lookup suggestion approved and row recalculated.');}
function rejectLookupSuggestion(id,kind){const r=prospects.find(x=>x.id===id);if(!r)return;if(kind==='census'){r.censusSuggestionStatus='rejected';r.notes=appendNote(r.notes,'Rejected close Census place suggestion; manual Census/DLT map review required.');r.censusSuggestion=null;}if(kind==='saipe'){r.saipeSuggestionStatus='rejected';r.notes=appendNote(r.notes,'Rejected close SAIPE county suggestion; manual county/FIPS review required.');r.saipeSuggestion=null;}scoreRow(r);renderTable();setStatus('Lookup suggestion rejected. Row remains flagged for manual review.');}
function renderTable(){const table=document.getElementById('prospectTable');const rows=sortRows([...prospects]);table.innerHTML=`<colgroup>${COLS.map(c=>`<col style="width:${columnWidths[c[0]]||c[2]}px">`).join('')}</colgroup><thead><tr>${COLS.map(c=>head(c)).join('')}</tr></thead><tbody></tbody>`;const body=table.querySelector('tbody');if(!rows.length){body.innerHTML=`<tr><td colspan="${COLS.length}" class="smalltxt">No prospects yet. Choose a state/county/city and click Find Complete Prospects.</td></tr>`;return}rows.forEach((r,i)=>{const tr=document.createElement('tr');const addr=[r.address,r.city,r.state,r.zip].filter(Boolean).join(', ');tr.innerHTML=`<td><input type="checkbox" ${r.selected?'checked':''} onchange="toggleSelected('${r.id}',this.checked)"></td><td>${fitPill(r.fitLabel)}</td><td title="${esc(r.reviewReason||'')}">${esc(r.reviewReason||'')}</td><td>${lookupSuggestionCell(r)}</td><td class="num">${r.objectiveScore==null?'—':Number(r.objectiveScore).toFixed(0)}</td><td class="num">${scorePill(r.ruralityScore,40)}</td><td class="num">${scorePill(r.economicScore,30)}</td><td class="num">${esc(r.saipePercent||'')}</td><td class="num">${esc(r.cityPopulation||'')}</td><td>${esc(r.type)}</td><td class="num">${esc(r.schoolCount||'')}</td><td title="${esc(r.organization||'')}">${esc(r.organization||'')}</td><td title="${esc(r.siteName||'')}">${esc(r.siteName||'')}</td><td title="${esc(addr)}">${esc(addr)}</td><td>${esc(r.city||'')}</td><td>${esc(r.county||'')}</td><td>${esc(r.state||'')}</td><td>${esc(r.zip||'')}</td><td title="${esc(r.phone||'')}">${esc(r.phone||'')}</td><td title="${esc(r.email||'')}">${emailCell(r.email||'')}</td><td title="${esc(r.website||'')}">${websiteCell(r.website||'')}</td><td>${esc(r.sourceLocale||'')}</td><td title="${esc(r.description||'')}">${esc(r.description||'')}</td><td title="${esc(r.source||'')}">${esc(r.source||'')}</td><td><a href="${sourceLinkFor(r)}" target="_blank">USDA Map</a></td>`;body.appendChild(tr)});updateMetrics();initProspectColumnResize(table)}
function head(c){const active=sortState.key===c[0];const indicator=active?`<span class="sort-indicator">${sortState.dir==='asc'?'▲':'▼'}</span>`:'';return `<th class="sortable" data-key="${c[0]}" onclick="sortTable('${c[0]}')"><div class="th-inner"><span>${c[1]}</span>${indicator}<span class="col-resizer" data-key="${c[0]}" title="Drag to resize"></span></div></th>`}

function initProspectColumnResize(table){
  table.querySelectorAll('.col-resizer').forEach(handle=>{
    handle.addEventListener('click',e=>e.stopPropagation());
    handle.addEventListener('mousedown',e=>{
      e.preventDefault();e.stopPropagation();
      const key=handle.dataset.key, th=handle.closest('th'), startX=e.pageX, startW=th.offsetWidth;
      document.body.style.cursor='col-resize';document.body.style.userSelect='none';
      const onMove=ev=>{const next=Math.max(44,startW+(ev.pageX-startX));columnWidths[key]=next;const idx=COLS.findIndex(c=>c[0]===key)+1;const col=table.querySelector(`colgroup col:nth-child(${idx})`);if(col)col.style.width=next+'px'};
      const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);document.body.style.cursor='';document.body.style.userSelect=''};
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    });
  });
}

function sortTable(key){if(sortState.key===key)sortState.dir=sortState.dir==='asc'?'desc':'asc';else sortState={key,dir:'asc'};renderTable()}
function sortByDefault(){sortState={key:'objectiveScore',dir:'desc'};renderTable()}
function sortRows(rows){const col=COLS.find(c=>c[0]===sortState.key)||COLS[2];const dir=sortState.dir==='desc'?-1:1;return rows.sort((a,b)=>compare(a[col[0]],b[col[0]],col[3])*dir)}
function compare(a,b,type){const ea=(a===null||a===undefined||a===''),eb=(b===null||b===undefined||b==='');if(ea&&eb)return 0;if(ea)return 1;if(eb)return -1;if(type==='number'||type==='bool'){const na=parseFloat(String(a).replace(/,/g,'')),nb=parseFloat(String(b).replace(/,/g,''));if(isNaN(na)&&isNaN(nb))return 0;if(isNaN(na))return 1;if(isNaN(nb))return -1;return na-nb}return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'})}
function toggleSelected(id,val){const p=prospects.find(x=>x.id===id);if(p)p.selected=val;updateMetrics()}
function selectAll(val){prospects.forEach(p=>p.selected=val);renderTable();updateMetrics()}
function clearProspects(){setBusy(false);prospects=[];renderTable();updateMetrics();setStatus('Results cleared.')}
function updateMetrics(){const high=prospects.filter(p=>p.fitLabel==='High Fit').length;const review=countNeedsReview(prospects);const selected=prospects.filter(p=>p.selected).length;document.getElementById('mReturned').textContent=prospects.length;document.getElementById('mHigh').textContent=high;document.getElementById('mReview').textContent=review;document.getElementById('mSelected').textContent=selected;renderTypeBreakdown()}
function renderTypeBreakdown(){const el=document.getElementById('typeBreakdown');if(!el)return;const ordered=['K-12 District','K-12','Charter School','Rural Health','Higher Ed'];const labels={'K-12 District':'K-12 Districts','K-12':'K-12 School Sites','Charter School':'Charter Schools','Rural Health':'Healthcare / HRSA','Higher Ed':'Higher Ed / Technical'};const counts={};const high={};const review={};const schools={};prospects.forEach(p=>{const t=p.type||'Other';counts[t]=(counts[t]||0)+1;if(p.fitLabel==='High Fit')high[t]=(high[t]||0)+1;if(isNeedsReview(p))review[t]=(review[t]||0)+1;const sc=parseFloat(String(p.schoolCount||'').replace(/,/g,''));if(!isNaN(sc))schools[t]=(schools[t]||0)+sc});const types=[...ordered,...Object.keys(counts).filter(t=>!ordered.includes(t)).sort()];el.innerHTML=types.map(t=>{const schoolLine=schools[t]?` • ${schools[t].toLocaleString()} schools`:'';return `<div class="type-chip"><div class="type-label">${esc(labels[t]||t)}</div><div class="type-count">${counts[t]||0}</div><div class="type-sub">${high[t]||0} high fit • ${review[t]||0} review${schoolLine}</div></div>`}).join('')}

let priorAwards=[];
let awardResults=[];
let awardSort={key:'year',dir:'desc'};
const AWARD_COLS=[
  ['year','Year',54,'number'],['awardee','Awardee / Recipient',190,'text'],['projectTitle','Site / Project',210,'text'],['grantType','Type',88,'text'],['siteType','Site Role',82,'text'],['state','State',48,'text'],['county','County',100,'text'],['city','City',88,'text'],['siteGrant','Site $',78,'number'],['totalGrant','Total Grant $',92,'number'],['distanceMiles','Miles',62,'number'],['map','USDA Map',70,'text']
];
function setAwardStatus(msg){const el=document.getElementById('awardStatus');if(el)el.innerHTML=msg||'';}
function awardDistrictsOnlyEnabled(){return (document.getElementById('awardEntityScope')?.value||'all')==='districts';}
function isDistrictAward(a){
  const text=[a.awardee,a.projectTitle,a.county,a.city,a.source,JSON.stringify(a.raw||{})].join(' ').toLowerCase();
  return /\b(school district|independent school district|unified school district|community unit school district|county school district|public school district|local school district|school system|county schools|public schools|board of education|boe|educational service district|isd|usd|cusd|csd|isd\.|usd\.)\b/i.test(text) || /\bdistrict\b/i.test(text);
}
function rusMapLinkFor(o){if(o&&siteHasCoords(o)){const lon=parseFloat(o.lon),lat=parseFloat(o.lat);return `${DLT_MAP}&center=${encodeURIComponent(lon+','+lat)}&level=12`;}return DLT_MAP;}
function normalizeAwardRecord(obj,source,geom){
  obj=obj||{};
  const state=(pick(obj,['State','STATE','state','ST','Recipient State','Project State','Applicant State'])||'').toUpperCase().trim();
  const city=pick(obj,['City','CITY','city','Town','TOWN','Project City','Recipient City','Applicant City','Location City']);
  const county=stripCounty(pick(obj,['County','COUNTY','county','Project County','Recipient County','Applicant County','CNTY_NM','COUNTY_NM']));
  let lat=pick(obj,['Latitude','LATITUDE','lat','Y','y','Y_LAT','geometryLatitude','POINT_Y']);
  let lon=pick(obj,['Longitude','LONGITUDE','lon','Long','X','x','X_LONG','geometryLongitude','POINT_X']);
  if((!lat||!lon)&&geom){
    let x=geom.x, y=geom.y;
    if(Number.isFinite(x)&&Number.isFinite(y)){
      if(Math.abs(x)>180||Math.abs(y)>90){const ll=webMercatorToLonLat(x,y);lon=ll.lon;lat=ll.lat;}else{lon=x;lat=y;}
    }
  }
  const awardee=pick(obj,['GRANTNAME','Awardee','Recipient','Recipient Name','Applicant','Applicant Name','Grantee','Grantee Name','Organization','Organization Name','Entity','Entity Name','Name']);
  const siteName=pick(obj,['SITENAME','Site Name','Site','Subrecipient','Sub-recipient','Sub Recipient','Location Name','Project Site','Facility']);
  let projectTitle=pick(obj,['Project Title','Project','Purpose','Project Description','Description','Public Description','Award Description','Grant Purpose','Program','TITLE']);
  if(!projectTitle) projectTitle=siteName;
  const grantType=pick(obj,['GRANTTYPE','Grant Type','Program Type','sourceLayer','officialLayerName']);
  const subtype=pick(obj,['SUBTYPE','Subtype','Sub Type']);
  const siteType=pick(obj,['SITETYPE','Site Type','Site Role','Role','Designation']);
  const projectId=pick(obj,['PROJECTID','Project ID','Application ID','Grant ID','Award ID','ProjectID']);
  const address=pick(obj,['CONADDRESS','Address','ADDRESS','Full Address','Location Address','STREETADD','Street Address','Street']);
  const zip=pick(obj,['ZIPCODE','ZIP','Zip','Postal Code']);
  const totalGrant=moneyValue(pick(obj,['TOTALGRAM','Total Grant','Total Grant Amount','Total Award','Award Amount','Grant Amount','Federal Award','DLT Award']));
  const siteGrant=moneyValue(pick(obj,['SITEGRAM','Site Grant','Site Amount','Site Award','Amount','Grant','Award','Funding']));
  const amount = siteGrant!=='' ? siteGrant : totalGrant;
  const year=yearValue(pick(obj,['OBLFY','APPFY','Fiscal Year','FY','Year','Award Year','Program Year','FISCALYEAR','FISCAL_YR']));
  if(!awardee && !projectTitle && !siteName && !state && !county && !city) return null;
  return {id:crypto.randomUUID(),awardee,projectTitle,siteName,grantType,subtype,siteType,projectId,address,zip,state,county,city,amount,totalGrant,siteGrant,year,lat,lon,source:source||'RUS DLT map/uploaded award table',raw:obj};
}
function moneyValue(v){const s=String(v||'').replace(/[^0-9.\-]/g,'');return s?Number(s):'';}
function yearValue(v){const m=String(v||'').match(/20\d{2}|19\d{2}/);return m?m[0]:String(v||'').trim();}
function webMercatorToLonLat(x,y){const lon=x/20037508.34*180;let lat=y/20037508.34*180;lat=180/Math.PI*(2*Math.atan(Math.exp(lat*Math.PI/180))-Math.PI/2);return {lon,lat};}
function stripCounty(v){return String(v||'').replace(/\s+County$/i,'').trim();}
async function loadBundledPriorAwards(){
  setAwardStatus('⏱️ Loading bundled RUS DLT award/site table...');
  try{
    const res=await fetch(PRIOR_AWARDS_CSV,{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status+' for '+PRIOR_AWARDS_CSV);
    const parsed=parseCSV(await res.text());
    const rows=objectsFromMatrix(parsed);
    priorAwards=dedupeAwards(rows.map(r=>normalizeAwardRecord(r,'Bundled RUS DLT all-sites table 2026-05-08')).filter(Boolean));
    if(!priorAwards.length) throw new Error('No recognizable RUS DLT award/site rows were found in the bundled table.');
    setAwardStatus(`<strong>${priorAwards.length.toLocaleString()}</strong> bundled prior-award/site record(s) loaded from 2026-05-08 table.`);
    filterPriorAwards();
  }catch(e){
    setAwardStatus(`<span style="color:#b42318">Bundled RUS DLT award table could not be loaded: ${esc(e.message)}. Use Upload Table to load a replacement CSV/XLSX.</span>`);
  }
}
async function loadRusDltMapAwards(){
  setAwardStatus('⏱️ Searching the USDA RUS DLT map for prior recipient/award layers...');
  try{
    const candidates=[
      `https://ruraldevelopment.maps.arcgis.com/sharing/rest/content/items/15a73830555645ae93d2fa773ed8e971/data?f=json`,
      `https://www.arcgis.com/sharing/rest/content/items/15a73830555645ae93d2fa773ed8e971/data?f=json`
    ];
    let mapData=null, failures=[];
    for(const url of candidates){
      try{const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);mapData=await res.json();break;}catch(e){failures.push(e.message);}
    }
    if(!mapData) throw new Error('Could not open map item data: '+failures.join(' | '));
    const layers=[];
    collectOperationalLayers(mapData.operationalLayers||[],layers);
    const awardLayers=layers.filter(l=>/award|recipient|grantee|grant|dlt/i.test([l.title,l.name,l.url].join(' ')) && /FeatureServer|MapServer/i.test(l.url||''));
    if(!awardLayers.length) throw new Error('No obvious award/recipient FeatureServer layer was discoverable in the map item. Upload a prior-awards table instead.');
    const records=[];
    for(const layer of awardLayers.slice(0,8)){
      const url=layer.url.replace(/\/$/,'');
      try{
        const rows=await arcgisAwardQuery(url);
        rows.forEach(f=>{const rec=normalizeAwardRecord(f.attributes||{},layer.title||'RUS DLT Map',f.geometry);if(rec)records.push(rec);});
      }catch(e){/* keep trying other layers */}
    }
    priorAwards=dedupeAwards(records);
    if(!priorAwards.length) throw new Error('The map layers loaded, but no usable recipient/award rows were found. Upload an award table instead.');
    setAwardStatus(`<strong>${priorAwards.length.toLocaleString()}</strong> prior RUS DLT map record(s) loaded. Use Filter Awards or Find Near Selected Prospect.`);
    filterPriorAwards();
  }catch(e){setAwardStatus(`<span style="color:#b42318">RUS DLT map awards could not be loaded automatically: ${esc(e.message)} Use the upload option with a prior-award CSV/XLSX table.</span>`);}
}
function collectOperationalLayers(list,out){(list||[]).forEach(l=>{if(l.url)out.push(l);if(l.layers)collectOperationalLayers(l.layers,out);if(l.sublayers)collectOperationalLayers(l.sublayers,out);});}
async function arcgisAwardQuery(url){
  const all=[];let offset=0;const pageSize=2000;
  while(offset<20000){
    const params=new URLSearchParams({where:'1=1',outFields:'*',returnGeometry:'true',f:'json',resultOffset:String(offset),resultRecordCount:String(pageSize),orderByFields:'OBJECTID ASC'});
    const res=await fetch(`${url}/query?${params.toString()}`);
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data=await res.json();
    if(data.error)throw new Error(data.error.message||'ArcGIS query error');
    const features=data.features||[];all.push(...features);
    if(!data.exceededTransferLimit&&features.length<pageSize)break;
    offset+=pageSize;
  }
  return all;
}
function importPriorAwardsFile(){
  const file=document.getElementById('awardFile')?.files?.[0];
  if(!file){setAwardStatus('Select a RUS DLT prior-awards CSV/XLSX file first.');return;}
  const lower=file.name.toLowerCase();
  setAwardStatus(`Loading prior-awards file: <strong>${esc(file.name)}</strong>...`);
  const reader=new FileReader();
  reader.onload=()=>{try{
    let rows=[];
    if(lower.endsWith('.csv')){const parsed=parseCSV(reader.result);rows=objectsFromMatrix(parsed);}
    else {if(!window.XLSX)throw new Error('XLSX parser did not load.');const wb=XLSX.read(reader.result,{type:'array'});rows=objectsFromWorkbook(wb,/award|recipient|grantee|project|state|county|amount|year/i);}
    priorAwards=dedupeAwards(rows.map(r=>normalizeAwardRecord(r,`uploaded ${file.name}`)).filter(Boolean));
    if(!priorAwards.length)throw new Error('No recognizable award records were found.');
    setAwardStatus(`<strong>${priorAwards.length.toLocaleString()}</strong> prior-award record(s) loaded from ${esc(file.name)}.`);
    filterPriorAwards();
  }catch(e){setAwardStatus(`<span style="color:#b42318">Award upload failed: ${esc(e.message)}</span>`);}};
  if(lower.endsWith('.csv'))reader.readAsText(file);else reader.readAsArrayBuffer(file);
}
function objectsFromMatrix(matrix){if(!matrix||!matrix.length)return[];let headerIndex=matrix.findIndex(r=>r.map(x=>String(x||'').toLowerCase()).join(' | ').match(/award|recipient|grantee|project|state|county|amount|year/));if(headerIndex<0)headerIndex=0;const headers=matrix[headerIndex].map(h=>String(h||'').trim());return matrix.slice(headerIndex+1).map(row=>rowToObject(headers,row)).filter(o=>Object.values(o).some(v=>String(v).trim()!==''));}
function objectsFromWorkbook(wb,re){let best={score:-1,objects:[]};wb.SheetNames.forEach(name=>{const matrix=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:'',raw:false});const objects=objectsFromMatrix(matrix);const headers=objects[0]?Object.keys(objects[0]):[];const score=objects.length+headers.filter(h=>re.test(h)).length*1000;if(score>best.score)best={score,objects};});return best.objects;}
function filterPriorAwards(){
  const st=(document.getElementById('awardState')?.value||document.getElementById('pfState')?.value||'').toUpperCase();
  const loc=(document.getElementById('awardLocation')?.value||'').toLowerCase().trim();
  const key=(document.getElementById('awardKeyword')?.value||'').toLowerCase().trim();
  const useState=st&&st!==ALL_STATE_VALUE;
  const districtsOnly=awardDistrictsOnlyEnabled();
  awardResults=priorAwards.filter(a=>{
    const stateOk=!useState||String(a.state||'').toUpperCase()===st;
    const locText=[a.county,a.city,a.state].join(' ').toLowerCase();
    const keyText=[a.awardee,a.projectTitle,a.siteName,a.grantType,a.subtype,a.siteType,a.projectId,a.source,JSON.stringify(a.raw||{})].join(' ').toLowerCase();
    return stateOk && (!loc||locText.includes(loc)) && (!key||keyText.includes(key)) && (!districtsOnly||isDistrictAward(a));
  });
  renderAwardsTable(awardResults);
  const scopeMsg=districtsOnly?' Districts-only filter is ON.':'';
  setAwardStatus(`<strong>${awardResults.length.toLocaleString()}</strong> prior-award record(s) match the current filters.${scopeMsg} ${priorAwards.length?`Loaded source records: ${priorAwards.length.toLocaleString()}.`:''}`);
}
function findAwardsNearSelectedProspect(){
  const selected=prospects.filter(p=>p.selected&&siteHasCoords(p));
  if(!selected.length){setAwardStatus('Select at least one prospect with coordinates first.');return;}
  if(!priorAwards.length){setAwardStatus('Load RUS DLT map awards or upload a prior-awards table first.');return;}
  const radius=parseFloat(document.getElementById('awardRadius')?.value)||100;
  const out=[];
  selected.forEach(p=>{
    priorAwards.forEach(a=>{
      if(awardDistrictsOnlyEnabled() && !isDistrictAward(a)) return;
      if(siteHasCoords(a)){
        const miles=distanceMiles(parseFloat(p.lat),parseFloat(p.lon),parseFloat(a.lat),parseFloat(a.lon));
        if(miles<=radius) out.push({...a,distanceMiles:miles,nearProspect:p.siteName||p.organization});
      }else if(p.state&&a.state&&String(p.state).toUpperCase()===String(a.state).toUpperCase()){
        const countyMatch=p.county&&a.county&&norm(p.county)===norm(a.county);
        const cityMatch=p.city&&a.city&&norm(p.city)===norm(a.city);
        if(countyMatch||cityMatch) out.push({...a,distanceMiles:'',nearProspect:p.siteName||p.organization});
      }
    });
  });
  awardResults=dedupeAwards(out);
  renderAwardsTable(awardResults);
  const scopeMsg=awardDistrictsOnlyEnabled()?' Districts-only filter is ON.':'';
  setAwardStatus(`<strong>${awardResults.length.toLocaleString()}</strong> prior-award record(s) found near selected prospect(s), using a ${radius}-mile radius where coordinates were available and county/city fallback where not.${scopeMsg}`);
}
function dedupeAwards(rows){const seen=new Set(),out=[];(rows||[]).forEach(r=>{const k=norm([r.year,r.projectId,r.awardee,r.siteName||r.projectTitle,r.state,r.county,r.city,r.siteGrant,r.totalGrant].join('|'));if(!seen.has(k)){seen.add(k);out.push(r);}});return out;}
function renderAwardsTable(rows){
  const table=document.getElementById('awardsTable');if(!table)return;
  const sorted=sortAwardRows([...(rows||[])]);
  table.innerHTML=`<thead><tr>${AWARD_COLS.map(c=>`<th class="sortable" onclick="sortAwards('${c[0]}')">${esc(c[1])}${awardSort.key===c[0]?` <span class="sort-indicator">${awardSort.dir==='asc'?'▲':'▼'}</span>`:''}</th>`).join('')}</tr></thead><tbody></tbody>`;
  const body=table.querySelector('tbody');
  if(!sorted.length){body.innerHTML=`<tr><td colspan="${AWARD_COLS.length}" class="smalltxt">No prior RUS DLT award/site records loaded or matching filters yet.</td></tr>`;return;}
  sorted.forEach(a=>{
    const tr=document.createElement('tr');
    tr.className='award-row-click';
    tr.title='Click to view all sites/sub-recipient locations and year-by-year grant breakdown for this awardee.';
    tr.innerHTML=`<td>${esc(a.year||'')}</td><td title="${esc(a.awardee||'')}">${esc(a.awardee||'')}</td><td title="${esc(a.siteName||a.projectTitle||'')}">${esc(a.siteName||a.projectTitle||'')}</td><td>${esc([a.grantType,a.subtype].filter(Boolean).join(' / '))}</td><td>${esc(a.siteType||'')}</td><td>${esc(a.state||'')}</td><td>${esc(a.county||'')}</td><td>${esc(a.city||'')}</td><td class="num">${fmtMoney(a.siteGrant)}</td><td class="num">${fmtMoney(a.totalGrant)}</td><td class="num">${a.distanceMiles!==undefined&&a.distanceMiles!==''?Number(a.distanceMiles).toFixed(1):''}</td><td><a href="${rusMapLinkFor(a)}" target="_blank" onclick="event.stopPropagation()">USDA Map</a></td>`;
    tr.addEventListener('click',()=>showAwardDrilldown(a));
    body.appendChild(tr);
  });
}
function fmtMoney(v){if(v===''||v===undefined||v===null||isNaN(Number(v)))return '';return '$'+Number(v).toLocaleString(undefined,{maximumFractionDigits:0});}
function groupAwardKey(a){return [a.year||'',a.projectId||'',a.awardee||'',a.totalGrant||'',a.grantType||''].join('|');}
function showAwardDrilldown(seed){
  const panel=document.getElementById('awardDrilldown'); if(!panel)return;
  const nameNorm=norm(seed.awardee||'');
  let rows=priorAwards.filter(a=>norm(a.awardee||'')===nameNorm);
  if(awardDistrictsOnlyEnabled()) rows=rows.filter(isDistrictAward);
  if(!rows.length) rows=[seed];
  const years=[...new Set(rows.map(r=>r.year).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
  const projectKeys=[...new Set(rows.map(groupAwardKey))];
  const uniqueProjects=projectKeys.length;
  const totalSites=rows.length;
  const totalSiteGrant=rows.reduce((sum,r)=>sum+(Number(r.siteGrant)||0),0);
  const projectGrantTotal=projectKeys.reduce((sum,k)=>{
    const rr=rows.find(r=>groupAwardKey(r)===k);
    return sum+(Number(rr?.totalGrant)||0);
  },0);
  const projectGroups=groupBy(rows,groupAwardKey);
  const yearHtml=years.map(y=>{
    const yrRows=rows.filter(r=>String(r.year||'')===String(y));
    const yrProjects=groupBy(yrRows,groupAwardKey);
    const yrSiteGrant=yrRows.reduce((sum,r)=>sum+(Number(r.siteGrant)||0),0);
    const yrProjectGrant=Object.keys(yrProjects).reduce((sum,k)=>sum+(Number(yrProjects[k][0]?.totalGrant)||0),0);
    return `<details class="award-year-detail" open><summary>FY ${esc(y)} • ${Object.keys(yrProjects).length} project(s) • ${yrRows.length} site/sub-recipient location(s) • Total Grant ${fmtMoney(yrProjectGrant)} • Site $ ${fmtMoney(yrSiteGrant)}</summary>${Object.values(yrProjects).map(renderAwardProjectCard).join('')}</details>`;
  }).join('');
  panel.classList.remove('hidden');
  panel.innerHTML=`<div class="award-drilldown-head"><div><h3>${esc(seed.awardee||'Awardee')}</h3><div class="smalltxt">Year-by-year drilldown from the loaded prior RUS DLT award/site table. Site/sub-recipient locations are source rows from the table, not inferred.</div></div><button class="ghost" onclick="document.getElementById('awardDrilldown').classList.add('hidden')">Close</button></div><div class="mini-metrics"><div class="mini-metric"><span>Years won</span><b>${years.length?years.join(', '):'—'}</b></div><div class="mini-metric"><span>Projects</span><b>${uniqueProjects}</b></div><div class="mini-metric"><span>Site rows</span><b>${totalSites.toLocaleString()}</b></div><div class="mini-metric"><span>Total grant / site $</span><b>${fmtMoney(projectGrantTotal)} / ${fmtMoney(totalSiteGrant)}</b></div></div>${yearHtml || '<div class="smalltxt">No year detail available.</div>'}`;
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function groupBy(rows,fn){return (rows||[]).reduce((acc,r)=>{const k=fn(r);(acc[k]||(acc[k]=[])).push(r);return acc;},{});}
function renderAwardProjectCard(rows){
  const r=rows[0]||{};
  const title=[r.projectId,r.grantType,r.subtype].filter(Boolean).join(' • ') || 'Project / award';
  const siteGrant=rows.reduce((sum,x)=>sum+(Number(x.siteGrant)||0),0);
  const siteRows=rows.sort((a,b)=>compare(a.siteName||a.projectTitle,b.siteName||b.projectTitle,'text')).map(x=>`<tr><td>${esc(x.siteName||x.projectTitle||'')}</td><td>${esc(x.siteType||'')}</td><td>${esc(x.address||'')}</td><td>${esc([x.city,x.county,x.state].filter(Boolean).join(', '))}</td><td class="num">${fmtMoney(x.siteGrant)}</td><td><a href="${rusMapLinkFor(x)}" target="_blank">Map</a></td></tr>`).join('');
  return `<div class="award-project-card"><div class="award-project-title">${esc(title)} <span class="smalltxt">• Total Grant ${fmtMoney(r.totalGrant)} • Site $ ${fmtMoney(siteGrant)} • ${rows.length} location(s)</span></div><div class="table-wrap" style="max-height:220px;border-radius:8px"><table class="award-site-table"><thead><tr><th>Site / sub-recipient location</th><th>Role</th><th>Address</th><th>City / County / State</th><th>Site $</th><th>USDA Map</th></tr></thead><tbody>${siteRows}</tbody></table></div></div>`;
}
function sortAwards(key){if(awardSort.key===key)awardSort.dir=awardSort.dir==='asc'?'desc':'asc';else awardSort={key,dir:'asc'};renderAwardsTable(awardResults);}
function sortAwardRows(rows){const col=AWARD_COLS.find(c=>c[0]===awardSort.key)||AWARD_COLS[0];const dir=awardSort.dir==='desc'?-1:1;return rows.sort((a,b)=>compare(a[col[0]],b[col[0]],col[3])*dir);}
function exportAwardsCSV(){let base=awardResults.length?awardResults:priorAwards;if(awardDistrictsOnlyEnabled())base=base.filter(isDistrictAward);const rows=sortAwardRows([...base]);if(!rows.length){setAwardStatus('No prior-award rows to export.');return;}const fields=['year','awardee','projectId','grantType','subtype','siteName','projectTitle','siteType','state','county','city','address','zip','siteGrant','totalGrant','distanceMiles','nearProspect','source','lat','lon'];const csv=[fields.join(',')].concat(rows.map(r=>fields.map(f=>csvCell(r[f])).join(','))).join('\n');download(awardDistrictsOnlyEnabled()?'RUS_DLT_Prior_District_Awards.csv':'RUS_DLT_Prior_Awards_Strategy.csv',csv,'text/csv');}
function exportCSV(){const fields=['selected','fitLabel','reviewReason','censusSuggestion','censusSuggestionStatus','saipeSuggestion','saipeSuggestionStatus','objectiveScore','ruralityScore','economicScore','saipePercent','cityPopulation','type','schoolCount','organization','siteName','address','city','ruralityPlace','state','zip','county','countyFips','phone','email','website','sourceLocale','enrollment','designation','description','source','sourceId','lat','lon','notes'];const csv=[fields.join(',')].concat(prospects.map(p=>fields.map(f=>csvCell(p[f])).join(','))).join('\n');download('RUS_DLT_High_Eligibility_Prospects.csv',csv,'text/csv')}
function sendSelectedToScoring(){const selected=prospects.filter(p=>p.selected);if(!selected.length){setStatus('Select at least one prospect first.');return}const clean=selected.map(p=>({...p,id:crypto.randomUUID(),include:false,selected:false,notes:appendNote(p.notes,'Sent from Prospect Finder; set Include=true only if used in the DLT project.')}));localStorage.setItem('dltPendingProspectsV1',JSON.stringify(clean));setStatus(`<strong>${clean.length}</strong> selected prospect(s) staged for the scoring worksheet. Click Open Scoring Tool to import them.`)}
init();
