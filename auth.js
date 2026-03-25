const BASE_URL = "https://newclg-bot-backend.onrender.com"; // change later to Render URL

// ============================
// REGISTER
// ============================
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
      password: password
    })
  });

  const data = await res.json();

  if (res.ok) {
    alert(data.message);
    window.location.href = "login.html";
  } else {
    alert(data.error);
  }
}


// ============================
// LOGIN
// ============================
async function login() {
  const register_number = document.getElementById("register_number").value;
  const password = document.getElementById("password").value;

  const res = await fetch(BASE_URL + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      register_number: register_number,
      password: password
    })
  });

  const data = await res.json();

  if (res.ok) {
    // backend returns access_token (NOT token)
    localStorage.setItem("access_token", data.access_token);
    window.location.href = "index.html";
  } else {
    alert(data.error);
  }
}