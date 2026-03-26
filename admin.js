/* ════════════════════════════════════════════════════════════
   Campus AI — admin.js  (full rebuild with degree timetable)
════════════════════════════════════════════════════════════ */

const BASE_URL = "https://newclg-bot-backend.onrender.com";

// ── Auth guard ────────────────────────────────────────────
const token = localStorage.getItem("access_token");
const role  = localStorage.getItem("user_role");
if (!token || role !== "admin") window.location.href = "login.html";

const payload = JSON.parse(atob(token.split(".")[1]));
document.getElementById("admin-name-display").textContent =
  payload.username || payload.sub || "Admin";

function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": "Bearer " + token };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(BASE_URL + path, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401 || res.status === 403) {
    alert("Session expired. Please log in again.");
    logout();
    return null;
  }
  return res;
}

function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_role");
  window.location.href = "login.html";
}

// ── Tab navigation ─────────────────────────────────────────
const navItems  = document.querySelectorAll(".nav-item");
const tabPanels = document.querySelectorAll(".tab-panel");

navItems.forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    navItems.forEach(n => n.classList.remove("active"));
    tabPanels.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + tab).classList.add("active");
    if (tab === "day-orders"    && !doLoaded)  loadDayOrders();
    if (tab === "timetable"     && !ttLoaded)  initTimetable();
    if (tab === "announcements" && !annLoaded) loadAnnouncements();
    if (tab === "students"      && !stuLoaded) loadStudents();
    closeSidebar();
  });
});

function toggleSidebar() { document.getElementById("sidebar").classList.toggle("open"); }
function closeSidebar()  { document.getElementById("sidebar").classList.remove("open"); }

function escHtml(str) {
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function todayISO() { return new Date().toISOString().slice(0,10); }

// ════════════════════════════════════════════════════════════
//  DAY ORDERS
// ════════════════════════════════════════════════════════════

let doLoaded = false, doData = [];

async function loadDayOrders() {
  doLoaded = true;
  document.getElementById("do-loading").style.display = "";
  document.getElementById("do-table").style.display   = "none";
  document.getElementById("do-empty").style.display   = "none";
  const res = await apiFetch("/admin/day-orders");
  if (!res) return;
  doData = await res.json();
  renderDayOrders();
}

function renderDayOrders() {
  document.getElementById("do-loading").style.display = "none";
  if (doData.length === 0) { document.getElementById("do-empty").style.display = ""; return; }
  document.getElementById("do-table").style.display = "";
  const tbody = document.getElementById("do-tbody");
  tbody.innerHTML = "";
  doData.forEach(item => {
    const weekday   = new Date(item.date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short" });
    const isHoliday = item.day_order === 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><code style="font-family:var(--font-mono,monospace);font-size:13px">${item.date}</code></td>
      <td>${weekday}</td>
      <td><span class="do-pill${isHoliday?" holiday":""}">${isHoliday?"Holiday":item.day_order}</span></td>
      <td style="color:var(--tx-2)">${item.reason||"—"}</td>
      <td><div class="actions-cell">
        <button class="btn-icon" onclick="editDayOrder(${item.id})" title="Edit">${iconEdit()}</button>
        <button class="btn-icon danger" onclick="confirmDelete('day-order',${item.id},'${item.date}')" title="Delete">${iconDelete()}</button>
      </div></td>`;
    tbody.appendChild(tr);
  });
}

function openDOModal(prefillId=null) {
  const item = prefillId ? doData.find(d=>d.id===prefillId) : null;
  document.getElementById("do-modal-title").textContent = item ? "Edit Override" : "Add Override";
  document.getElementById("do-date").value   = item ? item.date      : todayISO();
  document.getElementById("do-value").value  = item ? item.day_order : "0";
  document.getElementById("do-reason").value = item ? item.reason    : "";
  document.getElementById("do-date").dataset.editId = item ? item.id : "";
  document.getElementById("do-modal").classList.add("open");
}
function closeDOModal() { document.getElementById("do-modal").classList.remove("open"); }
function editDayOrder(id) { openDOModal(id); }

async function saveDayOrder() {
  const date      = document.getElementById("do-date").value;
  const day_order = parseInt(document.getElementById("do-value").value);
  const reason    = document.getElementById("do-reason").value.trim();
  if (!date) { alert("Please pick a date."); return; }
  const res = await apiFetch("/admin/day-orders", {
    method: "POST", body: JSON.stringify({ date, day_order, reason })
  });
  if (!res) return;
  if (res.ok) { closeDOModal(); doLoaded=false; loadDayOrders(); }
  else { const d=await res.json(); alert("Error: "+(d.error||"Unknown")); }
}

// ════════════════════════════════════════════════════════════
//  TIMETABLE  — full degree/year/day-order editor
// ════════════════════════════════════════════════════════════

let ttLoaded     = false;
let ttAllData    = [];          // all entries from DB
let ttDepts      = [];          // list of department strings
let ttActiveDept = null;
let ttActiveYear = null;
let ttActiveDO   = 1;

const ROMAN = ["","I","II","III","IV","V","VI"];

async function initTimetable() {
  ttLoaded = true;
  await loadAllTimetableData();
  renderDeptBar();
}

async function loadAllTimetableData() {
  const [entriesRes, deptsRes] = await Promise.all([
    apiFetch("/admin/timetable"),
    apiFetch("/admin/timetable/departments"),
  ]);
  if (!entriesRes || !deptsRes) return;
  ttAllData = await entriesRes.json();
  ttDepts   = await deptsRes.json();
}

// ── Degree bar ─────────────────────────────────────────────
function renderDeptBar() {
  const bar = document.getElementById("tt-dept-bar");
  bar.innerHTML = "";

  ttDepts.forEach(dept => {
    const btn = document.createElement("button");
    btn.className = "tt-dept-pill" + (dept === ttActiveDept ? " active" : "");
    btn.innerHTML = `<span>${escHtml(dept)}</span>
      <button class="tt-dept-del" title="Delete degree" onclick="deleteDept(event,'${escHtml(dept)}')">&times;</button>`;
    btn.addEventListener("click", () => selectDept(dept));
    bar.appendChild(btn);
  });

  // Add degree button
  const addBtn = document.createElement("button");
  addBtn.className = "tt-dept-pill add-pill";
  addBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Degree`;
  addBtn.onclick = openAddDeptModal;
  bar.appendChild(addBtn);

  // If no active dept pick first
  if (!ttActiveDept && ttDepts.length > 0) {
    ttActiveDept = ttDepts[0];
  }

  if (ttActiveDept) {
    renderYearTabs();
  } else {
    document.getElementById("tt-year-section").innerHTML =
      `<div class="empty-state">No degrees yet. Click <strong>+ Add Degree</strong> to get started.</div>`;
  }
}

function selectDept(dept) {
  ttActiveDept = dept;
  ttActiveYear = null;
  renderDeptBar();
}

// ── Year tabs ──────────────────────────────────────────────
function renderYearTabs() {
  const section = document.getElementById("tt-year-section");

  // Get years for this dept
  const years = [...new Set(
    ttAllData.filter(e => e.department === ttActiveDept).map(e => e.year)
  )].sort((a,b) => a-b);

  if (!ttActiveYear || !years.includes(ttActiveYear)) {
    ttActiveYear = years[0] || null;
  }

  let html = `<div class="tt-year-bar">`;
  years.forEach(y => {
    html += `<button class="tt-year-pill${y===ttActiveYear?" active":""}" onclick="selectYear(${y})">Year ${y}
      <span class="tt-year-del" onclick="deleteYear(event,${y})" title="Delete year">&times;</span>
    </button>`;
  });
  html += `<button class="tt-year-pill add-pill" onclick="openAddYearModal()">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Year
  </button></div>`;

  html += `<div id="tt-do-section"></div>`;
  section.innerHTML = html;

  if (ttActiveYear) renderDOTabs();
}

function selectYear(y) {
  ttActiveYear = y;
  renderYearTabs();
}

// ── Day Order tabs ─────────────────────────────────────────
function renderDOTabs() {
  const section = document.getElementById("tt-do-section");
  let html = `<div class="tt-do-bar">`;
  for (let i = 1; i <= 6; i++) {
    html += `<button class="tt-do-pill${i===ttActiveDO?" active":""}" onclick="selectDO(${i})">DO ${ROMAN[i]}</button>`;
  }
  html += `</div><div id="tt-grid-section"></div>`;
  section.innerHTML = html;
  renderGrid();
}

function selectDO(n) {
  ttActiveDO = n;
  renderDOTabs();
}

// ── Period grid ────────────────────────────────────────────
function renderGrid() {
  const container = document.getElementById("tt-grid-section");

  const entries = ttAllData.filter(e =>
    e.department === ttActiveDept &&
    e.year       === ttActiveYear &&
    e.day_order  === ttActiveDO
  ).sort((a,b) => a.period - b.period);

  // Determine max period (at least 5)
  const maxPeriod = Math.max(5, ...entries.map(e => e.period));

  let html = `<div class="tt-grid">`;

  for (let p = 1; p <= maxPeriod; p++) {
    const entry   = entries.find(e => e.period === p);
    const subject = entry ? entry.subject : "";
    const entryId = entry ? entry.id : "";
    html += `
      <div class="tt-grid-row" data-period="${p}">
        <span class="tt-period-label">Period ${p}</span>
        <input class="tt-subject-input" type="text"
               value="${escHtml(subject)}"
               placeholder="Subject / empty to clear"
               data-period="${p}"
               data-entry-id="${entryId}" />
        <button class="btn-icon danger tt-del-period" title="Remove period"
                onclick="deletePeriodRow(${p})">${iconDelete()}</button>
      </div>`;
  }

  html += `</div>
    <div class="tt-grid-actions">
      <button class="btn btn-ghost btn-sm" onclick="addPeriodRow()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Period
      </button>
      <button class="btn btn-primary btn-sm" onclick="saveAllPeriods()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13"/><polyline points="7 3 7 8 15 8"/></svg>
        Save All
      </button>
    </div>`;

  container.innerHTML = html;
}

function addPeriodRow() {
  const grid = document.querySelector(".tt-grid");
  if (!grid) return;
  const rows     = grid.querySelectorAll(".tt-grid-row");
  const nextP    = rows.length + 1;
  const div      = document.createElement("div");
  div.className  = "tt-grid-row";
  div.dataset.period = nextP;
  div.innerHTML = `
    <span class="tt-period-label">Period ${nextP}</span>
    <input class="tt-subject-input" type="text" value="" placeholder="Subject"
           data-period="${nextP}" data-entry-id="" />
    <button class="btn-icon danger tt-del-period" title="Remove period"
            onclick="deletePeriodRow(${nextP})">${iconDelete()}</button>`;
  grid.appendChild(div);
}

async function deletePeriodRow(period) {
  // Find entry in DB and delete if exists
  const entry = ttAllData.find(e =>
    e.department === ttActiveDept &&
    e.year       === ttActiveYear &&
    e.day_order  === ttActiveDO   &&
    e.period     === period
  );
  if (entry) {
    const res = await apiFetch(`/admin/timetable/${entry.id}`, { method: "DELETE" });
    if (!res || !res.ok) { alert("Failed to delete period."); return; }
  }
  // Remove from local data and re-render
  ttAllData = ttAllData.filter(e => !(
    e.department === ttActiveDept &&
    e.year       === ttActiveYear &&
    e.day_order  === ttActiveDO   &&
    e.period     === period
  ));
  renderGrid();
}

async function saveAllPeriods() {
  const inputs = document.querySelectorAll(".tt-subject-input");
  const saves  = [];

  inputs.forEach(inp => {
    const period  = parseInt(inp.dataset.period);
    const subject = inp.value.trim();
    if (!subject) return; // skip empty
    saves.push({ period, subject });
  });

  if (saves.length === 0) { alert("Nothing to save — all fields are empty."); return; }

  const saveBtn = document.querySelector(".tt-grid-actions .btn-primary");
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }

  const results = await Promise.all(saves.map(s =>
    apiFetch("/admin/timetable", {
      method: "POST",
      body: JSON.stringify({
        department: ttActiveDept,
        year:       ttActiveYear,
        day_order:  ttActiveDO,
        period:     s.period,
        subject:    s.subject,
      })
    })
  ));

  // Flash feedback
  const inputs2 = document.querySelectorAll(".tt-subject-input");
  results.forEach((res, i) => {
    if (!res) return;
    const inp = [...inputs2].find(el => parseInt(el.dataset.period) === saves[i].period);
    if (!inp) return;
    inp.classList.add(res.ok ? "saved-ok" : "saved-err");
    setTimeout(() => inp.classList.remove("saved-ok", "saved-err"), 1800);
  });

  // Reload local data
  const entriesRes = await apiFetch("/admin/timetable");
  if (entriesRes) ttAllData = await entriesRes.json();

  if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13"/><polyline points="7 3 7 8 15 8"/></svg> Save All`; }
}

// ── Add Degree modal ───────────────────────────────────────
function openAddDeptModal() {
  document.getElementById("new-dept-name").value = "";
  document.getElementById("add-dept-modal").classList.add("open");
}
function closeAddDeptModal() { document.getElementById("add-dept-modal").classList.remove("open"); }

async function saveNewDept() {
  const name = document.getElementById("new-dept-name").value.trim();
  if (!name) { alert("Please enter a degree name."); return; }
  if (ttDepts.includes(name)) { alert("Degree already exists."); return; }

  // Create a placeholder entry so the dept appears (period 0 trick — save year 1, DO 1, period 1, empty subject placeholder then delete)
  // Better: just add to local list and let admin fill periods
  ttDepts.push(name);
  ttActiveDept = name;
  ttActiveYear = 1;
  closeAddDeptModal();
  renderDeptBar();
}

// ── Add Year modal ─────────────────────────────────────────
function openAddYearModal() {
  document.getElementById("new-year-num").value = "";
  document.getElementById("add-year-modal").classList.add("open");
}
function closeAddYearModal() { document.getElementById("add-year-modal").classList.remove("open"); }

async function saveNewYear() {
  const y = parseInt(document.getElementById("new-year-num").value);
  if (!y || y < 1) { alert("Please enter a valid year number."); return; }

  const existingYears = [...new Set(
    ttAllData.filter(e => e.department === ttActiveDept).map(e => e.year)
  )];
  if (existingYears.includes(y)) { alert(`Year ${y} already exists.`); return; }

  ttActiveYear = y;
  closeAddYearModal();
  renderYearTabs();
}

// ── Delete degree ──────────────────────────────────────────
async function deleteDept(e, dept) {
  e.stopPropagation();
  if (!confirm(`Delete ALL timetable entries for "${dept}"? This cannot be undone.`)) return;
  const res = await apiFetch(`/admin/timetable/department/${encodeURIComponent(dept)}`, { method: "DELETE" });
  if (!res || !res.ok) { alert("Delete failed."); return; }
  ttDepts   = ttDepts.filter(d => d !== dept);
  ttAllData = ttAllData.filter(e => e.department !== dept);
  if (ttActiveDept === dept) ttActiveDept = ttDepts[0] || null;
  renderDeptBar();
}

// ── Delete year ────────────────────────────────────────────
async function deleteYear(e, year) {
  e.stopPropagation();
  if (!confirm(`Delete ALL entries for Year ${year} in ${ttActiveDept}?`)) return;
  const toDelete = ttAllData.filter(e => e.department === ttActiveDept && e.year === year);
  await Promise.all(toDelete.map(entry =>
    apiFetch(`/admin/timetable/${entry.id}`, { method: "DELETE" })
  ));
  ttAllData = ttAllData.filter(e => !(e.department === ttActiveDept && e.year === year));
  if (ttActiveYear === year) ttActiveYear = null;
  renderYearTabs();
}

// ════════════════════════════════════════════════════════════
//  ANNOUNCEMENTS
// ════════════════════════════════════════════════════════════

let annLoaded = false, annData = [];

async function loadAnnouncements() {
  annLoaded = true;
  document.getElementById("ann-loading").style.display = "";
  document.getElementById("ann-list").innerHTML        = "";
  document.getElementById("ann-empty").style.display   = "none";
  const res = await apiFetch("/admin/announcements");
  if (!res) return;
  annData = await res.json();
  renderAnnouncements();
}

function renderAnnouncements() {
  document.getElementById("ann-loading").style.display = "none";
  if (annData.length === 0) { document.getElementById("ann-empty").style.display = ""; return; }
  const list = document.getElementById("ann-list");
  list.innerHTML = "";
  annData.forEach(item => {
    const div = document.createElement("div");
    div.className = "ann-card";
    const statusBadge = item.active
      ? `<span class="badge badge-green">● Active</span>`
      : `<span class="badge badge-gray">Inactive</span>`;
    div.innerHTML = `
      <div class="ann-card-body">
        <div class="ann-title">${escHtml(item.title)} ${statusBadge}</div>
        <div class="ann-body">${escHtml(item.body)}</div>
        <div class="ann-meta">${new Date(item.created_at).toLocaleString("en-IN")}</div>
      </div>
      <div class="ann-card-actions">
        <button class="btn-icon" onclick="editAnnouncement(${item.id})" title="Edit">${iconEdit()}</button>
        <button class="btn-icon danger" onclick="confirmDelete('announcement',${item.id},'${escHtml(item.title)}')" title="Delete">${iconDelete()}</button>
      </div>`;
    list.appendChild(div);
  });
}

function openAnnModal() {
  document.getElementById("ann-modal-title").textContent = "New Announcement";
  document.getElementById("ann-title").value    = "";
  document.getElementById("ann-body").value     = "";
  document.getElementById("ann-active").checked = true;
  document.getElementById("ann-edit-id").value  = "";
  document.getElementById("ann-modal").classList.add("open");
}
function closeAnnModal() { document.getElementById("ann-modal").classList.remove("open"); }

function editAnnouncement(id) {
  const item = annData.find(a => a.id === id);
  if (!item) return;
  document.getElementById("ann-modal-title").textContent = "Edit Announcement";
  document.getElementById("ann-title").value    = item.title;
  document.getElementById("ann-body").value     = item.body;
  document.getElementById("ann-active").checked = item.active;
  document.getElementById("ann-edit-id").value  = item.id;
  document.getElementById("ann-modal").classList.add("open");
}

async function saveAnnouncement() {
  const title  = document.getElementById("ann-title").value.trim();
  const body   = document.getElementById("ann-body").value.trim();
  const active = document.getElementById("ann-active").checked;
  const editId = document.getElementById("ann-edit-id").value;
  if (!title || !body) { alert("Title and body are required."); return; }
  const method = editId ? "PUT" : "POST";
  const path   = editId ? `/admin/announcements/${editId}` : "/admin/announcements";
  const res = await apiFetch(path, { method, body: JSON.stringify({ title, body, active }) });
  if (!res) return;
  if (res.ok) { closeAnnModal(); annLoaded=false; loadAnnouncements(); }
  else { const d=await res.json(); alert("Error: "+(d.error||"Unknown")); }
}

// ════════════════════════════════════════════════════════════
//  STUDENTS
// ════════════════════════════════════════════════════════════

let stuLoaded = false, stuData = [];

async function loadStudents() {
  stuLoaded = true;
  document.getElementById("stu-loading").style.display = "";
  document.getElementById("stu-table").style.display   = "none";
  document.getElementById("stu-empty").style.display   = "none";
  const res = await apiFetch("/admin/students");
  if (!res) return;
  stuData = await res.json();
  renderStudents(stuData);
}

function renderStudents(data) {
  document.getElementById("stu-loading").style.display = "none";
  if (data.length === 0) {
    document.getElementById("stu-table").style.display = "none";
    document.getElementById("stu-empty").style.display = "";
    return;
  }
  document.getElementById("stu-table").style.display = "";
  document.getElementById("stu-empty").style.display = "none";
  const tbody = document.getElementById("stu-tbody");
  tbody.innerHTML = "";
  data.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escHtml(s.name)}</td>
      <td><code style="font-family:var(--font-mono,monospace);font-size:12px">${escHtml(s.register_number)}</code></td>
      <td>${escHtml(s.department)}</td>
      <td><span class="badge badge-blue">Year ${s.year}</span></td>
      <td><div class="actions-cell">
        <button class="btn-icon danger" onclick="confirmDelete('student',${s.id},'${escHtml(s.name)}')" title="Delete">${iconDelete()}</button>
      </div></td>`;
    tbody.appendChild(tr);
  });
}

function filterStudents() {
  const q = document.getElementById("student-search").value.toLowerCase();
  renderStudents(stuData.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.register_number.toLowerCase().includes(q) ||
    s.department.toLowerCase().includes(q)
  ));
}

// ════════════════════════════════════════════════════════════
//  CONFIRM DELETE
// ════════════════════════════════════════════════════════════

function confirmDelete(type, id, label) {
  document.getElementById("confirm-msg").textContent =
    `Delete "${label}"? This cannot be undone.`;
  const okBtn = document.getElementById("confirm-ok");
  const newBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newBtn, okBtn);
  newBtn.addEventListener("click", async () => { closeConfirm(); await deleteItem(type, id); });
  document.getElementById("confirm-modal").classList.add("open");
}
function closeConfirm() { document.getElementById("confirm-modal").classList.remove("open"); }

async function deleteItem(type, id) {
  const paths = {
    "day-order":    `/admin/day-orders/${id}`,
    "announcement": `/admin/announcements/${id}`,
    "student":      `/admin/students/${id}`,
  };
  const res = await apiFetch(paths[type], { method: "DELETE" });
  if (!res) return;
  if (res.ok) {
    if (type === "day-order")    { doLoaded=false;  loadDayOrders(); }
    if (type === "announcement") { annLoaded=false; loadAnnouncements(); }
    if (type === "student")      { stuLoaded=false; loadStudents(); }
  } else {
    const d = await res.json();
    alert("Delete failed: " + (d.error || "Unknown"));
  }
}

// ── SVG icon helpers ───────────────────────────────────────
function iconEdit() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}
function iconDelete() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
}

// ── Close modals on overlay click ──────────────────────────
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.remove("open");
  });
});

// ── Boot ───────────────────────────────────────────────────
loadDayOrders();
