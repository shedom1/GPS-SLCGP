
const AUTH_KEY='slcgpAuthV1';
function getConfig(){return window.SLCGP_CONFIG || {LOG_WEB_APP_URL:''};}
function nowIso(){return new Date().toISOString();}
function getAuth(){try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')}catch(e){return null}}
function setAuth(obj){localStorage.setItem(AUTH_KEY, JSON.stringify(obj));}
function clearAuth(){localStorage.removeItem(AUTH_KEY); location.href='index.html';}
function currentUser(){const a=getAuth(); return a?.user || 'Unknown';}
function logEvent(payload){
  const full={timestamp:nowIso(), user:currentUser(), page:location.pathname.split('/').pop()||'index.html', userAgent:navigator.userAgent, ...payload};
  const local=JSON.parse(localStorage.getItem('slcgpLocalLogs')||'[]'); local.push(full); localStorage.setItem('slcgpLocalLogs', JSON.stringify(local.slice(-500)));
  const url=getConfig().LOG_WEB_APP_URL;
  if(url){
    try{ fetch(url, {method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(full)}).catch(()=>{}); }catch(e){}
  }
}
function requireLogin(){
  const a=getAuth();
  if(a && a.user && a.loginAt){
    const el=document.querySelector('[data-current-user]'); if(el) el.textContent=a.user;
    return;
  }
  const overlay=document.createElement('div'); overlay.className='login-overlay'; overlay.innerHTML=`
    <div class="login-card">
      <div class="logo-word">SOLUTIONZ</div>
      <h1>SLCGP Prospecting Tool</h1>
      <p class="muted">Enter your name and team password to continue. Login attempts are captured locally and can be sent to Google Sheets after the Apps Script URL is configured.</p>
      <div class="field"><label>Your name</label><input id="loginUser" placeholder="Example: Sherri" autocomplete="name"></div>
      <div class="field" style="margin-top:10px"><label>Password</label><input id="loginPw" type="password" placeholder="Team password"></div>
      <p id="loginError" class="error hidden">Incorrect password.</p>
      <button id="loginBtn" class="btn primary" style="width:100%;margin-top:14px">Log in</button>
      <p class="mini" style="margin-top:14px">Static GitHub Pages password protection is a convenience gate, not enterprise authentication. Use the README options for stronger access control.</p>
    </div>`;
  document.body.appendChild(overlay);
  const submit=()=>{
    const user=document.getElementById('loginUser').value.trim();
    const pw=document.getElementById('loginPw').value;
    if(pw==='gpsslcgp' && user){
      setAuth({user, loginAt:nowIso()});
      document.querySelector('[data-current-user]')?.replaceChildren(document.createTextNode(user));
      logEvent({eventType:'login', status:'success'});
      overlay.remove();
    }else{
      document.getElementById('loginError').classList.remove('hidden');
      logEvent({eventType:'login', status:'failed', attemptedUser:user||'(blank)'});
    }
  };
  overlay.querySelector('#loginBtn').addEventListener('click', submit);
  overlay.querySelector('#loginPw').addEventListener('keydown', e=>{if(e.key==='Enter') submit()});
}
