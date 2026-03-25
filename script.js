/* ════════════════════════════════════════════════════════════
   CAMPUS AI — script.js
   Pure JavaScript, no frameworks
════════════════════════════════════════════════════════════ */
// Redirect to login if no token
const token = localStorage.getItem("access_token");

if (!token) {
  window.location.href = "/login.html";
}
/* ──────────────────────────────────────
   § 1  CONFIG
────────────────────────────────────── */
const BACKEND_URL  = 'https://newclg-bot-backend.onrender.com/chat';
const KEY_MSGS     = 'campus_ai_msgs_v5';
const KEY_SESS     = 'campus_ai_sess_v5';
const KEY_THEME    = 'campus_ai_theme_v5';
const MAX_MSGS     = 100;            // messages kept in localStorage


/* ──────────────────────────────────────
   § 2  DOM REFERENCES
────────────────────────────────────── */
const $id = id => document.getElementById(id);

const splash    = $id('splash');
const chat      = $id('chat');         // <main>
const welcome   = $id('welcome');
const msgInput  = $id('msg');
const sendBtn   = $id('send-btn');
const micBtn    = $id('mic-btn');
const menuBtn   = $id('menu-btn');
const dropdown  = $id('dropdown');
const clickAway = $id('click-away');
const clearBtn  = $id('clear-btn');
const newChatBtn= $id('new-chat-btn');
const themeChk  = $id('theme-chk');
const themeMeta = $id('theme-color-meta');


/* ──────────────────────────────────────
   § 3  SPLASH  — fade out after load
────────────────────────────────────── */
window.addEventListener('load', () => {
  setTimeout(() => splash.classList.add('gone'), 1200);
});


/* ──────────────────────────────────────
   § 4  THEME
────────────────────────────────────── */
function applyTheme(light) {
  const val = light ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', val);
  themeChk.checked = light;
  themeMeta.content = light ? '#ffffff' : '#212121';
  localStorage.setItem(KEY_THEME, val);
}

// Boot: read saved preference (dark is default)
applyTheme(localStorage.getItem(KEY_THEME) === 'light');

themeChk.addEventListener('change', () => applyTheme(themeChk.checked));


/* ──────────────────────────────────────
   § 5  HAMBURGER / DROPDOWN
────────────────────────────────────── */
function openMenu() {
  dropdown.classList.add('open');
  menuBtn.classList.add('open');
  menuBtn.setAttribute('aria-expanded', 'true');
  dropdown.setAttribute('aria-hidden', 'false');
  clickAway.classList.add('on');
}

function closeMenu() {
  dropdown.classList.remove('open');
  menuBtn.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
  dropdown.setAttribute('aria-hidden', 'true');
  clickAway.classList.remove('on');
}

menuBtn.addEventListener('click', e => {
  e.stopPropagation();
  dropdown.classList.contains('open') ? closeMenu() : openMenu();
});

clickAway.addEventListener('click', closeMenu);

// Escape key closes menu
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMenu();
});


/* ──────────────────────────────────────
   § 6  SESSION  (unique ID per browser)
────────────────────────────────────── */
let sessionId = localStorage.getItem(KEY_SESS);
if (!sessionId) {
  sessionId = 'sess_' + Math.random().toString(36).slice(2, 11);
  localStorage.setItem(KEY_SESS, sessionId);
}

function newSession() {
  sessionId = 'sess_' + Math.random().toString(36).slice(2, 11);
  localStorage.setItem(KEY_SESS, sessionId);
}


/* ──────────────────────────────────────
   § 7  MESSAGES STATE
────────────────────────────────────── */
let messages = [];
try { messages = JSON.parse(localStorage.getItem(KEY_MSGS) || '[]'); } catch (_) {}

let lastFailed = null;    // for retry

function persist() {
  try {
    localStorage.setItem(KEY_MSGS, JSON.stringify(messages.slice(-MAX_MSGS)));
  } catch (_) {}
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Safe HTML escape
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ──────────────────────────────────────
   § 7b  MARKDOWN → HTML  (bot replies only)
   Handles: **bold**, *italic*, `code`,
   bullet lists (* / - / •), numbered lists,
   ### headings, blank-line paragraphs.
   XSS-safe: raw text is escaped first.
────────────────────────────────────── */
function parseMd(raw) {
  // 1. Escape HTML entities in the raw string so user-supplied
  //    text can never inject markup.
  let s = esc(raw);

  // 2. Normalise line endings
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Split into logical blocks separated by blank lines
  //    Each block is processed independently.
  const blocks = s.split(/\n{2,}/);

  const rendered = blocks.map(block => {
    const lines = block.split('\n').map(l => l.trimEnd());

    // ── Heading  (### text  /  ## text  /  # text) ──
    if (/^#{1,3}\s/.test(lines[0])) {
      return lines.map(line => {
        return line.replace(/^(#{1,3})\s+(.+)$/, (_, hashes, text) => {
          const level = Math.min(hashes.length + 2, 5); // h3-h5 range
          return `<h${level} class="md-heading">${inlineFormat(text)}</h${level}>`;
        });
      }).join('\n');
    }

    // ── Bullet list  (* / - / • at line start) ──
    if (/^[\*\-•]\s+/.test(lines[0])) {
      const items = lines
        .filter(l => /^[\*\-•]\s+/.test(l))
        .map(l => `<li>${inlineFormat(l.replace(/^[\*\-•]\s+/, ''))}</li>`);
      return `<ul class="md-list">${items.join('')}</ul>`;
    }

    // ── Numbered list  (1. / 1) at line start) ──
    if (/^\d+[.)]\s+/.test(lines[0])) {
      const items = lines
        .filter(l => /^\d+[.)]\s+/.test(l))
        .map(l => `<li>${inlineFormat(l.replace(/^\d+[.)]\s+/, ''))}</li>`);
      return `<ol class="md-list md-list-ol">${items.join('')}</ol>`;
    }

    // ── Default: paragraph ──
    const joined = lines.join('<br>');
    return `<p class="md-para">${inlineFormat(joined)}</p>`;
  });

  return rendered.join('');
}

// Inline formatting applied inside any block
function inlineFormat(s) {
  return s
    // **bold**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // *italic* or _italic_  (only when surrounded by non-space)
    .replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '<em>$1</em>')
    .replace(/_(?!\s)(.+?)(?<!\s)_/g, '<em>$1</em>')
    // `inline code`
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
}


/* ──────────────────────────────────────
   § 8  CHAT COLUMN  (lazy-created)
────────────────────────────────────── */
let chatCol = null;   // .chat-col div lives here

function getCol() {
  if (!chatCol) {
    chatCol = document.createElement('div');
    chatCol.className = 'chat-col';
    chat.appendChild(chatCol);
  }
  return chatCol;
}


/* ──────────────────────────────────────
   § 9  BUILD A MESSAGE ROW
────────────────────────────────────── */

// Fallback when logo image fails to load
const BOT_ICON = `
  <span class="bot-av-icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  </span>`.trim();

function buildRow(msg) {
  const wrap = document.createElement('div');
  wrap.className = `msg-wrap ${msg.sender}`;

  if (msg.sender === 'bot') {
    wrap.innerHTML = `
      <div class="bot-row">
        <div class="bot-av">
          <img src="clg_logo.png" alt=""
               onerror="this.parentElement.innerHTML='${BOT_ICON}'"
        </div>
        <div class="bubble">${esc(msg.text).replace(/\n/g,'<br>')}</div>
      </div>
      <span class="msg-time">${msg.time || ''}</span>`;
  } else {
    wrap.innerHTML = `
      <div class="bubble">${esc(msg.text).replace(/\n/g,'<br>')}</div>
      <span class="msg-time">${msg.time || ''}</span>`;
  }

  return wrap;
}


/* ──────────────────────────────────────
   § 10  FULL RENDER  (called on boot & clear)
────────────────────────────────────── */
function renderAll() {
  // Destroy old column
  if (chatCol) { chatCol.remove(); chatCol = null; }

  if (messages.length === 0) {
    welcome.style.display = '';          // show welcome
  } else {
    welcome.style.display = 'none';      // hide welcome
    const col = getCol();
    messages.forEach(m => col.appendChild(buildRow(m)));
  }

  scrollBottom();
}

function scrollBottom() {
  requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });
}


/* ──────────────────────────────────────
   § 11  TYPING INDICATOR
────────────────────────────────────── */
let typingNode = null;

function showTyping() {
  if (typingNode) return;
  typingNode = document.createElement('div');
  typingNode.className = 'msg-wrap bot';
  typingNode.innerHTML = `
    <div class="typing-wrap">
      <div class="bot-av">
        <img src="clg_logo.png" alt=""
             onerror="this.parentElement.innerHTML='${BOT_ICON}'"
      </div>
      <div class="typing-dots">
        <span class="td"></span><span class="td"></span><span class="td"></span>
      </div>
    </div>`;
  getCol().appendChild(typingNode);
  scrollBottom();
}

function hideTyping() {
  if (typingNode) { typingNode.remove(); typingNode = null; }
}


/* ──────────────────────────────────────
   § 12  SEND  (core function)
────────────────────────────────────── */
async function sendMessage(text) {
  text = text.trim();
  if (!text) return;

  // Hide welcome screen on first message
  welcome.style.display = 'none';

  // 1 ── Render user message immediately
  const uMsg = { sender: 'user', text, time: nowTime() };
  messages.push(uMsg);
  persist();
  getCol().appendChild(buildRow(uMsg));
  scrollBottom();

  // 2 ── Clear input, disable send
  msgInput.value = '';
  resizeTextarea();
  sendBtn.disabled = true;
  lastFailed = text;

  // 3 ── Show typing dots
  showTyping();

  // 4 ── Call backend
  try {
    const res = await fetch(BACKEND_URL, {
      method : 'POST',
      headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + localStorage.getItem("access_token")},
      body   : JSON.stringify({ message: text, sessionId })
    });

    if (res.status === 401) {
  alert("Session expired. Please login again.");
  localStorage.removeItem("access_token");
  window.location.href = "login.html";
  return;
}

if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data  = await res.json();
    const reply = (data.reply || data.answer || '⚠️ No reply received.').trim();

    // Success: save + render bot reply
    const bMsg = { sender: 'bot', text: reply, time: nowTime() };
    messages.push(bMsg);
    persist();
    hideTyping();
    getCol().appendChild(buildRow(bMsg));
    scrollBottom();

  } catch (err) {
    console.error('[Campus AI] Backend error:', err);
    hideTyping();

    // Error row with retry button
    const errWrap = document.createElement('div');
    errWrap.className = 'msg-wrap bot';
    errWrap.innerHTML = `
      <div class="bot-row">
        <div class="bot-av">
          <img src="clg_logo.png" alt=""
               onerror="this.parentElement.innerHTML='${BOT_ICON}'"
        </div>
        <div class="bubble err-bubble">
          <p class="err-text">⚠️ Couldn't reach Campus AI. Check your connection.</p>
          <button class="retry-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-4.36"/>
            </svg>
            Retry
          </button>
        </div>
      </div>`;
    getCol().appendChild(errWrap);
    scrollBottom();

    errWrap.querySelector('.retry-btn').addEventListener('click', () => {
      errWrap.remove();
      if (lastFailed) sendMessage(lastFailed);
    });

  } finally {
    // Re-enable send only if user has typed more text
    sendBtn.disabled = !msgInput.value.trim();
  }
}


/* ──────────────────────────────────────
   § 13  INPUT — auto-resize + events
────────────────────────────────────── */
function resizeTextarea() {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 160) + 'px';
}

// Re-size + toggle send button state on every keystroke
msgInput.addEventListener('input', () => {
  resizeTextarea();
  sendBtn.disabled = !msgInput.value.trim();
});

// Enter = send | Shift+Enter = newline
msgInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage(msgInput.value);
  }
});

sendBtn.addEventListener('click', () => {
  if (!sendBtn.disabled) sendMessage(msgInput.value);
});

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("access_token");
  window.location.href = "login.html";
});
/* ──────────────────────────────────────
   § 14  CLEAR / NEW CHAT
────────────────────────────────────── */
function clearChat() {
  messages = [];
  persist();
  if (chatCol) { chatCol.remove(); chatCol = null; }
  renderAll();
  newSession();
  closeMenu();
}

clearBtn.addEventListener('click',   clearChat);
newChatBtn.addEventListener('click', clearChat);


/* ──────────────────────────────────────
   § 15  SUGGESTION CHIPS  (event delegation)
────────────────────────────────────── */
document.addEventListener('click', e => {
  const chip = e.target.closest('[data-q]');
  if (!chip) return;
  const q = chip.dataset.q;
  msgInput.value = q;
  resizeTextarea();
  sendBtn.disabled = false;
  sendMessage(q);
});


/* ──────────────────────────────────────
   § 16  VOICE  (Web Speech API)
────────────────────────────────────── */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SR) {
  const rec = new SR();
  rec.lang            = 'en-IN';
  rec.interimResults  = false;
  rec.maxAlternatives = 1;

  micBtn.addEventListener('click', () => {
    try { rec.start(); micBtn.classList.add('on'); } catch (_) {}
  });

  rec.addEventListener('result', e => {
    const t = e.results[0][0].transcript;
    msgInput.value = t;
    resizeTextarea();
    sendBtn.disabled = false;
    sendMessage(t);
  });

  const stopMic = () => micBtn.classList.remove('on');
  rec.addEventListener('end',   stopMic);
  rec.addEventListener('error', stopMic);

} else {
  // Hide mic if unsupported
  micBtn.style.display = 'none';
}


/* ──────────────────────────────────────
   § 17  BOOT
────────────────────────────────────── */

// Seed a greeting if chat is brand-new
if (messages.length === 0) {
  messages.push({
    sender : 'bot',
    text   : '👋 Hello! I\'m Campus AI — your assistant for The New College, Chennai.\n\nAsk me about timetables, fee structures, departments, events, contacts, and more!',
    time   : nowTime()
  });
  persist();
}

renderAll();

