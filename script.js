const BACKEND_URL = "https://newclg-bot-backend.onrender.com/chat";
const STORAGE_KEY = "campusguide_chat";
const SESSION_KEY = "campusguide_session";

// Timetable and day-order data removed per request.

// ---------------------------
// DOM ELEMENTS
// -------------------

const openBtn = document.getElementById("cg-open-btn");
const widget = document.getElementById("cg-widget");
const closeBtn = document.getElementById("cg-close-btn");
const chatbox = document.getElementById("cg-chatbox");
const sendBtn = document.getElementById("cg-send");
const inputEl = document.getElementById("cg-input");
const typingEl = document.getElementById("typing-indicator");
const clearBtn = document.getElementById("clear-chat");

// ---------------------------
// SESSION / STORAGE
// ---------------------------

let sessionId = localStorage.getItem(SESSION_KEY);
if (!sessionId) {
  sessionId = "sess_" + Math.random().toString(36).slice(2, 10);
  localStorage.setItem(SESSION_KEY, sessionId);
}

let messages = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
renderMessages();

// ---------------------------
// EVENT LISTENERS
// ---------------------------

openBtn.addEventListener("click", () => widget.classList.remove("hidden"));
closeBtn && closeBtn.addEventListener("click", () => widget.classList.add("hidden"));
sendBtn.addEventListener("click", onSend);
inputEl.addEventListener("keydown", e => { if (e.key === "Enter") onSend(); });
clearBtn && clearBtn.addEventListener("click", clearChat);

// ---------------------------
// RENDERING
// ---------------------------

function renderMessages() {
  chatbox.innerHTML = "";
  messages.forEach(m => {
    const el = createMessageEl(m.sender, m.text);
    chatbox.appendChild(el);
  });
  chatbox.scrollTop = chatbox.scrollHeight;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createMessageEl(sender, text) {
  const div = document.createElement("div");
  div.className = "msg " + (sender === "user" ? "user" : "bot");
  const prefix = sender === "user" ? "You: " : "Bot: ";
  const safe = escapeHtml(text).replace(/\n/g, "<br>");
  div.innerHTML = prefix + safe;
  return div;
}

function showTyping(on = true) {
  if (on) typingEl.classList.remove("hidden");
  else typingEl.classList.add("hidden");
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

// Year / timetable helpers removed.

// ---------------------------
// MAIN SEND HANDLER
// ---------------------------

async function onSend() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = "";

  messages.push({ sender: "user", text });
  persist();

  chatbox.appendChild(createMessageEl("user", text));
  chatbox.scrollTop = chatbox.scrollHeight;

  showTyping(true);

  const lower = text.toLowerCase();

  // ----------------------------------------------------
  // NORMAL BACKEND CALL (everything else)
  // ----------------------------------------------------
  try {
    const r = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, sessionId })
    });

    const data = await r.json();
    const reply = data.reply || "⚠ No reply from server.";

    messages.push({ sender: "bot", text: reply });
    persist();

    showTyping(false);
    chatbox.appendChild(createMessageEl("bot", reply));
    chatbox.scrollTop = chatbox.scrollHeight;
  } catch (err) {
    showTyping(false);
    const errText = "❌ Cannot connect to backend.";
    messages.push({ sender: "bot", text: errText });
    persist();
    chatbox.appendChild(createMessageEl("bot", errText));
    chatbox.scrollTop = chatbox.scrollHeight;
  }
}

// ---------------------------
// CLEAR CHAT
// ---------------------------

function clearChat() {
  messages = [];
  persist();
  chatbox.innerHTML = "";

  sessionId = "sess_" + Math.random().toString(36).slice(2, 10);
  localStorage.setItem(SESSION_KEY, sessionId);
}

// ---------------------------
// AUTO-OPEN FIRST TIME
// ---------------------------

if (!localStorage.getItem("cg_seen_before")) {
  widget.classList.remove("hidden");
  localStorage.setItem("cg_seen_before", "1");
}





