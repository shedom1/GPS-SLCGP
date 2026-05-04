const DASH_TIERS = [
  ["tier1", "Tier 1 • Very Rural K-12 >30% SAIPE"],
  ["tier2", "Tier 2 • Rural K-12 SAIPE Unknown"],
  ["tier3", "Tier 3 • Higher Ed Locale Filter"],
  ["tier4", "Tier 4 • Higher Ed Rural Outreach"],
  ["allk12", "All K-12 • Locales 11–43"]
];
const STATES = [
  ["", "All states"], ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"]
];
const STATUS_OPTIONS = ["", "Not Started", "Assigned", "Called - Left VM", "Emailed", "Contacted", "Interested", "Follow Up", "Not a Fit", "Do Not Contact", "Needs Research", "Submitted to Rep"];
const $ = id => document.getElementById(id);

const dashState = { tier: "tier1", filters: { q: "", state: "", status: "", assigned: "", keyStatesOnly: window.APP_CONFIG?.DEFAULT_KEY_STATES_ONLY ?? true, ruralOnly: false, locale: "" } };

function initDashboard() {
  if ($("sourceLink")) $("sourceLink").href = window.APP_CONFIG.SOURCE_SHEET_URL;
  $("tierFilter").innerHTML = DASH_TIERS.map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join("");
  $("stateFilter").innerHTML = STATES.map(([abbr, name]) => `<option value="${abbr}">${escapeHtml(name)}</option>`).join("");
  $("statusFilter").innerHTML = STATUS_OPTIONS.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v || "All statuses")}</option>`).join("");
  $("keyStateToggle").checked = dashState.filters.keyStatesOnly;
  bindDashboard();
  if (!configured()) {
    $("setupWarning").classList.remove("hidden");
    $("dashboardContent").innerHTML = `<div class="setup-warning">Deploy Apps Script and paste the Web App URL into <code>config.js</code>.</div>`;
    return;
  }
  loadDashboard();
}

function bindDashboard() {
  const debounced = debounce(() => { readDashboardFilters(); loadDashboard(); }, 350);
  ["searchInput", "assignedFilter"].forEach(id => $(id).addEventListener("input", debounced));
  ["tierFilter", "stateFilter", "statusFilter", "localeFilter"].forEach(id => $(id).addEventListener("change", () => { readDashboardFilters(); loadDashboard(); }));
  ["keyStateToggle", "ruralLocaleToggle"].forEach(id => $(id).addEventListener("change", () => { readDashboardFilters(); loadDashboard(); }));
  $("refreshBtn").addEventListener("click", () => loadDashboard(true));
}

function readDashboardFilters() {
  dashState.tier = $("tierFilter").value;
  dashState.filters.q = $("searchInput").value.trim();
  dashState.filters.state = $("stateFilter").value;
  dashState.filters.status = $("statusFilter").value;
  dashState.filters.assigned = $("assignedFilter").value.trim();
  dashState.filters.keyStatesOnly = $("keyStateToggle").checked;
  dashState.filters.ruralOnly = $("ruralLocaleToggle").checked;
  dashState.filters.locale = $("localeFilter").value;
}

async function loadDashboard(force = false) {
  $("dashboardContent").innerHTML = `<div class="loading">Refreshing dashboard summary…</div>`;
  try {
    const payload = await api("dashboard", {
      tier: dashState.tier,
      q: dashState.filters.q,
      state: dashState.filters.state,
      status: dashState.filters.status,
      assigned: dashState.filters.assigned,
      keyStatesOnly: dashState.filters.keyStatesOnly ? "1" : "0",
      ruralOnly: dashState.filters.ruralOnly ? "1" : "0",
      locale: dashState.filters.locale,
      force: force ? "1" : "0"
    });
    if (!payload.ok) throw new Error(payload.error || "Dashboard summary failed.");
    renderDashboard(payload);
  } catch (err) {
    $("dashboardKpis").innerHTML = "";
    $("dashboardContent").innerHTML = `<div class="setup-warning"><strong>Dashboard unavailable.</strong><br>${escapeHtml(err.message || String(err))}</div>`;
  }
}

function renderDashboard(d) {
  const k = d.kpis || {};
  const tierLabel = (DASH_TIERS.find(t => t[0] === dashState.tier) || [dashState.tier, dashState.tier])[1];
  $("dashboardTitle").textContent = tierLabel;
  $("dashboardSubtitle").textContent = `${dashState.filters.keyStatesOnly ? "Key states only" : "All states"}${dashState.filters.state ? " • " + dashState.filters.state : ""}${dashState.filters.status ? " • " + dashState.filters.status : ""}`;
  $("dashboardKpis").innerHTML = [
    ["Matched", k.total || 0], ["Assigned", k.assigned || 0], ["Unassigned", k.unassigned || 0],
    ["Touched", k.touched || 0], ["Overdue", k.overdue || 0], ["Due Today", k.today || 0],
    ["Next 7 Days", k.next7 || 0], ["No Follow-Up", k.no_follow_up || 0]
  ].map(([label, value]) => `<div class="dashboard-kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");

  $("dashboardContent").innerHTML = `
    ${dashboardTable("By Assigned Rep", ["Rep", "Total", "Open", "FU", "High"], (d.byAssigned || []).map(r => [r.label, r.total, r.open, r.follow_up, r.high_priority]), false)}
    ${dashboardTable("By State", ["State", "Count", "%"], withPercent(d.byState || [], k.total), true)}
    ${dashboardTable("By Status", ["Status", "Count", "%"], withPercent(d.byStatus || [], k.total), false)}
    ${dashboardTable("Next Follow-Up", ["Bucket", "Count", "%"], withPercent(d.byFollowUp || [], k.total), false)}
    ${dashboardTable("Priority", ["Priority", "Count", "%"], withPercent(d.byPriority || [], k.total), false)}
  `;
}

function dashboardTable(title, headers, rows, useBars) {
  if (!rows.length) return `<div class="dashboard-card"><h3>${escapeHtml(title)}</h3><div class="empty">No activity yet.</div></div>`;
  return `<div class="dashboard-card"><h3>${escapeHtml(title)}</h3><table><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}${useBars ? "<th>Load</th>" : ""}</tr></thead><tbody>${rows.slice(0, 18).map(row => {
    const pct = row[row.length - 1];
    return `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}${useBars ? `<td><div class="mini-bar"><span style="width:${Math.min(Number(String(pct).replace("%", "")) || 0,100)}%"></span></div></td>` : ""}</tr>`;
  }).join("")}</tbody></table></div>`;
}

function withPercent(rows, total) {
  const denom = Number(total) || 1;
  return rows.map(r => [r.label, r.count || r.total || 0, `${Math.round((Number(r.count || r.total || 0) / denom) * 100)}%`]);
}
function configured() { return Boolean(window.APP_CONFIG?.API_URL && !window.APP_CONFIG.API_URL.includes("PASTE_YOUR_DEPLOYED")); }
function api(action, params = {}) {
  const callbackName = `__rusDltCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const url = new URL(window.APP_CONFIG.API_URL);
  url.searchParams.set("action", action); url.searchParams.set("callback", callbackName); url.searchParams.set("_", Date.now().toString());
  if (window.APP_CONFIG.API_TOKEN) url.searchParams.set("token", window.APP_CONFIG.API_TOKEN);
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, v); });
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(() => { cleanup(); reject(new Error("Apps Script request timed out. Check deployment access and API URL.")); }, 30000);
    function cleanup() { clearTimeout(timer); delete window[callbackName]; script.remove(); }
    window[callbackName] = data => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error("Could not reach Apps Script Web App.")); };
    script.src = url.toString(); document.head.appendChild(script);
  });
}
function debounce(fn, wait) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#96;"); }
initDashboard();
