
const BACKEND_URL = "https://newclg-bot-backend.onrender.com/chat";
const STORAGE_KEY = "campusguide_chat";
const SESSION_KEY = "campusguide_session";

const openBtn = document.getElementById("cg-open-btn");
const widget = document.getElementById("cg-widget");   
const closeBtn = document.getElementById("cg-close-btn");
const chatbox = document.getElementById("cg-chatbox");
const sendBtn = document.getElementById("cg-send");
const inputEl = document.getElementById("cg-input");
const typingEl = document.getElementById("typing-indicator");
const clearBtn = document.getElementById("clear-chat");


let sessionId = localStorage.getItem(SESSION_KEY);
if (!sessionId) {
  sessionId = "sess_" + Math.random().toString(36).slice(2, 10);
  localStorage.setItem(SESSION_KEY, sessionId);
}


let messages = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
renderMessages();


openBtn.addEventListener("click", () => widget.classList.remove("hidden")); 
closeBtn && closeBtn.addEventListener("click", () => widget.classList.add("hidden")); 
sendBtn.addEventListener("click", onSend);
inputEl.addEventListener("keydown", e => { if (e.key === "Enter") onSend(); });
clearBtn && clearBtn.addEventListener("click", clearChat);

function renderMessages() {
  chatbox.innerHTML = "";
  messages.forEach(m => {
    const el = createMessageEl(m.sender, m.text);
    chatbox.appendChild(el);
  });
  chatbox.scrollTop = chatbox.scrollHeight;
}

function createMessageEl(sender, text) {
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatMessageHTML(raw) {
    const escaped = escapeHtml(raw);
    const lines = escaped.split(/\r?\n/);
    let html = "";
    let inList = false;

    lines.forEach((ln) => {
      if (/^\s*[-*]\s+/.test(ln)) {
        if (!inList) {
          html += "<ul>";
          inList = true;
        }
        html += "<li>" + ln.replace(/^\s*[-*]\s+/, "") + "</li>";
      } else if (ln.trim() === "") {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        html += "<br/>";
      } else {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        html += "<p>" + ln + "</p>";
      }
    });

    if (inList) html += "</ul>";
    return html;
  }

  const div = document.createElement("div");
  div.className = "msg " + (sender === "user" ? "user" : "bot");

  if (sender === "user") {
    const content = escapeHtml(text);
    div.innerHTML = `<strong>You:</strong> <span class="user-text">${content}</span>`;
  } else {
    const contentHTML = formatMessageHTML(text);
    div.innerHTML = `<div class="msg-head"><strong>Bot:</strong></div><div class="msg-body">${contentHTML}</div>`;
  }

  return div;
}

function showTyping(on = true) {
  if (on) typingEl.classList.remove("hidden");
  else typingEl.classList.add("hidden");
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

async function onSend() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = "";

  messages.push({ sender: "user", text });
  persist();

  chatbox.appendChild(createMessageEl("user", text));
  chatbox.scrollTop = chatbox.scrollHeight;

  showTyping(true);

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

function clearChat() {
  messages = [];
  persist();
  chatbox.innerHTML = "";

  sessionId = "sess_" + Math.random().toString(36).slice(2,10);
  localStorage.setItem(SESSION_KEY, sessionId);
}


if (!localStorage.getItem("cg_seen_before")) {
  widget.classList.remove("hidden");  
  localStorage.setItem("cg_seen_before", "1");
}

