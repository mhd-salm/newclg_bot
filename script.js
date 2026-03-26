/* ════════════════════════════════════════════════════════════
   CAMPUS AI — script.js
════════════════════════════════════════════════════════════ */

// Auth guard
const token = localStorage.getItem("access_token");
const role  = localStorage.getItem("user_role");
if (!token || role === "admin") {
  window.location.href = "/login.html";
}

/* ── Config ───────────────────────────────────────────────── */
const BACKEND_URL = 'https://newclg-bot-backend.onrender.com/chat';
const ANN_URL     = 'https://newclg-bot-backend.onrender.com/admin/announcements/active';
const KEY_MSGS    = 'campus_ai_msgs_v5';
const KEY_SESS    = 'campus_ai_sess_v5';
const KEY_THEME   = 'campus_ai_theme_v5';
const KEY_SEEN_ANN = 'campus_ai_seen_announcements';   // comma-separated IDs already dismissed
const MAX_MSGS    = 100;

/* ── DOM ──────────────────────────────────────────────────── */
const $id = id => document.getElementById(id);
const splash    = $id('splash');
const chat      = $id('chat');
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

/* ── Splash ───────────────────────────────────────────────── */
window.addEventListener('load', () => {
  setTimeout(() => splash.classList.add('gone'), 1200);
  loadAnnouncements();
});

/* ── Theme ────────────────────────────────────────────────── */
function applyTheme(light) {
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
  themeChk.checked  = light;
  themeMeta.content = light ? '#ffffff' : '#212121';
  localStorage.setItem(KEY_THEME, light ? 'light' : 'dark');
}
applyTheme(localStorage.getItem(KEY_THEME) === 'light');
themeChk.addEventListener('change', () => applyTheme(themeChk.checked));

/* ── Hamburger ────────────────────────────────────────────── */
function openMenu()  { dropdown.classList.add('open'); menuBtn.classList.add('open'); menuBtn.setAttribute('aria-expanded','true'); dropdown.setAttribute('aria-hidden','false'); clickAway.classList.add('on'); }
function closeMenu() { dropdown.classList.remove('open'); menuBtn.classList.remove('open'); menuBtn.setAttribute('aria-expanded','false'); dropdown.setAttribute('aria-hidden','true'); clickAway.classList.remove('on'); }
menuBtn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.contains('open') ? closeMenu() : openMenu(); });
clickAway.addEventListener('click', closeMenu);
document.addEventListener('keydown', e => { if (e.key==='Escape') closeMenu(); });

/* ── Session ──────────────────────────────────────────────── */
let sessionId = localStorage.getItem(KEY_SESS);
if (!sessionId) { sessionId = 'sess_' + Math.random().toString(36).slice(2,11); localStorage.setItem(KEY_SESS, sessionId); }
function newSession() { sessionId = 'sess_' + Math.random().toString(36).slice(2,11); localStorage.setItem(KEY_SESS, sessionId); }

/* ── Messages state ───────────────────────────────────────── */
let messages = [];
try { messages = JSON.parse(localStorage.getItem(KEY_MSGS) || '[]'); } catch(_) {}
let lastFailed = null;
function persist() { try { localStorage.setItem(KEY_MSGS, JSON.stringify(messages.slice(-MAX_MSGS))); } catch(_) {} }
function nowTime() { return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── Markdown parser (bot only) ───────────────────────────── */
function parseMd(raw) {
  let s = esc(raw).replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  return s.split(/\n{2,}/).map(block => {
    const lines = block.split('\n').map(l=>l.trimEnd());
    if (/^#{1,3}\s/.test(lines[0])) return lines.map(l=>l.replace(/^(#{1,3})\s+(.+)$/,(_,h,t)=>`<h${Math.min(h.length+2,5)} class="md-heading">${inlineFmt(t)}</h${Math.min(h.length+2,5)}>`)).join('\n');
    if (/^[\*\-•]\s+/.test(lines[0])) return `<ul class="md-list">${lines.filter(l=>/^[\*\-•]\s+/.test(l)).map(l=>`<li>${inlineFmt(l.replace(/^[\*\-•]\s+/,''))}</li>`).join('')}</ul>`;
    if (/^\d+[.)]\s+/.test(lines[0])) return `<ol class="md-list md-list-ol">${lines.filter(l=>/^\d+[.)]\s+/.test(l)).map(l=>`<li>${inlineFmt(l.replace(/^\d+[.)]\s+/,''))}</li>`).join('')}</ol>`;
    return `<p class="md-para">${inlineFmt(lines.join('<br>'))}</p>`;
  }).join('');
}
function inlineFmt(s) {
  return s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
           .replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g,'<em>$1</em>')
           .replace(/_(?!\s)(.+?)(?<!\s)_/g,'<em>$1</em>')
           .replace(/`([^`]+)`/g,'<code class="md-code">$1</code>');
}

/* ══════════════════════════════════════════════════════════
   ANNOUNCEMENTS  — shown as dismissible banners above chat
══════════════════════════════════════════════════════════ */

function _seenIds() {
  try { return new Set((localStorage.getItem(KEY_SEEN_ANN) || '').split(',').filter(Boolean)); }
  catch { return new Set(); }
}
function _markSeen(id) {
  const seen = _seenIds(); seen.add(String(id));
  localStorage.setItem(KEY_SEEN_ANN, [...seen].join(','));
}

async function loadAnnouncements() {
  try {
    const res = await fetch(ANN_URL, {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) return;
    const items = await res.json();
    const seen  = _seenIds();

    // Only show ones not yet dismissed in this browser
    const fresh = items.filter(a => !seen.has(String(a.id)));
    if (fresh.length === 0) return;

    // Inject banner container above chat if not already there
    let container = document.getElementById('ann-banners');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ann-banners';
      // insert between header and chat
      const app = document.getElementById('app') || document.body;
      const header = document.querySelector('.header');
      if (header && header.nextSibling) {
        app.insertBefore(container, header.nextSibling);
      } else {
        app.prepend(container);
      }
    }

    fresh.forEach(ann => {
      const div = document.createElement('div');
      div.className = 'ann-banner';
      div.dataset.id = ann.id;
      div.innerHTML = `
        <div class="ann-banner-inner">
          <span class="ann-banner-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </span>
          <div class="ann-banner-body">
            <strong>${esc(ann.title)}</strong>
            <span>${esc(ann.body)}</span>
          </div>
          <button class="ann-banner-close" onclick="dismissBanner(${ann.id})" title="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`;
      container.appendChild(div);
    });

    injectAnnStyles();
  } catch(e) {
    console.warn('Announcements fetch failed:', e);
  }
}

function dismissBanner(id) {
  _markSeen(id);
  const el = document.querySelector(`.ann-banner[data-id="${id}"]`);
  if (!el) return;
  el.style.animation = 'annSlideOut 0.25s ease forwards';
  setTimeout(() => {
    el.remove();
    const container = document.getElementById('ann-banners');
    if (container && !container.children.length) container.remove();
  }, 260);
}

function injectAnnStyles() {
  if (document.getElementById('ann-styles')) return;
  const style = document.createElement('style');
  style.id = 'ann-styles';
  style.textContent = `
    #ann-banners { display: flex; flex-direction: column; gap: 0; }

    .ann-banner {
      animation: annSlideIn 0.3s ease both;
      background: var(--bg-panel, #2f2f2f);
      border-bottom: 1px solid rgba(16,163,127,0.25);
      border-left: 3px solid var(--ac, #10a37f);
    }

    .ann-banner-inner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 11px 16px;
      max-width: 760px;
      margin: 0 auto;
      width: 100%;
    }

    .ann-banner-icon {
      color: var(--ac, #10a37f);
      flex-shrink: 0;
      margin-top: 2px;
      display: flex;
    }

    .ann-banner-body {
      flex: 1;
      font-size: 13px;
      line-height: 1.5;
      color: var(--tx, #ececec);
      min-width: 0;
    }

    .ann-banner-body strong {
      font-weight: 600;
      margin-right: 8px;
    }

    .ann-banner-body span {
      color: var(--tx-2, #b4b4b4);
      word-break: break-word;
    }

    .ann-banner-close {
      flex-shrink: 0;
      width: 26px; height: 26px;
      border-radius: 6px;
      display: grid; place-items: center;
      color: var(--tx-3, #8e8ea0);
      cursor: pointer;
      border: none; background: none;
      transition: background 0.14s, color 0.14s;
      margin-top: 1px;
    }
    .ann-banner-close:hover {
      background: rgba(255,255,255,0.08);
      color: var(--tx, #ececec);
    }

    @keyframes annSlideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes annSlideOut {
      from { opacity: 1; transform: translateY(0); max-height: 80px; }
      to   { opacity: 0; transform: translateY(-6px); max-height: 0; padding: 0; }
    }
  `;
  document.head.appendChild(style);
}

/* ── Chat column ──────────────────────────────────────────── */
let chatCol = null;
function getCol() {
  if (!chatCol) { chatCol = document.createElement('div'); chatCol.className='chat-col'; chat.appendChild(chatCol); }
  return chatCol;
}

/* ── Bot icon ─────────────────────────────────────────────── */
const BOT_ICON = `<span class="bot-av-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>`.trim();

/* ── Build message row ────────────────────────────────────── */
function buildRow(msg) {
  const wrap = document.createElement('div');
  wrap.className = `msg-wrap ${msg.sender}`;
  if (msg.sender === 'bot') {
    wrap.innerHTML = `
      <div class="bot-row">
        <div class="bot-av"><img src="clg_logo.png" alt="" onerror="this.parentElement.innerHTML='${BOT_ICON}'" /></div>
        <div class="bubble">${parseMd(msg.text)}</div>
      </div>
      <span class="msg-time">${msg.time||''}</span>`;
  } else {
    wrap.innerHTML = `
      <div class="bubble">${esc(msg.text).replace(/\n/g,'<br>')}</div>
      <span class="msg-time">${msg.time||''}</span>`;
  }
  return wrap;
}

/* ── Render all ───────────────────────────────────────────── */
function renderAll() {
  if (chatCol) { chatCol.remove(); chatCol = null; }
  if (messages.length === 0) { welcome.style.display = ''; }
  else {
    welcome.style.display = 'none';
    const col = getCol();
    messages.forEach(m => col.appendChild(buildRow(m)));
  }
  scrollBottom();
}
function scrollBottom() { requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; }); }

/* ── Typing indicator ─────────────────────────────────────── */
let typingNode = null;
function showTyping() {
  if (typingNode) return;
  typingNode = document.createElement('div');
  typingNode.className = 'msg-wrap bot';
  typingNode.innerHTML = `
    <div class="typing-wrap">
      <div class="bot-av"><img src="clg_logo.png" alt="" onerror="this.parentElement.innerHTML='${BOT_ICON}'" /></div>
      <div class="typing-dots"><span class="td"></span><span class="td"></span><span class="td"></span></div>
    </div>`;
  getCol().appendChild(typingNode);
  scrollBottom();
}
function hideTyping() { if (typingNode) { typingNode.remove(); typingNode = null; } }

/* ── Send ─────────────────────────────────────────────────── */
async function sendMessage(text) {
  text = text.trim();
  if (!text) return;
  welcome.style.display = 'none';
  const uMsg = { sender:'user', text, time:nowTime() };
  messages.push(uMsg); persist();
  getCol().appendChild(buildRow(uMsg)); scrollBottom();
  msgInput.value = ''; resizeTextarea();
  sendBtn.disabled = true; lastFailed = text;
  showTyping();

  try {
    const res = await fetch(BACKEND_URL, {
      method:'POST',
      headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+token },
      body: JSON.stringify({ message:text, sessionId })
    });
    if (res.status===401) { alert("Session expired. Please login again."); localStorage.removeItem("access_token"); window.location.href="login.html"; return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data  = await res.json();
    const reply = (data.reply || data.answer || '⚠️ No reply received.').trim();
    const bMsg  = { sender:'bot', text:reply, time:nowTime() };
    messages.push(bMsg); persist();
    hideTyping();
    getCol().appendChild(buildRow(bMsg)); scrollBottom();
  } catch(err) {
    console.error('[Campus AI] Backend error:', err);
    hideTyping();
    const errWrap = document.createElement('div');
    errWrap.className = 'msg-wrap bot';
    errWrap.innerHTML = `
      <div class="bot-row">
        <div class="bot-av"><img src="clg_logo.png" alt="" onerror="this.parentElement.innerHTML='${BOT_ICON}'" /></div>
        <div class="bubble err-bubble">
          <p class="err-text">⚠️ Couldn't reach Campus AI. Check your connection.</p>
          <button class="retry-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.36"/></svg> Retry</button>
        </div>
      </div>`;
    getCol().appendChild(errWrap); scrollBottom();
    errWrap.querySelector('.retry-btn').addEventListener('click', () => { errWrap.remove(); if (lastFailed) sendMessage(lastFailed); });
  } finally {
    sendBtn.disabled = !msgInput.value.trim();
  }
}

/* ── Textarea ─────────────────────────────────────────────── */
function resizeTextarea() { msgInput.style.height='auto'; msgInput.style.height=Math.min(msgInput.scrollHeight,160)+'px'; }
msgInput.addEventListener('input', () => { resizeTextarea(); sendBtn.disabled=!msgInput.value.trim(); });
msgInput.addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); if(!sendBtn.disabled) sendMessage(msgInput.value); } });
sendBtn.addEventListener('click', () => { if(!sendBtn.disabled) sendMessage(msgInput.value); });

/* ── Logout ───────────────────────────────────────────────── */
document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("access_token");
  window.location.href = "login.html";
});

/* ── Clear / new chat ─────────────────────────────────────── */
function clearChat() { messages=[]; persist(); if(chatCol){chatCol.remove();chatCol=null;} renderAll(); newSession(); closeMenu(); }
clearBtn.addEventListener('click', clearChat);
newChatBtn.addEventListener('click', clearChat);

/* ── Suggestion chips ─────────────────────────────────────── */
document.addEventListener('click', e => {
  const chip = e.target.closest('[data-q]');
  if (!chip) return;
  msgInput.value = chip.dataset.q; resizeTextarea();
  sendBtn.disabled = false; sendMessage(chip.dataset.q);
});

/* ── Voice ────────────────────────────────────────────────── */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const rec = new SR(); rec.lang='en-IN'; rec.interimResults=false; rec.maxAlternatives=1;
  micBtn.addEventListener('click', () => { try { rec.start(); micBtn.classList.add('on'); } catch(_) {} });
  rec.addEventListener('result', e => { const t=e.results[0][0].transcript; msgInput.value=t; resizeTextarea(); sendBtn.disabled=false; sendMessage(t); });
  const stopMic = () => micBtn.classList.remove('on');
  rec.addEventListener('end', stopMic); rec.addEventListener('error', stopMic);
} else { micBtn.style.display='none'; }

/* ── Boot ─────────────────────────────────────────────────── */
if (messages.length === 0) {
  messages.push({ sender:'bot', text:'👋 Hello! I\'m Campus AI — your assistant for The New College, Chennai.\n\nAsk me about timetables, fee structures, departments, events, contacts, and more!', time:nowTime() });
  persist();
}
renderAll();
