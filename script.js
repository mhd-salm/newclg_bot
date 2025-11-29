const BACKEND_URL = "http://127.0.0.1:4000/chat";
const STORAGE_KEY = "campusguide_chat";
const SESSION_KEY = "campusguide_session";

// ---------------------------
// TIMETABLE DATA (from PDF)
// ---------------------------
/*
const TIMETABLE = {
  I: {
    1: [
      "Allied",
      "English",
      "Python Theory (JM)",
      "Python Lab (JM, JAK)",
      "Language"
    ],
    2: [
      "Allied",
      "Python Theory (JM)",
      "Language",
      "Python Lab (JM, MMA)",
      "Soft Skills"
    ],
    3: [
      "Python Lab (JM, JAK)",
      "English",
      "Language",
      "Allied",
      "Free / No class"
    ],
    4: [
      "Python Lab (JM)",
      "Allied",
      "English",
      "Language",
      "Free / No class"
    ],
    5: [
      "English",
      "Language",
      "Python Theory (JM)",
      "EVS (JM)",
      "Allied"
    ],
    6: [
      "VBE",
      "English",
      "Python Theory (JM)",
      "Allied",
      "Python Theory (JM)"
    ]
  },
  II: {
    1: [
      "Language",
      "English",
      "Allied",
      "IAI Theory (MGR)",
      "Prolog Lab (MGR)"
    ],
    2: [
      "IAI Theory (MGR)",
      "Allied",
      "IAI Theory (MGR)",
      "English",
      "Language"
    ],
    3: [
      "Language",
      "Allied",
      "IAI Theory (MGR)",
      "Prolog Lab (MGR, JAK)",
      "English"
    ],
    4: [
      "Allied",
      "Language",
      "English",
      "Prolog Lab (MGR)",
      "Free / No class"
    ],
    5: [
      "English",
      "Prolog Lab (MGR, JAK)",
      "Allied",
      "Language",
      "Free / No class"
    ],
    6: [
      "IAI Theory (MGR)",
      "English",
      "NME (JAK)",
      "Language",
      "Allied"
    ]
  },
  III: {
    1: [
      "ML Lab (MMA, SHM)",
      "CC Theory (MGR)",
      "ML Theory (MMA)",
      "IS Theory (JAK)",
      "Free / No class"
    ],
    2: [
      "Mini Project (JAK, JM(1), MGR(2))",
      "ML Theory (MMA)",
      "CC Theory (MGR)",
      "IoT Theory (FMI)",
      "Free / No class"
    ],
    3: [
      "CC Theory (MMA)",
      "IS Theory (SHM)",
      "ML Lab (MMA, JM)",
      "ML Theory (MMA)",
      "IoT Theory (FMI)"
    ],
    4: [
      "CC Theory (MMA)",
      "IS Theory (SHM)",
      "Mini Project (MGR, JM)",
      "ML Theory (MMA)",
      "IoT Theory (JAK)"
    ],
    5: [
      "CC Theory (MMA)",
      "IS Theory (SHM)",
      "ML Theory (MMA)",
      "Mini Project (FMI, MMA)",
      "Free / No class"
    ],
    6: [
      "ML Lab (MMA, JM(1), SHM(2))",
      "IS Theory (MGR)",
      "IoT Theory (JAK)",
      "IoT Theory (FMI)",
      "Free / No class"
    ]
  }
};

const YEAR_LABELS = {
  I: "I B.Sc (AI)",
  II: "II B.Sc (AI)",
  III: "III B.Sc (AI)"
};
*/
// ---------------------------
// DOM ELEMENTS
// ---------------------------

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

// ---------------------------
// HELPER: YEAR DETECTION
// ---------------------------
function detectYear(lower) {
  // Clean: remove dots, spaces, parentheses
  const clean = lower.replace(/[\.\(\)]/g, "").replace(/\s+/g, "");

  if (
    /1styear/.test(clean) ||
    /firstyear/.test(clean) ||
    /\bi\b/.test(clean) ||
    /ibscai/.test(clean) ||
    /ibsc/.test(clean)
  ) return "I";

  if (
    /2ndyear/.test(clean) ||
    /secondyear/.test(clean) ||
    /\bii\b/.test(clean) ||
    /iibscai/.test(clean) ||
    /iibsc/.test(clean)
  ) return "II";

  if (
    /3rdyear/.test(clean) ||
    /thirdyear/.test(clean) ||
    /\biii\b/.test(clean) ||
    /iiibscai/.test(clean) ||
    /iiibsc/.test(clean)
  ) return "III";

  return null;
}


// ---------------------------
// HELPER: FORMAT TIMETABLE
// ---------------------------

function formatTimetable(yearKey, dayOrder) {
  const yearData = TIMETABLE[yearKey];
  if (!yearData) {
    return `I don't have timetable data for that year.`;
  }

  const slots = yearData[dayOrder];
  const label = YEAR_LABELS[yearKey] || yearKey;

  if (!slots) {
    return `No timetable stored for ${label}, Day Order ${dayOrder}.`;
  }

  const lines = [];
  lines.push(`${label} — Day Order ${dayOrder}:`);
  slots.forEach((subj, i) => {
    lines.push(`${i + 1}. ${subj}`);
  });
  return lines.join("\n");
}

// ---------------------------
// HELPER: DATE / DAY ORDER
// ---------------------------

function detectTargetDate(lower) {
  const now = new Date();
  const d = new Date();

  if (lower.includes("day after")) {
    d.setDate(now.getDate() + 2);
    return d;
  }

  if (lower.includes("tomorrow")) {
    d.setDate(now.getDate() + 1);
    return d;
  }

  const weekMap = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0
  };

  for (const name in weekMap) {
    if (lower.includes(name)) {
      const targetIndex = weekMap[name];
      while (d.getDay() !== targetIndex) {
        d.setDate(d.getDate() + 1);
      }
      return d;
    }
  }

  // default: today
  return d;
}

function getDayOrderFromDate(date) {
  const wd = date.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  if (wd === 0) return null;
  return wd; // Mon=1 -> Day Order I, ... Sat=6 -> Day Order VI
}

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

  // keywords that indicate they want timetable, not just day order number
  const timetableKeywords = ["timetable", "time table", "schedule", "class", "classes", "hour", "hours", "period"];

  const mentionsDayOrder =
    lower.includes("day order") ||
    lower.includes("tomorrow") ||
    lower.includes("day after") ||
    lower.includes("monday") ||
    lower.includes("tuesday") ||
    lower.includes("wednesday") ||
    lower.includes("thursday") ||
    lower.includes("friday") ||
    lower.includes("saturday") ||
    lower.includes("sunday");

  const wantsTimetable = timetableKeywords.some(k => lower.includes(k));

  // ----------------------------------------------------
  // LOCAL DAY ORDER + TIMETABLE ENGINE
  // ----------------------------------------------------
  if (mentionsDayOrder) {
    let reply = "";

    // check for explicit "day order N"
    const matchNum = lower.match(/day\s*order\s*(\d)/);
    let explicitOrder = null;
    if (matchNum) {
      const num = parseInt(matchNum[1], 10);
      if (num >= 1 && num <= 6) explicitOrder = num;
    }

    const targetDate = detectTargetDate(lower);
    let dayOrder = explicitOrder !== null ? explicitOrder : getDayOrderFromDate(targetDate);

    // If user only asked about timetable but didn't give day order or weekday,
    // default to today.
    if (wantsTimetable && !mentionsDayOrder && !explicitOrder) {
      dayOrder = getDayOrderFromDate(new Date());
    }

    if (wantsTimetable) {
      // timetable request: need year
      const yearKey = detectYear(lower);

      if (!yearKey) {
        reply =
          "For timetable, tell me the year too.\nExample: \"Day Order 3 timetable for 1st year\" or \"Monday schedule for II B.Sc AI\".\nWhich year do you mean: I, II, or III B.Sc (AI)?";
      } else if (!dayOrder) {
        reply = "There is no timetable for Sunday.";
      } else {
        reply = formatTimetable(yearKey, dayOrder);
      }
    } else {
      // only day order info
      if (!dayOrder) {
        reply = "It is Sunday. No day order.";
      } else {
        // if they asked tomorrow / weekday, phrase accordingly
        if (lower.includes("tomorrow")) {
          reply = `Tomorrow's day order is Day Order ${dayOrder}.`;
        } else if (lower.includes("day after")) {
          reply = `The day after tomorrow is Day Order ${dayOrder}.`;
        } else {
          reply = `The day order for that day is Day Order ${dayOrder}.`;
        }
      }
    }

    showTyping(false);
    messages.push({ sender: "bot", text: reply });
    persist();
    chatbox.appendChild(createMessageEl("bot", reply));
    chatbox.scrollTop = chatbox.scrollHeight;
    return; // do not call backend for these
  }

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
