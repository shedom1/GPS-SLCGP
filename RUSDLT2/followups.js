const FOLLOW_TIERS = [
  ["", "All tiers"],
  ["tier1", "Tier 1"], ["tier2", "Tier 2"], ["tier3", "Tier 3"], ["tier4", "Tier 4"], ["allk12", "All K-12"]
];
const STATES = [
  ["", "All states"], ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"]
];
const STATUS_OPTIONS = ["", "Not Started", "Assigned", "Called - Left VM", "Emailed", "Contacted", "Interested", "Follow Up", "Not a Fit", "Do Not Contact", "Needs Research", "Submitted to Rep"];
const PRIORITY_OPTIONS = ["", "High", "Medium", "Low"];
const $ = id => document.getElementById(id);
const followState = {
  rows: [],
  totalMatched: 0,
  sort: { key: "next_follow_up", dir: "asc" },
  filters: { q: "", tier: "", state: "", status: "", priority: "", assigned: "", keyStatesOnly: window.APP_CONFIG?.DEFAULT_KEY_STATES_ONLY ?? true, includeNoDate: false, limit: 500 }
};

function initFollowups() {
  $("tierFilter").innerHTML = FOLLOW_TIERS.map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join("");
  $("stateFilter").innerHTML = STATES.map(([abbr, name]) => `<option value="${abbr}">${escapeHtml(name)}</option>`).join("");
  $("statusFilter").innerHTML = STATUS_OPTIONS.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v || "All statuses")}</option>`).join("");
  $("priorityFilter").innerHTML = PRIORITY_OPTIONS.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v || "All priorities")}</option>`).join("");
  $("keyStateToggle").checked = followState.filters.keyStatesOnly;
  $("limitFilter").value = String(followState.filters.limit);
  bindEvents();
  if (!configured()) {
    $("setupWarning").classList.remove("hidden");
    $("tableContainer").innerHTML = `<div class="setup-warning">Deploy Apps Script and paste the Web App URL into <code>config.js</code>.</div>`;
    return;
  }
  loadFollowups();
}

function bindEvents() {
  const debounced = debounce(() => { readFilters(); loadFollowups(); }, 350);
  ["searchInput", "assignedFilter"].forEach(id => $(id).addEventListener("input", debounced));
  ["tierFilter", "stateFilter", "statusFilter", "priorityFilter", "limitFilter"].forEach(id => $(id).addEventListener("change", () => { readFilters(); loadFollowups(); }));
  ["keyStateToggle", "includeNoDateToggle"].forEach(id => $(id).addEventListener("change", () => { readFilters(); loadFollowups(); }));
  $("refreshBtn").addEventListener("click", () => loadFollowups(true));
  $("exportBtn").addEventListener("click", exportCsv);
}

function readFilters() {
  followState.filters.q = $("searchInput").value.trim();
  followState.filters.tier = $("tierFilter").value;
  followState.filters.state = $("stateFilter").value;
  followState.filters.status = $("statusFilter").value;
  followState.filters.priority = $("priorityFilter").value;
  followState.filters.assigned = $("assignedFilter").value.trim();
  followState.filters.keyStatesOnly = $("keyStateToggle").checked;
  followState.filters.includeNoDate = $("includeNoDateToggle").checked;
  followState.filters.limit = Number($("limitFilter").value || 500);
}

async function loadFollowups(force = false) {
  $("loading").classList.remove("hidden");
  $("tableContainer").innerHTML = "";
  updateKpis();
  try {
    const payload = await api("followups", {
      q: followState.filters.q,
      tier: followState.filters.tier,
      state: followState.filters.state,
      status: followState.filters.status,
      priority: followState.filters.priority,
      assigned: followState.filters.assigned,
      keyStatesOnly: followState.filters.keyStatesOnly ? "1" : "0",
      includeNoDate: followState.filters.includeNoDate ? "1" : "0",
      limit: followState.filters.limit,
      force: force ? "1" : "0"
    });
    if (!payload.ok) throw new Error(payload.error || "Follow-up lookup failed.");
    followState.rows = payload.rows || [];
    followState.totalMatched = payload.totalMatched ?? followState.rows.length;
    renderTable();
  } catch (err) {
    $("tableContainer").innerHTML = `<div class="setup-warning"><strong>Could not load follow-ups.</strong><br>${escapeHtml(err.message || String(err))}</div>`;
  } finally {
    $("loading").classList.add("hidden");
    updateKpis();
  }
}

function updateKpis() {
  const now = new Date(); now.setHours(0,0,0,0);
  const next7 = new Date(now); next7.setDate(now.getDate()+7);
  let overdue = 0, upcoming = 0;
  followState.rows.forEach(r => {
    const d = parseDate(r.next_follow_up);
    if (!d) return;
    if (d < now) overdue++;
    else if (d <= next7) upcoming++;
  });
  $("metricMatched").textContent = String(followState.totalMatched || "—");
  $("metricOverdue").textContent = String(overdue || "—");
  $("metricNext7").textContent = String(upcoming || "—");
  $("metricKeyStates").textContent = followState.filters.keyStatesOnly ? "ON" : "OFF";
}

function renderTable() {
  if (!followState.rows.length) {
    $("tableContainer").innerHTML = `<div class="setup-warning">No follow-up rows matched the current filters.</div>`;
    return;
  }
  const columns = followColumns();
  const displayRows = getSortedRows(columns);
  const colgroup = columns.map(c => `<col style="width:${c.width || 120}px">`).join("");
  const header = columns.map(c => sortableHeader(c)).join("");
  const body = displayRows.map(r => `<tr>${columns.map(c => {
    const value = c.value(r);
    const cls = [c.nowrap ? "table-nowrap" : "", c.key === "notes" ? "table-tight-note" : "", c.key === "entity_name" ? "table-name-static" : "", bucketClass(c.key, value)].filter(Boolean).join(" ");
    const title = c.key === "notes" ? ` title="${escapeAttr(value)}"` : "";
    return `<td class="${cls}"${title}>${escapeHtml(value)}</td>`;
  }).join("")}</tr>`).join("");
  $("tableContainer").innerHTML = `<table class="data-table resizable-table"><colgroup>${colgroup}</colgroup><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  $("tableContainer").querySelectorAll("th.sortable").forEach(th => th.addEventListener("click", e => {
    if (e.target.classList.contains("col-resizer")) return;
    const key = th.dataset.sortKey;
    if (followState.sort.key === key) followState.sort.dir = followState.sort.dir === "asc" ? "desc" : "asc";
    else followState.sort = { key, dir: "asc" };
    renderTable();
  }));
  attachColumnResizers($("tableContainer"));
}

function followColumns() {
  return [
    { key: "next_follow_up", label: "Next Follow-Up", width: 120, nowrap: true, value: r => dateOnly(r.next_follow_up) },
    { key: "follow_up_bucket", label: "Bucket", width: 110, nowrap: true, value: r => r.follow_up_bucket || "" },
    { key: "entity_name", label: "Entity", width: 280, value: r => r.entity_name || "" },
    { key: "tier_key", label: "Tier", width: 80, nowrap: true, value: r => tierLabel(r.tier_key) },
    { key: "state", label: "State", width: 70, nowrap: true, value: r => r.state || "" },
    { key: "county", label: "County", width: 140, value: r => r.county || "" },
    { key: "city", label: "City", width: 120, value: r => r.city || "" },
    { key: "assigned_to", label: "Assigned", width: 130, value: r => r.assigned_to || "" },
    { key: "status", label: "Status", width: 130, value: r => r.status || "" },
    { key: "priority", label: "Priority", width: 95, value: r => r.priority || "" },
    { key: "last_contact_date", label: "Last Contact", width: 120, nowrap: true, value: r => dateOnly(r.last_contact_date) },
    { key: "contact", label: "Contact", width: 220, value: r => [r.superintendent_name, r.other_contact_name].filter(Boolean).join(" / ") },
    { key: "email", label: "Email", width: 240, value: r => [r.superintendent_email, r.other_contact_email].filter(Boolean).join(" / ") },
    { key: "notes", label: "Notes", width: 360, value: r => r.notes || "" },
    { key: "updated_at", label: "Updated", width: 145, nowrap: true, value: r => dateOnly(r.updated_at) },
    { key: "updated_by", label: "Updated By", width: 120, value: r => r.updated_by || "" }
  ];
}

function sortableHeader(c) {
  const active = followState.sort.key === c.key;
  const arrow = active ? (followState.sort.dir === "asc" ? " ▲" : " ▼") : "";
  return `<th class="sortable" data-sort-key="${escapeAttr(c.key)}"><span>${escapeHtml(c.label)}${arrow}</span><span class="col-resizer" title="Drag to resize"></span></th>`;
}
function getSortedRows(columns) {
  const rows = followState.rows.slice();
  const col = columns.find(c => c.key === followState.sort.key);
  if (!col) return rows;
  rows.sort((a, b) => compareValues(col.value(a), col.value(b), followState.sort.dir));
  return rows;
}
function compareValues(a, b, dir) {
  const mult = dir === "desc" ? -1 : 1;
  const av = a == null ? "" : String(a).trim();
  const bv = b == null ? "" : String(b).trim();
  const ad = Date.parse(av), bd = Date.parse(bv);
  if (!isNaN(ad) && !isNaN(bd) && /\d{4}-\d{2}-\d{2}/.test(av + bv)) return (ad - bd) * mult;
  const an = Number(av.replace(/[^0-9.-]/g, ""));
  const bn = Number(bv.replace(/[^0-9.-]/g, ""));
  if (av !== "" && bv !== "" && !isNaN(an) && !isNaN(bn)) return (an - bn) * mult;
  return av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" }) * mult;
}
function attachColumnResizers(container) {
  const table = container.querySelector("table");
  const colgroup = table?.querySelector("colgroup");
  if (!table || !colgroup) return;
  table.querySelectorAll("th .col-resizer").forEach((handle, index) => {
    handle.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation();
      const col = colgroup.children[index];
      const startX = e.pageX;
      const startWidth = parseInt(col.style.width, 10) || table.querySelectorAll("th")[index].offsetWidth;
      document.body.classList.add("is-resizing");
      const onMove = ev => { col.style.width = `${Math.max(55, startWidth + (ev.pageX - startX))}px`; };
      const onUp = () => { document.body.classList.remove("is-resizing"); document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
      document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
    });
  });
}

function bucketClass(key, value) {
  if (key !== "follow_up_bucket") return "";
  const v = String(value || "").toLowerCase();
  if (v.includes("overdue")) return "bucket-overdue";
  if (v.includes("today")) return "bucket-today";
  if (v.includes("next")) return "bucket-next";
  return "";
}
function exportCsv() {
  if (!followState.rows.length) return showToast("No rows to export.");
  const columns = followColumns();
  const lines = [columns.map(c => csvEscape(c.label)).join(",")];
  getSortedRows(columns).forEach(r => lines.push(columns.map(c => csvEscape(c.value(r))).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rus_dlt_followups_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function csvEscape(v) { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function tierLabel(t) { return ({ tier1:"Tier 1", tier2:"Tier 2", tier3:"Tier 3", tier4:"Tier 4", allk12:"All K-12" }[t] || t || ""); }
function dateOnly(v) { if (!v) return ""; const s = String(v); const m = s.match(/\d{4}-\d{2}-\d{2}/); if (m) return m[0]; const d = new Date(s); return isNaN(d.getTime()) ? "" : d.toISOString().slice(0,10); }
function parseDate(v) { const d = new Date(dateOnly(v)); if (isNaN(d.getTime())) return null; d.setHours(0,0,0,0); return d; }
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
function showToast(message) { const el = $("toast"); el.textContent = message; el.classList.remove("hidden"); clearTimeout(showToast._timer); showToast._timer = setTimeout(() => el.classList.add("hidden"), 4200); }
initFollowups();
