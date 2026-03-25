const BASE_URL = "https://newclg-bot-backend.onrender.com";

async function register() {
  const name = document.getElementById("name").value;
  const register_number = document.getElementById("register_number").value;
  const department = document.getElementById("department").value;
  const year = document.getElementById("year").value;
  const password = document.getElementById("password").value;

  const res = await fetch(BASE_URL + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name,
      register_number: register_number,
      department: department,
      year: year,
      password: password,
    }),
  });

  const data = await res.json();

  if (res.ok) {
    alert(data.message);
    window.location.href = "login.html";
  } else {
    alert(data.error);
  }
}

async function login() {
  const mode = document.querySelector('input[name="login_role"]:checked')
    ? document.querySelector('input[name="login_role"]:checked').value
    : "student";
  const password = document.getElementById("password").value;

  if (mode === "admin") {
    const username = document.getElementById("admin_username").value.trim();
    if (!username || !password) {
      alert("Username and password required");
      return;
    }
    const res = await fetch(BASE_URL + "/auth/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_role", "admin");
      localStorage.setItem("admin_username", data.username || username);
      window.location.href = "admin.html";
    } else {
      alert(data.error);
    }
    return;
  }

  const register_number = document.getElementById("register_number").value;
  if (!register_number || !password) {
    alert("Register number and password required");
    return;
  }

  const res = await fetch(BASE_URL + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      register_number: register_number,
      password: password,
    }),
  });

  const data = await res.json();

  if (res.ok) {
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("user_role", data.role || "student");
    localStorage.removeItem("admin_username");
    window.location.href = "index.html";
  } else {
    alert(data.error);
  }
}
