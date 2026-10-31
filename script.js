const CIRC = 2 * Math.PI * 88;
const prog = document.getElementById('prog');
const timeEl = document.getElementById('time');
const labelEl = document.getElementById('label');
const stopBtn = document.getElementById('stopBtn');
const repeatBtn = document.getElementById('repeatBtn');
const logEl = document.getElementById('log');
const historyBox = document.getElementById('historyBox');
const historyList = document.getElementById('historyList');
const notifBanner = document.getElementById('notifBanner');

let endTime = null, totalMs = 0, ticker = null, currentType = '', currentCls = '';
let lastSession = JSON.parse(localStorage.getItem('millLast') || 'null');

let settings = JSON.parse(localStorage.getItem('millSettings') || 'null') || { hard: 60, soft: 30 };
function applySettingsUI(){
  document.getElementById('hardDur').textContent = settings.hard + ' دقيقة';
  document.getElementById('softDur').textContent = settings.soft + ' دقيقة';
}
applySettingsUI();

function openSettings(){
  document.getElementById('inputHard').value = settings.hard;
  document.getElementById('inputSoft').value = settings.soft;
  document.getElementById('settingsModal').classList.add('show');
}
function closeSettings(){ document.getElementById('settingsModal').classList.remove('show'); }
function saveSettings(){
  const h = parseInt(document.getElementById('inputHard').value, 10);
  const s = parseInt(document.getElementById('inputSoft').value, 10);
  if (!h || h < 1 || h > 600 || !s || s < 1 || s > 600) { alert('أدخل قيمة بين 1 و 600 دقيقة'); return; }
  settings = { hard: h, soft: s };
  localStorage.setItem('millSettings', JSON.stringify(settings));
  applySettingsUI(); closeSettings(); renderLog('✅ تم حفظ المدد الجديدة');
}

function updateNotifBanner(){
  if (!('Notification' in window)) { notifBanner.classList.add('hidden'); return; }
  if (Notification.permission === 'granted') notifBanner.classList.add('hidden');
  else notifBanner.classList.remove('hidden');
}
updateNotifBanner();

async function requestNotif(){
  if (!('Notification' in window)) { alert('متصفحك لا يدعم الإشعارات'); return; }
  const p = await Notification.requestPermission();
  updateNotifBanner();
  if (p === 'granted') renderLog('🔔 تم تفعيل الإشعارات');
  else renderLog('⚠️ الإشعارات مرفوضة — سيعمل التنبيه الصوتي فقط');
}

function showNotification(title, body){
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">⛏️</text></svg>',
      tag: 'mill-done',
      requireInteraction: true
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch(e) {}
}

const saved = JSON.parse(localStorage.getItem('millState') || 'null');
if (saved && saved.endTime > Date.now()) {
  endTime = saved.endTime; totalMs = saved.totalMs; currentType = saved.type; currentCls = saved.cls || 'hard';
  labelEl.textContent = currentType; prog.style.stroke = currentCls === 'hard' ? 'var(--gold)' : 'var(--gray)';
  stopBtn.classList.add('show'); runTicker();
} else if (saved) {
  localStorage.removeItem('millState');
}

function startHard(){ start(settings.hard, 'حجر قاسي', 'hard'); }
function startSoft(){ start(settings.soft, 'حجر طري', 'soft'); }

function start(minutes, type, cls) {
  stopTimer(true);
  totalMs = minutes * 60 * 1000;
  endTime = Date.now() + totalMs;
  currentType = type; currentCls = cls;
  labelEl.textContent = type;
  prog.style.stroke = cls === 'hard' ? 'var(--gold)' : 'var(--gray)';
  stopBtn.classList.add('show');
  repeatBtn.classList.remove('show');
  localStorage.setItem('millState', JSON.stringify({endTime, totalMs, type, cls}));
  localStorage.setItem('millLast', JSON.stringify({type, cls, minutes}));
  lastSession = {type, cls, minutes};
  runTicker();
}

function repeatLast(){
  if (lastSession) start(lastSession.minutes, lastSession.type, lastSession.cls);
}

function runTicker(){ clearInterval(ticker); tick(); ticker = setInterval(tick, 1000); }

function tick() {
  const left = endTime - Date.now();
  if (left <= 0) { finish(); return; }
  const s = Math.ceil(left / 1000);
  const m = Math.floor(s / 60), sec = s % 60;
  timeEl.textContent = `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  prog.style.strokeDashoffset = CIRC * (1 - left / totalMs);
}

function finish() {
  clearInterval(ticker);
  timeEl.textContent = '00:00';
  prog.style.strokeDashoffset = CIRC;
  timeEl.classList.add('blink');
  notify();
  showNotification('✅ انتهى الطحن', `${currentType} — جاهز للتفريغ`);
  addHistory(currentType, totalMs);
  localStorage.removeItem('millState');
  stopBtn.classList.remove('show');
  repeatBtn.classList.add('show');
  renderLog(`✅ انتهى طحن: ${currentType} — يمكنك التكرار`);
}

function stopTimer(silent = false) {
  clearInterval(ticker);
  endTime = null;
  timeEl.classList.remove('blink');
  timeEl.textContent = '00:00';
  prog.style.strokeDashoffset = 0;
  labelEl.textContent = 'اختر نوع الحجر';
  stopBtn.classList.remove('show');
  localStorage.removeItem('millState');
  if (!silent) { repeatBtn.classList.remove('show'); renderLog('⏹️ تم الإيقاف'); }
}

function notify() {
  if (navigator.vibrate) navigator.vibrate([500,200,500,200,500,200,500]);
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [0, 0.4, 0.8, 1.2].forEach(t => beep(ctx, now + t));
    setTimeout(() => { try{ [0,0.4,0.8].forEach(t => beep(ctx, ctx.currentTime + 2 + t)); }catch(e){} }, 3000);
  } catch(e) {}
}
function beep(ctx, t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = 880;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.6, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + 0.4);
}

function getHistory(){ return JSON.parse(localStorage.getItem('millHistory') || '[]'); }
function addHistory(type, ms){
  const h = getHistory();
  h.unshift({ type, minutes: Math.round(ms/60000), at: Date.now() });
  localStorage.setItem('millHistory', JSON.stringify(h.slice(0, 50)));
  if (historyBox.classList.contains('show')) renderHistory();
}
function renderHistory(){
  const h = getHistory();
  if (h.length === 0){ historyList.innerHTML = '<div style="opacity:.5;text-align:center;padding:10px;font-size:.85rem;">لا توجد دورات بعد</div>'; return; }
  historyList.innerHTML = h.map(it => {
    const isHard = it.type.includes('قاسي');
    const color = isHard ? 'var(--gold)' : 'var(--gray)';
    const d = new Date(it.at);
    const date = d.toLocaleDateString('ar-EG', {day:'2-digit', month:'2-digit'});
    const time = d.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
    return `<div class="history-item">
      <span style="color:${color};font-weight:700">${it.type}</span>
      <span class="meta">${it.minutes} د • ${date} ${time}</span>
    </div>`;
  }).join('');
}
function toggleHistory(){
  historyBox.classList.toggle('show');
  if (historyBox.classList.contains('show')) renderHistory();
}
function clearHistory(){
  if (confirm('مسح كل السجل؟')) { localStorage.removeItem('millHistory'); renderHistory(); }
}

function renderLog(txt){ logEl.textContent = txt; }

document.body.addEventListener('click', () => {
  if (!window._audioUnlocked) {
    try { new (window.AudioContext || window.webkitAudioContext)().resume(); } catch(e){}
    window._audioUnlocked = true;
  }
}, { once: true });

document.addEventListener('visibilitychange', () => { if (!document.hidden && endTime) tick(); });
