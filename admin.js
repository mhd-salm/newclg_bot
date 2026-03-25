/* ════════════════════════════════════════════════════════════
   Campus AI — admin.js
   All admin panel logic: tabs, CRUD, modals.
════════════════════════════════════════════════════════════ */

const BASE_URL = "https://newclg-bot-backend.onrender.com";

// ── Auth guard ────────────────────────────────────────────
const token = localStorage.getItem("access_token");
const role  = localStorage.getItem("user_role");

if (!token || role !== "admin") {
  window.location.href = "login.html";
}

// Set admin name display
const payload = JSON.parse(atob(token.split(".")[1]));
document.getElementById("admin-name-display").textContent =
  payload.username || payload.sub || "Admin";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token,
  };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(BASE_URL + path, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });

  if (res.status === 401 || res.status === 403) {
    alert("Session expired or unauthorised. Please log in again.");
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

    // Lazy load on first visit
    if (tab === "day-orders"    && !doLoaded)     loadDayOrders();
    if (tab === "timetable"     && !ttLoaded)     loadTimetable();
    if (tab === "announcements" && !annLoaded)    loadAnnouncements();
    if (tab === "students"      && !stuLoaded)    loadStudents();

    closeSidebar();
  });
});

// ── Mobile sidebar ─────────────────────────────────────────
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
}

// ════════════════════════════════════════════════════════════
//  DAY ORDERS
// ════════════════════════════════════════════════════════════

let doLoaded  = false;
let doData    = [];

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

  if (doData.length === 0) {
    document.getElementById("do-empty").style.display = "";
    return;
  }

  document.getElementById("do-table").style.display = "";
  const tbody = document.getElementById("do-tbody");
  tbody.innerHTML = "";

  doData.forEach(item => {
    const weekday = new Date(item.date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short" });
    const isHoliday = item.day_order === 0;
    const pilCls    = isHoliday ? "do-pill holiday" : "do-pill";
    const label     = isHoliday ? "Holiday" : item.day_order;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><code style="font-family:var(--font-mono,monospace);font-size:13px">${item.date}</code></td>
      <td>${weekday}</td>
      <td><span class="${pilCls}">${label}</span></td>
      <td style="color:var(--tx-2)">${item.reason || "—"}</td>
      <td>
        <div class="actions-cell">
          <button class="btn-icon" title="Edit" onclick="editDayOrder(${item.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" title="Delete" onclick="confirmDelete('day-order', ${item.id}, '${item.date}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function openDOModal(prefillId = null) {
  const item = prefillId ? doData.find(d => d.id === prefillId) : null;

  document.getElementById("do-modal-title").textContent =
    item ? "Edit Day Order Override" : "Add Day Order Override";
  document.getElementById("do-date").value   = item ? item.date      : todayISO();
  document.getElementById("do-value").value  = item ? item.day_order : "0";
  document.getElementById("do-reason").value = item ? item.reason    : "";

  // Store editing id
  document.getElementById("do-date").dataset.editId = item ? item.id : "";

  document.getElementById("do-modal").classList.add("open");
}

function closeDOModal() { document.getElementById("do-modal").classList.remove("open"); }

function editDayOrder(id) { openDOModal(id); }

async function saveDayOrder() {
  const dateEl    = document.getElementById("do-date");
  const date      = dateEl.value;
  const day_order = parseInt(document.getElementById("do-value").value);
  const reason    = document.getElementById("do-reason").value.trim();

  if (!date) { alert("Please pick a date."); return; }

  const res = await apiFetch("/admin/day-orders", {
    method: "POST",
    body: JSON.stringify({ date, day_order, reason }),
  });

  if (!res) return;

  if (res.ok) {
    closeDOModal();
    doLoaded = false;
    loadDayOrders();
  } else {
    const d = await res.json();
    alert("Error: " + (d.error || "Unknown"));
  }
}

// ════════════════════════════════════════════════════════════
//  TIMETABLE
// ════════════════════════════════════════════════════════════

let ttLoaded = false;
let ttData   = [];

async function loadTimetable() {
  ttLoaded = true;
  document.getElementById("tt-loading").style.display = "";
  document.getElementById("tt-table").style.display   = "none";
  document.getElementById("tt-empty").style.display   = "none";

  const res = await apiFetch("/admin/timetable");
  if (!res) return;

  ttData = await res.json();
  renderTimetable();
}

function renderTimetable() {
  document.getElementById("tt-loading").style.display = "none";

  const year     = parseInt(document.getElementById("tt-filter-year").value);
  const dayOrder = parseInt(document.getElementById("tt-filter-do").value);

  const filtered = ttData.filter(e => e.year === year && e.day_order === dayOrder);
  filtered.sort((a, b) => a.period - b.period);

  if (filtered.length === 0) {
    document.getElementById("tt-table").style.display = "none";
    document.getElementById("tt-empty").style.display = "";
    return;
  }

  document.getElementById("tt-table").style.display = "";
  document.getElementById("tt-empty").style.display = "none";

  const tbody = document.getElementById("tt-tbody");
  tbody.innerHTML = "";

  filtered.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge badge-gray">Period ${item.period}</span></td>
      <td>${item.subject}</td>
      <td>
        <div class="actions-cell">
          <button class="btn-icon" title="Edit" onclick="editTimetableSlot(${item.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" title="Delete" onclick="confirmDelete('timetable', ${item.id}, 'Period ${item.period}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function openTTModal(prefillId = null) {
  const item = prefillId ? ttData.find(e => e.id === prefillId) : null;

  // Pre-fill from filter selects if no item
  document.getElementById("tt-year").value    = item ? item.year      : document.getElementById("tt-filter-year").value;
  document.getElementById("tt-do").value      = item ? item.day_order : document.getElementById("tt-filter-do").value;
  document.getElementById("tt-period").value  = item ? item.period    : "1";
  document.getElementById("tt-subject").value = item ? item.subject   : "";
  document.getElementById("tt-subject").dataset.editId = item ? item.id : "";

  document.getElementById("tt-modal").classList.add("open");
}

function closeTTModal() { document.getElementById("tt-modal").classList.remove("open"); }

function editTimetableSlot(id) { openTTModal(id); }

async function saveTimetableSlot() {
  const year      = parseInt(document.getElementById("tt-year").value);
  const day_order = parseInt(document.getElementById("tt-do").value);
  const period    = parseInt(document.getElementById("tt-period").value);
  const subject   = document.getElementById("tt-subject").value.trim();

  if (!subject) { alert("Subject cannot be empty."); return; }

  const res = await apiFetch("/admin/timetable", {
    method: "POST",
    body: JSON.stringify({ year, day_order, period, subject }),
  });

  if (!res) return;

  if (res.ok) {
    closeTTModal();
    ttLoaded = false;
    await loadTimetable();
    // Sync filter to what was just saved
    document.getElementById("tt-filter-year").value = year;
    document.getElementById("tt-filter-do").value   = day_order;
    renderTimetable();
  } else {
    const d = await res.json();
    alert("Error: " + (d.error || "Unknown"));
  }
}

// ════════════════════════════════════════════════════════════
//  ANNOUNCEMENTS
// ════════════════════════════════════════════════════════════

let annLoaded = false;
let annData   = [];

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

  if (annData.length === 0) {
    document.getElementById("ann-empty").style.display = "";
    return;
  }

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
        <button class="btn-icon" title="Edit" onclick="editAnnouncement(${item.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" title="Delete" onclick="confirmDelete('announcement', ${item.id}, '${escHtml(item.title)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>`;
    list.appendChild(div);
  });
}

function openAnnModal() {
  document.getElementById("ann-modal-title").textContent = "New Announcement";
  document.getElementById("ann-title").value  = "";
  document.getElementById("ann-body").value   = "";
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

  const res = await apiFetch(path, {
    method,
    body: JSON.stringify({ title, body, active }),
  });

  if (!res) return;

  if (res.ok) {
    closeAnnModal();
    annLoaded = false;
    loadAnnouncements();
  } else {
    const d = await res.json();
    alert("Error: " + (d.error || "Unknown"));
  }
}

// ════════════════════════════════════════════════════════════
//  STUDENTS
// ════════════════════════════════════════════════════════════

let stuLoaded = false;
let stuData   = [];

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
      <td>
        <div class="actions-cell">
          <button class="btn-icon danger" title="Delete student" onclick="confirmDelete('student', ${s.id}, '${escHtml(s.name)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function filterStudents() {
  const q = document.getElementById("student-search").value.toLowerCase();
  const filtered = stuData.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.register_number.toLowerCase().includes(q) ||
    s.department.toLowerCase().includes(q)
  );
  renderStudents(filtered);
}

// ════════════════════════════════════════════════════════════
//  CONFIRM DELETE MODAL
// ════════════════════════════════════════════════════════════

function confirmDelete(type, id, label) {
  document.getElementById("confirm-msg").textContent =
    `Are you sure you want to delete "${label}"? This cannot be undone.`;

  const okBtn = document.getElementById("confirm-ok");
  // Remove old listener
  const newBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newBtn, okBtn);

  newBtn.addEventListener("click", async () => {
    closeConfirm();
    await deleteItem(type, id);
  });

  document.getElementById("confirm-modal").classList.add("open");
}

function closeConfirm() {
  document.getElementById("confirm-modal").classList.remove("open");
}

async function deleteItem(type, id) {
  const paths = {
    "day-order":    `/admin/day-orders/${id}`,
    "timetable":    `/admin/timetable/${id}`,
    "announcement": `/admin/announcements/${id}`,
    "student":      `/admin/students/${id}`,
  };

  const res = await apiFetch(paths[type], { method: "DELETE" });
  if (!res) return;

  if (res.ok) {
    if (type === "day-order")    { doLoaded  = false; loadDayOrders();    }
    if (type === "timetable")    { ttLoaded  = false; await loadTimetable(); renderTimetable(); }
    if (type === "announcement") { annLoaded = false; loadAnnouncements(); }
    if (type === "student")      { stuLoaded = false; loadStudents();      }
  } else {
    const d = await res.json();
    alert("Delete failed: " + (d.error || "Unknown error"));
  }
}

// ════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Close modals on overlay click
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.remove("open");
  });
});

// ── Boot: load first tab ───────────────────────────────────
loadDayOrders();
