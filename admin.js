const BASE_URL = "https://newclg-bot-backend.onrender.com";

function token() {
  return localStorage.getItem("access_token");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token(),
  };
}

if (localStorage.getItem("user_role") !== "admin" || !token()) {
  window.location.href = "login.html";
}

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_role");
  localStorage.removeItem("admin_username");
  window.location.href = "login.html";
});

/* ── Panels ── */
const nav = document.getElementById("admin-nav");
nav.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-panel]");
  if (!btn) return;
  const id = btn.dataset.panel;
  nav.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("active", p.id === "panel-" + id);
  });
  if (id === "dash") loadStats();
  if (id === "students") loadStudents();
  if (id === "semesters") loadSemesters();
});

async function loadStats() {
  const el = document.getElementById("stats-grid");
  const err = document.getElementById("stats-err");
  err.textContent = "";
  el.innerHTML = "Loading…";
  try {
    const res = await fetch(BASE_URL + "/admin/stats", { headers: authHeaders() });
    if (res.status === 401) {
      window.location.href = "login.html";
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.status);
    el.innerHTML = [
      ["Students", data.students],
      ["Calendar rows", data.calendar_days],
      ["Semesters", data.semesters],
      ["Timetable chars", data.timetable_chars],
    ]
      .map(
        ([k, v]) =>
          `<div class="stat-card"><strong>${k}</strong><div style="font-size:1.4rem">${v}</div></div>`
      )
      .join("");
  } catch (e) {
    el.innerHTML = "";
    err.textContent = e.message || String(e);
  }
}

async function loadStudents() {
  const q = document.getElementById("student-q").value.trim();
  const url = BASE_URL + "/admin/students" + (q ? "?q=" + encodeURIComponent(q) : "");
  const tbody = document.querySelector("#students-table tbody");
  tbody.innerHTML = "<tr><td colspan='7'>Loading…</td></tr>";
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401) {
    window.location.href = "login.html";
    return;
  }
  const rows = await res.json();
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan='7'>${rows.error || res.status}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (s) => `<tr>
    <td>${s.id}</td>
    <td>${escapeHtml(s.register_number)}</td>
    <td>${escapeHtml(s.name)}</td>
    <td>${escapeHtml(s.department)}</td>
    <td>${s.year}</td>
    <td>${s.is_active ? "yes" : "no"}</td>
    <td class="row-actions">
      <button type="button" data-act="toggle" data-id="${s.id}" data-active="${s.is_active}">${s.is_active ? "Disable" : "Enable"}</button>
      <button type="button" data-act="del" data-id="${s.id}">Delete</button>
      <button type="button" data-act="pw" data-id="${s.id}">Reset PW</button>
    </td>
  </tr>`
    )
    .join("");

  tbody.onclick = async (ev) => {
    const b = ev.target.closest("button[data-act]");
    if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.act === "toggle") {
      const active = b.dataset.active === "true";
      await fetch(BASE_URL + "/admin/students/" + id, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ is_active: !active }),
      });
      loadStudents();
    }
    if (b.dataset.act === "del") {
      if (!confirm("Delete student " + id + "?")) return;
      await fetch(BASE_URL + "/admin/students/" + id, { method: "DELETE", headers: authHeaders() });
      loadStudents();
    }
    if (b.dataset.act === "pw") {
      const pw = prompt("New password (min 6 chars):");
      if (!pw || pw.length < 6) return;
      const r = await fetch(BASE_URL + "/admin/students/" + id + "/reset-password", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ password: pw }),
      });
      const j = await r.json();
      alert(r.ok ? "Password updated" : j.error || r.status);
    }
  };
}

document.getElementById("student-search-btn").addEventListener("click", loadStudents);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadSemesters() {
  const tbody = document.querySelector("#semesters-table tbody");
  tbody.innerHTML = "<tr><td colspan='6'>Loading…</td></tr>";
  const res = await fetch(BASE_URL + "/admin/semesters", { headers: authHeaders() });
  if (res.status === 401) {
    window.location.href = "login.html";
    return;
  }
  const rows = await res.json();
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan='6'>${rows.error}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (r) => `<tr>
    <td>${r.id}</td>
    <td>${escapeHtml(r.name)}</td>
    <td>${r.start_date}</td>
    <td>${r.start_day_order}</td>
    <td>${r.total_day_orders}</td>
    <td><button type="button" data-del-sem="${r.id}">Delete</button></td>
  </tr>`
    )
    .join("");
  tbody.onclick = async (ev) => {
    const b = ev.target.closest("button[data-del-sem]");
    if (!b) return;
    if (!confirm("Delete semester?")) return;
    await fetch(BASE_URL + "/admin/semesters/" + b.dataset.delSem, {
      method: "DELETE",
      headers: authHeaders(),
    });
    loadSemesters();
  };
}

document.getElementById("semester-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const res = await fetch(BASE_URL + "/admin/semesters", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      name: f.name.value,
      start_date: f.start_date.value,
      start_day_order: parseInt(f.start_day_order.value, 10),
      total_day_orders: parseInt(f.total_day_orders.value, 10) || 6,
    }),
  });
  const j = await res.json();
  if (!res.ok) {
    alert(j.error || res.status);
    return;
  }
  f.reset();
  loadSemesters();
});

/* Calendar */
function setDefaultCalRange() {
  const t = new Date();
  const from = new Date(t);
  from.setDate(from.getDate() - 7);
  document.getElementById("cal-from").value = from.toISOString().slice(0, 10);
  document.getElementById("cal-to").value = t.toISOString().slice(0, 10);
}
setDefaultCalRange();

document.getElementById("cal-load").addEventListener("click", async () => {
  const from = document.getElementById("cal-from").value;
  const to = document.getElementById("cal-to").value;
  const tbody = document.querySelector("#calendar-table tbody");
  tbody.innerHTML = "<tr><td colspan='5'>Loading…</td></tr>";
  const res = await fetch(
    BASE_URL + "/admin/calendar?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to),
    { headers: authHeaders() }
  );
  if (res.status === 401) {
    window.location.href = "login.html";
    return;
  }
  const rows = await res.json();
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan='5'>${rows.error}</td></tr>`;
    return;
  }
  if (!rows.length) {
    tbody.innerHTML = "<tr><td colspan='5'>No overrides in this range.</td></tr>";
    return;
  }
  tbody.innerHTML = rows
    .map(
      (r) => `<tr>
    <td>${r.entry_date}</td>
    <td>${r.is_holiday ? "yes" : ""}</td>
    <td>${r.day_order ?? ""}</td>
    <td>${escapeHtml(r.note || "")}</td>
    <td><button type="button" data-cal-del="${r.entry_date}">Remove override</button></td>
  </tr>`
    )
    .join("");
  tbody.onclick = async (ev) => {
    const b = ev.target.closest("button[data-cal-del]");
    if (!b) return;
    await fetch(BASE_URL + "/admin/calendar/" + b.dataset.calDel, {
      method: "DELETE",
      headers: authHeaders(),
    });
    document.getElementById("cal-load").click();
  };
});

document.getElementById("cal-one-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const entry_date = f.entry_date.value;
  const is_holiday = f.is_holiday.checked;
  const day_order = f.day_order.value ? parseInt(f.day_order.value, 10) : null;
  const note = f.note.value || null;
  const res = await fetch(BASE_URL + "/admin/calendar/" + entry_date, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ is_holiday, day_order, note }),
  });
  const j = await res.json();
  if (!res.ok) {
    alert(j.error || res.status);
    return;
  }
  alert("Saved");
  document.getElementById("cal-load").click();
});

/* Timetable */
document.getElementById("tt-load").addEventListener("click", async () => {
  document.getElementById("tt-msg").textContent = "";
  const res = await fetch(BASE_URL + "/admin/timetable", { headers: authHeaders() });
  const j = await res.json();
  if (!res.ok) {
    document.getElementById("tt-msg").textContent = j.error || res.status;
    return;
  }
  document.getElementById("tt-body").value = j.body || "";
});

document.getElementById("tt-save").addEventListener("click", async () => {
  document.getElementById("tt-msg").textContent = "";
  const body = document.getElementById("tt-body").value;
  const res = await fetch(BASE_URL + "/admin/timetable", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ body }),
  });
  const j = await res.json();
  document.getElementById("tt-msg").textContent = res.ok
    ? "Saved at " + (j.updated_at || "OK")
    : j.error || res.status;
});

/* boot */
loadStats();
