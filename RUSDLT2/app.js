const TIERS = [
  { key: "tier1", label: "Tier 1", title: "Very Rural K-12", subtitle: ">30% SAIPE", description: "Highest-priority rural remote K-12 districts with strong poverty scoring potential." },
  { key: "tier2", label: "Tier 2", title: "Rural K-12", subtitle: "SAIPE Unknown", description: "Rural remote K-12 districts needing SAIPE/contact verification." },
  { key: "tier3", label: "Tier 3", title: "Higher Ed", subtitle: "Locale Filter", description: "Higher education list; use locale filters to isolate rural/town opportunities." },
  { key: "tier4", label: "Tier 4", title: "Higher Ed Outreach", subtitle: "Rural Outreach", description: "Higher education organizations with rural outreach partnership potential." },
  { key: "allk12", label: "All K-12", title: "All K-12", subtitle: "Locales 11–43", description: "All K-12 districts across locales 11–43 for broader callout expansion." },
  { key: "hrsa", label: "HRSA", title: "HRSA Lookup", subtitle: "FQHC/LAL", description: "Search HRSA/FQHC and look-alike sites for healthcare partner mapping." }
];

const KEY_STATES = [
  "Mississippi", "Illinois", "North Carolina", "Alaska", "Ohio", "Oregon", "Idaho", "Arizona",
  "South Dakota", "Florida", "Nebraska", "Arkansas", "New Mexico", "Wisconsin", "Iowa", "Nevada",
  "Utah", "Indiana", "Montana", "North Dakota", "New Hampshire", "Wyoming", "Massachusetts", "Hawaii"
];

const STATES = [
  ["", "All states"], ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"],
  ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"],
  ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"]
];
const STATE_NAME_BY_ABBR = Object.fromEntries(STATES.filter(s => s[0]).map(([a,n]) => [a,n]));
const STATE_ABBR_BY_NAME = Object.fromEntries(STATES.filter(s => s[0]).map(([a,n]) => [n.toLowerCase(),a]));

const STATUS_OPTIONS = [
  "", "Not Started", "Assigned", "Called - Left VM", "Emailed", "Contacted", "Interested", "Follow Up", "Not a Fit", "Do Not Contact", "Needs Research", "Submitted to Rep"
];

const state = {
  tier: "tier1",
  view: "cards",
  offset: 0,
  rows: [],
  totalMatched: 0,
  selected: null,
  loading: false,
  filters: {
    q: "",
    state: "",
    status: "",
    assigned: "",
    keyStatesOnly: window.APP_CONFIG?.DEFAULT_KEY_STATES_ONLY ?? true,
    ruralOnly: false,
    locale: "",
    limit: window.APP_CONFIG?.DEFAULT_LIMIT ?? 100
  }
};

const $ = (id) => document.getElementById(id);

function configured() {
  return Boolean(window.APP_CONFIG?.API_URL && !window.APP_CONFIG.API_URL.includes("PASTE_YOUR_DEPLOYED"));
}

function init() {
  $("sourceLink").href = window.APP_CONFIG.SOURCE_SHEET_URL;
  renderTierTabs();
  renderFilters();
  bindEvents();
  applyDefaults();
  if (!configured()) {
    $("setupWarning").classList.remove("hidden");
    renderEmptySetup();
    return;
  }
  loadData();
}

function renderTierTabs() {
  const nav = $("tierTabs");
  nav.innerHTML = TIERS.map(t => `
    <button class="tier-tab ${t.key === state.tier ? "active" : ""}" type="button" data-tier="${t.key}">
      <strong>${escapeHtml(t.label)} • ${escapeHtml(t.title)}</strong>
      <small>${escapeHtml(t.subtitle)}</small>
    </button>
  `).join("");
}

function renderFilters() {
  $("stateFilter").innerHTML = STATES.map(([abbr, name]) => `<option value="${abbr}">${escapeHtml(name)}</option>`).join("");
  $("statusFilter").innerHTML = STATUS_OPTIONS.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v || "All statuses")}</option>`).join("");
  $("keyStatesList").innerHTML = KEY_STATES.map(s => `<span class="key-chip">${escapeHtml(s)}</span>`).join("");
}

function bindEvents() {
  $("tierTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tier]");
    if (!btn) return;
    state.tier = btn.dataset.tier;
    state.offset = 0;
    state.selected = null;
    renderTierTabs();
    updateMetricLabels();
    if (state.tier === "hrsa") {
      $("ruralLocaleToggle").checked = false;
      state.filters.ruralOnly = false;
    }
    loadData();
  });

  const debounced = debounce(() => { state.offset = 0; readFilters(); loadData(); }, 350);
  ["searchInput", "assignedFilter"].forEach(id => $(id).addEventListener("input", debounced));
  ["stateFilter", "statusFilter", "localeFilter", "limitFilter"].forEach(id => $(id).addEventListener("change", () => { state.offset = 0; readFilters(); loadData(); }));
  ["keyStateToggle", "ruralLocaleToggle"].forEach(id => $(id).addEventListener("change", () => { state.offset = 0; readFilters(); loadData(); }));

  $("cardsViewBtn").addEventListener("click", () => switchView("cards"));
  $("tableViewBtn").addEventListener("click", () => switchView("table"));
  $("refreshBtn").addEventListener("click", () => loadData(true));
  $("exportBtn").addEventListener("click", exportVisibleCsv);
}

function applyDefaults() {
  $("keyStateToggle").checked = state.filters.keyStatesOnly;
  $("limitFilter").value = String(state.filters.limit);
  updateMetricLabels();
}

function readFilters() {
  state.filters.q = $("searchInput").value.trim();
  state.filters.state = $("stateFilter").value;
  state.filters.status = $("statusFilter").value;
  state.filters.assigned = $("assignedFilter").value.trim();
  state.filters.keyStatesOnly = $("keyStateToggle").checked;
  state.filters.ruralOnly = $("ruralLocaleToggle").checked;
  state.filters.locale = $("localeFilter").value;
  state.filters.limit = Number($("limitFilter").value || 100);
}

async function loadData(force = false) {
  if (!configured()) return;
  state.loading = true;
  $("loading").classList.remove("hidden");
  $("cardsContainer").innerHTML = "";
  $("tableContainer").innerHTML = "";
  updateMetricLabels();
  try {
    const action = state.tier === "hrsa" ? "hrsaLookup" : "list";
    const params = {
      tier: state.tier,
      q: state.filters.q,
      state: state.filters.state,
      status: state.filters.status,
      assigned: state.filters.assigned,
      keyStatesOnly: state.filters.keyStatesOnly ? "1" : "0",
      ruralOnly: state.filters.ruralOnly ? "1" : "0",
      locale: state.filters.locale,
      offset: state.offset,
      limit: state.filters.limit,
      force: force ? "1" : "0"
    };
    const payload = await api(action, params);
    if (!payload.ok) throw new Error(payload.error || "The Apps Script backend returned an error.");
    state.rows = payload.rows || [];
    state.totalMatched = payload.totalMatched ?? payload.total ?? state.rows.length;
    state.selected = null;
    renderResults();
  } catch (err) {
    showToast(err.message || String(err));
    $("cardsContainer").innerHTML = `<div class="setup-warning"><strong>Could not load data.</strong><br>${escapeHtml(err.message || String(err))}</div>`;
  } finally {
    state.loading = false;
    $("loading").classList.add("hidden");
    updateMetricLabels();
  }
}

function renderResults() {
  updateMetricLabels();
  renderPager();
  if (!state.rows.length) {
    $("cardsContainer").innerHTML = `<div class="setup-warning">No rows matched the current filters.</div>`;
    $("tableContainer").classList.add("hidden");
    $("cardsContainer").classList.remove("hidden");
    renderDetail(null);
    return;
  }
  renderCards();
  renderTable();
  switchView(state.view, false);
  renderDetail(null);
}

function renderCards() {
  $("cardsContainer").innerHTML = state.rows.map((r, idx) => {
    const status = r.activity?.status || "Not Started";
    const assigned = r.activity?.assigned_to || "Unassigned";
    const location = [r.city, r.state_abbr || r.state, r.zip].filter(Boolean).join(", ");
    const isKey = isKeyState(r.state || r.state_abbr);
    const locale = r.locale || "Locale n/a";
    const website = normalizeUrl(r.website);
    return `
      <article class="prospect-card" data-idx="${idx}">
        <div class="card-top">
          <div>
            <h3 class="card-title">${escapeHtml(r.name || "Unnamed record")}</h3>
            <div class="card-meta">${escapeHtml(location || r.county || "Location n/a")} ${r.county ? "• " + escapeHtml(r.county) : ""}</div>
          </div>
          <span class="tag status">${escapeHtml(status)}</span>
        </div>
        <div class="card-tags">
          <span class="tag priority">${escapeHtml(tierLabel(r.tier_key || state.tier))}</span>
          ${isKey ? `<span class="tag key">Key State</span>` : ""}
          <span class="tag">${escapeHtml(locale)}</span>
          ${r.saipe ? `<span class="tag warn">SAIPE ${escapeHtml(String(r.saipe))}</span>` : ""}
          <span class="tag">${escapeHtml(assigned)}</span>
        </div>
        <div class="card-meta">
          ${r.phone ? `☎ ${escapeHtml(r.phone)}<br>` : ""}
          ${r.address ? escapeHtml(r.address) : ""}
        </div>
        <div class="card-actions">
          <button type="button" data-action="open" data-idx="${idx}">Open / Update</button>
          ${website ? `<a class="link-button" href="${escapeAttr(website)}" target="_blank" rel="noreferrer">Website</a>` : ""}
          <button type="button" data-action="hrsa" data-idx="${idx}">HRSA Nearby</button>
        </div>
      </article>
    `;
  }).join("");
  $("cardsContainer").querySelectorAll("[data-action='open']").forEach(btn => btn.addEventListener("click", () => selectRow(Number(btn.dataset.idx))));
  $("cardsContainer").querySelectorAll("[data-action='hrsa']").forEach(btn => btn.addEventListener("click", () => { selectRow(Number(btn.dataset.idx)); lookupNearbyHrsa(); }));
}

function renderTable() {
  const rows = state.rows.map((r, idx) => `
    <tr>
      <td class="table-name" data-idx="${idx}">${escapeHtml(r.name || "Unnamed")}</td>
      <td>${escapeHtml(r.state_abbr || r.state || "")}</td>
      <td>${escapeHtml(r.county || "")}</td>
      <td>${escapeHtml(r.city || "")}</td>
      <td>${escapeHtml(r.locale || "")}</td>
      <td>${escapeHtml(r.saipe || "")}</td>
      <td>${escapeHtml(r.activity?.assigned_to || "")}</td>
      <td>${escapeHtml(r.activity?.status || "Not Started")}</td>
      <td>${escapeHtml(r.activity?.next_follow_up || "")}</td>
    </tr>
  `).join("");
  $("tableContainer").innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>State</th><th>County</th><th>City</th><th>Locale</th><th>SAIPE</th><th>Assigned</th><th>Status</th><th>Next Follow-Up</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  $("tableContainer").querySelectorAll(".table-name").forEach(cell => cell.addEventListener("click", () => selectRow(Number(cell.dataset.idx))));
}

function switchView(view, updateButtons = true) {
  state.view = view;
  $("cardsContainer").classList.toggle("hidden", view !== "cards");
  $("tableContainer").classList.toggle("hidden", view !== "table");
  if (updateButtons) {
    $("cardsViewBtn").classList.toggle("active", view === "cards");
    $("tableViewBtn").classList.toggle("active", view === "table");
  } else {
    $("cardsViewBtn").classList.toggle("active", view === "cards");
    $("tableViewBtn").classList.toggle("active", view === "table");
  }
}

function selectRow(idx) {
  state.selected = state.rows[idx];
  document.querySelectorAll(".prospect-card").forEach((card, i) => card.classList.toggle("selected", i === idx));
  renderDetail(state.selected);
}

function renderDetail(r) {
  const panel = $("detailPanel");
  if (!r) {
    panel.innerHTML = `<div class="empty-detail"><h2>Select a prospect</h2><p>Open a card to assign outreach, update superintendent/contact data, add notes, and look up nearby HRSA/FQHC sites.</p></div>`;
    return;
  }
  const a = r.activity || {};
  const website = normalizeUrl(r.website);
  const rawRows = Object.entries(r.raw || {})
    .filter(([_, v]) => v !== "" && v !== null && v !== undefined)
    .slice(0, 60)
    .map(([k, v]) => `<div class="raw-row"><div class="raw-key">${escapeHtml(k)}</div><div>${escapeHtml(String(v))}</div></div>`).join("");

  panel.innerHTML = `
    <h2 class="detail-title">${escapeHtml(r.name || "Unnamed record")}</h2>
    <p class="detail-sub">${escapeHtml([r.address, r.city, r.state_abbr || r.state, r.zip].filter(Boolean).join(", "))}<br>${r.county ? escapeHtml(r.county) : ""} ${r.phone ? "• " + escapeHtml(r.phone) : ""}</p>
    <div class="card-tags">
      <span class="tag priority">${escapeHtml(tierLabel(r.tier_key || state.tier))}</span>
      ${isKeyState(r.state || r.state_abbr) ? `<span class="tag key">Key State</span>` : ""}
      ${r.locale ? `<span class="tag">${escapeHtml(r.locale)}</span>` : ""}
      ${r.saipe ? `<span class="tag warn">SAIPE ${escapeHtml(String(r.saipe))}</span>` : ""}
    </div>
    <div class="detail-actions">
      ${website ? `<a class="small-button" href="${escapeAttr(website)}" target="_blank" rel="noreferrer">Open Website</a>` : ""}
      <button id="nearbyHrsaBtn" class="small-button" type="button">Find Nearby HRSA/FQHC</button>
    </div>

    <form id="activityForm" class="detail-section">
      <h3>Rep Activity</h3>
      <div class="form-grid">
        <label><span>Assigned To</span><input name="assigned_to" value="${escapeAttr(a.assigned_to || "")}" placeholder="Rep name" /></label>
        <label><span>Status</span><select name="status">${STATUS_OPTIONS.filter(Boolean).map(s => `<option ${s === (a.status || "Not Started") ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select></label>
        <label><span>Priority</span><select name="priority">
          ${["", "High", "Medium", "Low"].map(s => `<option value="${s}" ${s === (a.priority || "") ? "selected" : ""}>${s || "No priority"}</option>`).join("")}
        </select></label>
        <label><span>Next Follow-Up</span><input name="next_follow_up" type="date" value="${escapeAttr(toDateInput(a.next_follow_up))}" /></label>
        <label><span>Last Contact Date</span><input name="last_contact_date" type="date" value="${escapeAttr(toDateInput(a.last_contact_date))}" /></label>
        <label><span>Updated By</span><input name="updated_by" value="${escapeAttr(a.updated_by || "")}" placeholder="Your name" /></label>
      </div>

      <div class="detail-section">
        <h3>Update Superintendent / Contact Data</h3>
        <div class="form-grid">
          <label><span>Superintendent Name</span><input name="superintendent_name" value="${escapeAttr(a.superintendent_name || sourceGuess(r, "superintendent"))}" /></label>
          <label><span>Superintendent Email</span><input name="superintendent_email" value="${escapeAttr(a.superintendent_email || sourceGuess(r, "superintendent_email"))}" /></label>
          <label><span>Other Contact Name</span><input name="other_contact_name" value="${escapeAttr(a.other_contact_name || "")}" /></label>
          <label><span>Other Contact Title</span><input name="other_contact_title" value="${escapeAttr(a.other_contact_title || "")}" /></label>
          <label><span>Other Contact Email</span><input name="other_contact_email" value="${escapeAttr(a.other_contact_email || "")}" /></label>
          <label><span>Other Contact Phone</span><input name="other_contact_phone" value="${escapeAttr(a.other_contact_phone || "")}" /></label>
          <label class="full"><span>Contact Source / Verification Note</span><input name="contact_source" value="${escapeAttr(a.contact_source || "")}" placeholder="Website, LinkedIn, district directory, call, etc." /></label>
          <label class="full"><span>Rep Notes</span><textarea name="notes" placeholder="Call notes, needs, next step, grant fit, partner idea…">${escapeHtml(a.notes || "")}</textarea></label>
        </div>
        <div class="detail-actions">
          <button class="primary-button" type="submit">Save Activity</button>
          <button id="clearSelectionBtn" class="danger-button" type="button">Close</button>
        </div>
      </div>
    </form>

    <div id="hrsaPanel" class="detail-section hidden">
      <h3>Nearby HRSA / FQHC Lookup</h3>
      <div id="hrsaResults" class="hrsa-list"></div>
    </div>

    <div class="detail-section">
      <h3>Source Data</h3>
      <div class="raw-details">${rawRows || "No source details returned."}</div>
    </div>
  `;

  $("nearbyHrsaBtn")?.addEventListener("click", lookupNearbyHrsa);
  $("clearSelectionBtn")?.addEventListener("click", () => { state.selected = null; renderDetail(null); document.querySelectorAll(".prospect-card").forEach(c => c.classList.remove("selected")); });
  $("activityForm").addEventListener("submit", saveActivity);
}

async function saveActivity(e) {
  e.preventDefault();
  if (!state.selected) return;
  const form = new FormData(e.currentTarget);
  const payload = Object.fromEntries(form.entries());
  Object.assign(payload, {
    record_id: state.selected.record_id,
    entity_key: state.selected.entity_key,
    tier_key: state.selected.tier_key || state.tier,
    source_sheet: state.selected.source_sheet,
    row_number: state.selected.row_number,
    entity_name: state.selected.name,
    state: state.selected.state_abbr || state.selected.state,
    county: state.selected.county,
    city: state.selected.city,
    zip: state.selected.zip,
    contact_data_updated: new Date().toISOString()
  });
  try {
    await apiPost("saveActivity", payload);
    showToast("Saved to Google Sheet. Refreshing visible rows…");
    await delay(900);
    await loadData(true);
  } catch (err) {
    showToast(err.message || String(err));
  }
}

async function lookupNearbyHrsa() {
  if (!state.selected) return;
  const r = state.selected;
  $("hrsaPanel")?.classList.remove("hidden");
  $("hrsaResults").innerHTML = `<div class="loading">Searching HRSA/FQHC sites by state, county/city, and distance when coordinates are available…</div>`;
  try {
    const payload = await api("hrsaLookup", {
      state: r.state_abbr || STATE_ABBR_BY_NAME[(r.state || "").toLowerCase()] || r.state || "",
      county: r.county || "",
      city: r.city || "",
      lat: r.latitude || "",
      lng: r.longitude || "",
      limit: 12
    });
    const rows = payload.rows || [];
    if (!rows.length) {
      $("hrsaResults").innerHTML = `<div class="setup-warning">No HRSA/FQHC rows matched this location.</div>`;
      return;
    }
    $("hrsaResults").innerHTML = rows.map(h => `
      <div class="hrsa-card">
        <strong>${escapeHtml(h.name || h.organization || "HRSA site")}</strong>
        <small>${escapeHtml([h.address, h.city, h.state_abbr || h.state, h.zip].filter(Boolean).join(", "))}</small>
        <small>${h.county ? escapeHtml(h.county) + " • " : ""}${h.phone ? "☎ " + escapeHtml(h.phone) : ""}${h.distance_miles ? " • ~" + escapeHtml(String(h.distance_miles)) + " mi" : ""}</small>
        ${h.website ? `<small><a href="${escapeAttr(normalizeUrl(h.website))}" target="_blank" rel="noreferrer">Website</a></small>` : ""}
      </div>
    `).join("");
  } catch (err) {
    $("hrsaResults").innerHTML = `<div class="setup-warning">${escapeHtml(err.message || String(err))}</div>`;
  }
}

function renderPager() {
  const start = state.totalMatched ? state.offset + 1 : 0;
  const end = Math.min(state.offset + state.filters.limit, state.totalMatched);
  $("pager").innerHTML = `
    <button type="button" ${state.offset <= 0 ? "disabled" : ""} id="prevPage">‹ Prev</button>
    <span>${start}-${end} of ${state.totalMatched}</span>
    <button type="button" ${end >= state.totalMatched ? "disabled" : ""} id="nextPage">Next ›</button>
  `;
  $("prevPage")?.addEventListener("click", () => { state.offset = Math.max(0, state.offset - state.filters.limit); loadData(); });
  $("nextPage")?.addEventListener("click", () => { state.offset += state.filters.limit; loadData(); });
}

function updateMetricLabels() {
  const t = TIERS.find(x => x.key === state.tier) || TIERS[0];
  $("metricTier").textContent = t.label + " • " + t.title;
  $("metricSubtitle").textContent = t.subtitle;
  $("metricMatched").textContent = state.loading ? "…" : String(state.totalMatched || "—");
  $("metricKeyStates").textContent = state.filters.keyStatesOnly ? "ON" : "OFF";
  $("resultsTitle").textContent = state.tier === "hrsa" ? "HRSA / FQHC Lookup" : `${t.label}: ${t.title}`;
  $("resultsSubtitle").textContent = t.description;
}

function renderEmptySetup() {
  $("cardsContainer").innerHTML = `
    <div class="setup-warning">
      <strong>Files are ready.</strong><br>
      Deploy the Apps Script backend, paste the Web App URL into <code>config.js</code>, then publish these HTML files to GitHub Pages.
    </div>`;
  updateMetricLabels();
}

function tierLabel(key) {
  const t = TIERS.find(x => x.key === key);
  return t ? t.label : key;
}

function isKeyState(value) {
  if (!value) return false;
  const name = value.length === 2 ? STATE_NAME_BY_ABBR[value.toUpperCase()] : value;
  return KEY_STATES.map(s => s.toLowerCase()).includes(String(name || "").toLowerCase());
}

function sourceGuess(r, type) {
  const raw = r.raw || {};
  const keys = Object.keys(raw);
  const terms = type === "superintendent_email" ? ["superintendent email", "supt email"] : ["superintendent", "supt"];
  const key = keys.find(k => terms.some(t => k.toLowerCase().includes(t)));
  return key ? raw[key] : "";
}

function normalizeUrl(url) {
  if (!url) return "";
  const u = String(url).trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function toDateInput(value) {
  if (!value) return "";
  const s = String(value);
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0,10);
}

function exportVisibleCsv() {
  if (!state.rows.length) return showToast("No rows to export.");
  const headers = ["tier", "name", "state", "county", "city", "zip", "phone", "website", "locale", "saipe", "assigned_to", "status", "priority", "next_follow_up", "notes"];
  const lines = [headers.join(",")];
  state.rows.forEach(r => {
    const a = r.activity || {};
    const row = [tierLabel(r.tier_key || state.tier), r.name, r.state_abbr || r.state, r.county, r.city, r.zip, r.phone, r.website, r.locale, r.saipe, a.assigned_to, a.status, a.priority, a.next_follow_up, a.notes]
      .map(csvEscape).join(",");
    lines.push(row);
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rus_dlt_2026_${state.tier}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function api(action, params = {}) {
  const callbackName = `__rusDltCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const url = new URL(window.APP_CONFIG.API_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("callback", callbackName);
  url.searchParams.set("_", Date.now().toString());
  if (window.APP_CONFIG.API_TOKEN) url.searchParams.set("token", window.APP_CONFIG.API_TOKEN);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Apps Script request timed out. Check deployment access and API URL."));
    }, 30000);
    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }
    window[callbackName] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error("Could not reach Apps Script Web App.")); };
    script.src = url.toString();
    document.head.appendChild(script);
  });
}

async function apiPost(action, payload = {}) {
  const body = new URLSearchParams();
  body.set("action", action);
  body.set("payload", JSON.stringify(payload));
  if (window.APP_CONFIG.API_TOKEN) body.set("token", window.APP_CONFIG.API_TOKEN);
  await fetch(window.APP_CONFIG.API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: body.toString()
  });
  return { ok: true };
}

function debounce(fn, wait) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
}
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#96;"); }
function showToast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.add("hidden"), 4200);
}

init();
