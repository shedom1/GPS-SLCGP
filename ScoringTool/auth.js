(function(){
  const REQUIRED_USER = 'open';
  const REQUIRED_PASSWORD = 'gpstools';
  const SESSION_KEY = 'gps_tools_authenticated_v1';
  const USER_KEY = 'gps_tools_username_v1';
  document.documentElement.classList.add('auth-locked');
  function isAuthed(){ return sessionStorage.getItem(SESSION_KEY) === 'yes'; }
  function unlock(){
    sessionStorage.setItem(SESSION_KEY, 'yes');
    document.documentElement.classList.remove('auth-locked');
    const overlay = document.getElementById('gps-auth-screen');
    if(overlay) overlay.remove();
    addLogout();
  }
  function addLogout(){
    if(document.getElementById('gps-auth-logout')) return;
    const btn = document.createElement('button');
    btn.id = 'gps-auth-logout';
    btn.type = 'button';
    btn.textContent = 'Logout';
    btn.title = 'End this browser-session login';
    btn.addEventListener('click', function(){
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(USER_KEY);
      location.reload();
    });
    document.body.appendChild(btn);
  }
  function showGate(){
    const overlay = document.createElement('div');
    overlay.id = 'gps-auth-screen';
    overlay.innerHTML = `
      <div class="gps-auth-card">
        <div class="gps-auth-eyebrow">Solutionz GPS Tools</div>
        <h1>Restricted Workspace</h1>
        <p>Enter the shared GPS tools username and password to continue.</p>
        <label>Username</label>
        <input id="gps-auth-user" autocomplete="username" value="${sessionStorage.getItem(USER_KEY)||''}" autofocus>
        <label>Password</label>
        <input id="gps-auth-pass" type="password" autocomplete="current-password">
        <button id="gps-auth-submit" type="button">Unlock Tools</button>
        <div id="gps-auth-error" class="gps-auth-error" aria-live="polite"></div>
        <div class="gps-auth-note">Static HTML protection is a convenience gate. Use hosting-level authentication for confidential data.</div>
      </div>`;
    document.body.appendChild(overlay);
    const tryLogin = function(){
      const u = (document.getElementById('gps-auth-user').value || '').trim().toLowerCase();
      const p = document.getElementById('gps-auth-pass').value || '';
      if(u === REQUIRED_USER && p === REQUIRED_PASSWORD){
        sessionStorage.setItem(USER_KEY, u);
        unlock();
      } else {
        document.getElementById('gps-auth-error').textContent = 'Invalid username or password.';
        document.getElementById('gps-auth-pass').value='';
        document.getElementById('gps-auth-pass').focus();
      }
    };
    document.getElementById('gps-auth-submit').addEventListener('click', tryLogin);
    overlay.addEventListener('keydown', function(e){ if(e.key === 'Enter') tryLogin(); });
    setTimeout(()=>document.getElementById('gps-auth-user')?.focus(), 50);
  }
  document.addEventListener('DOMContentLoaded', function(){
    if(isAuthed()) unlock(); else showGate();
  });
})();
