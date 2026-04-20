// ── STATE ──────────────────────────────────────────────────
'use strict';

let state = {
  materias: ['Português', 'Matemática', 'Direito Constitucional', 'Administrativo', 'Raciocínio Lógico'],
  entries: []
};

function loadState() {
  try {
    const saved = localStorage.getItem('concurso_tracker_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate basic structure before using
      if (parsed && Array.isArray(parsed.materias) && Array.isArray(parsed.entries)) {
        state = parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load state from localStorage:', e);
  }
}

function saveState() {
  try {
    localStorage.setItem('concurso_tracker_v2', JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state to localStorage:', e);
  }
}

// ── CALENDAR CONSTANTS ────────────────────────────────────
const MIN_MINUTES = 20;

function getDayHoursMap(entries) {
  const source = entries || state.entries;
  const map = {};
  source.forEach(e => {
    map[e.data] = (map[e.data] || 0) + e.horas;
  });
  return map;
}

// ── HELPER FUNCTIONS ──────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function secsToHMS(s) {
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`;
}
const CIRCUMFERENCE = 628;

function $(id) { return document.getElementById(id); }

// ── DOM SAFE HELPERS ──────────────────────────────────────
function createEl(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}

// ── SANITIZE INPUT ────────────────────────────────────────
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str.trim();
}

function sanitizePositiveNumber(val) {
  const n = parseFloat(val);
  return isNaN(n) || n < 0 ? 0 : n;
}

function sanitizePositiveInt(val) {
  const n = parseInt(val, 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

// ── ACTIVE PLAN ──────────────────────────────────────────
let activePlanId = null;

function loadActivePlan() {
  try {
    const saved = localStorage.getItem('concurso_activePlan');
    if (saved) activePlanId = JSON.parse(saved);
  } catch (e) { activePlanId = null; }
}

function saveActivePlan() {
  try { localStorage.setItem('concurso_activePlan', JSON.stringify(activePlanId)); }
  catch (e) { }
}

function getActivePlan() {
  if (!activePlanId) return null;
  return planos.find(p => p.id === activePlanId) || null;
}

function getFilteredEntries() {
  if (!activePlanId) return state.entries;
  return state.entries.filter(e => e.planId === activePlanId);
}

function getActiveDisciplinas() {
  const plan = getActivePlan();
  return plan ? (plan.disciplinas || []) : state.materias;
}

function renderPlanSelector() {
  const sel = $('activePlanSelect');
  const cur = activePlanId;
  sel.innerHTML = '';
  const allOpt = createEl('option', null, 'Todos os planos');
  allOpt.value = '';
  sel.appendChild(allOpt);
  planos.forEach(p => {
    const opt = createEl('option', null, p.nome);
    opt.value = String(p.id);
    sel.appendChild(opt);
  });
  if (cur) sel.value = String(cur);
}

function onPlanChange() {
  const val = $('activePlanSelect').value;
  activePlanId = val ? Number(val) : null;
  saveActivePlan();
  renderMaterias();
  renderHistory();
  updateStats();
}

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  try {
    loadState();
    loadPlanos();
    loadActivePlan();

    const today = new Date();
    $('inputData').value = today.toISOString().split('T')[0];
    $('headerDate').innerHTML =
      `${today.toLocaleDateString('pt-BR', { weekday: 'long' })}<br>${today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`;

    renderPlanSelector();
    renderMaterias();
    renderHistory();
    updateStats();
    initEventListeners();
  } catch (e) {
    console.error('Erro na inicialização:', e);
  }
});

// ── MATÉRIAS ──────────────────────────────────────────────
function renderMaterias() {
  const select = $('inputMateria');
  const disciplinas = getActiveDisciplinas();

  select.innerHTML = '';
  const defaultOpt = createEl('option', null, 'Selecione uma matéria...');
  defaultOpt.value = '';
  select.appendChild(defaultOpt);

  disciplinas.forEach(m => {
    const opt = createEl('option', null, m);
    opt.value = m;
    select.appendChild(opt);
  });

  syncTimerMaterias();
}

function adicionarMateria() {
  const input = $('inputNovaMateria');
  const val = sanitizeText(input.value);
  if (!val) return;
  if (state.materias.includes(val)) { input.value = ''; return; }
  state.materias.push(val);
  saveState();
  renderMaterias();
  $('inputMateria').value = val;
  input.value = '';
}

function removerMateria(m) {
  state.materias = state.materias.filter(x => x !== m);
  saveState();
  renderMaterias();
}

// ── REGISTRAR ─────────────────────────────────────────────
function registrar() {
  const data = $('inputData').value;
  const materia = sanitizeText($('inputMateria').value);
  const assunto = sanitizeText($('inputAssunto').value);
  const hh = sanitizePositiveInt($('inputHH').value);
  const mm = sanitizePositiveInt($('inputMM').value);
  const ss = sanitizePositiveInt($('inputSS').value);
  const horas = hh + mm / 60 + ss / 3600;
  const questoes = sanitizePositiveInt($('inputQuestoes').value);
  const acertos = sanitizePositiveInt($('inputAcertos').value);
  const erros = sanitizePositiveInt($('inputErros').value);

  if (!data) return alert('Selecione uma data!');
  if (!materia) return alert('Selecione uma matéria!');
  if (horas <= 0 && questoes <= 0) return alert('Informe tempo ou questões!');
  if (acertos + erros > questoes && questoes > 0) return alert('Acertos + Erros não podem ser maiores que o total de questões!');

  state.entries.unshift({ id: Date.now(), data, materia, assunto, horas, questoes, acertos, erros, planId: activePlanId || null });
  saveState();
  renderHistory();
  updateStats();

  $('inputHH').value = 0;
  $('inputMM').value = 0;
  $('inputSS').value = 0;
  $('inputQuestoes').value = '';
  $('inputAcertos').value = '';
  $('inputErros').value = '';
  $('inputMateria').value = '';
  $('inputAssunto').value = '';

  fecharDrawer();
  showToast();
}

function deletar(id) {
  state.entries = state.entries.filter(e => e.id !== id);
  saveState();
  renderHistory();
  updateStats();
}

// ── ACCENT COLORS (pastel cycle for entries) ──────────────
const ENTRY_COLORS = ['#93c5fd', '#86efac', '#fde68a', '#fca5a5', '#c4b5fd', '#67e8f9'];

function formatHorasMinutos(h) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs > 0 && mins > 0) return hrs + 'h' + pad(mins) + 'min';
  if (hrs > 0) return hrs + 'h';
  return mins + 'min';
}

// ── RENDER HISTORY (DOM API — safe from XSS) ──────────────
function renderHistory() {
  const panel = $('historyPanel');

  const filtered = getFilteredEntries();

  if (filtered.length === 0) {
    panel.innerHTML = '';
    const empty = createEl('div', 'empty-state');
    empty.appendChild(createEl('div', 'empty-icon', '📚'));
    const text = createEl('div', 'empty-text');
    text.innerHTML = 'Nenhuma sessão registrada ainda.<br>Comece agora!';
    empty.appendChild(text);
    panel.appendChild(empty);
    return;
  }

  // Group by date
  const dateGroups = {};
  filtered.forEach(e => {
    if (!dateGroups[e.data]) dateGroups[e.data] = [];
    dateGroups[e.data].push(e);
  });

  const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));
  panel.innerHTML = '';

  sortedDates.forEach(date => {
    const entries = dateGroups[date];
    const dayHoras = entries.reduce((s, e) => s + e.horas, 0);

    const [y, m, d] = date.split('-');
    const dateObj = new Date(y, m - 1, d);
    const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
    const monthStr = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

    // Day group container
    const dayGroup = createEl('div', 'hl-day-group');

    // Day header: [dayNum + month/weekday] ——— [clock icon + total time]
    const dayHeader = createEl('div', 'hl-day-header');

    const dateBlock = createEl('div', 'hl-date-block');
    dateBlock.appendChild(createEl('span', 'hl-day-num', d));
    const dateSub = createEl('div', 'hl-date-sub');
    dateSub.appendChild(createEl('span', 'hl-month', monthStr));
    dateSub.appendChild(createEl('span', 'hl-weekday', weekday));
    dateBlock.appendChild(dateSub);

    const line = createEl('div', 'hl-line');

    const timeBlock = createEl('div', 'hl-time-block');
    timeBlock.appendChild(createEl('span', 'hl-clock-icon', '🕐'));
    timeBlock.appendChild(createEl('span', 'hl-total-time', formatHorasMinutos(dayHoras)));

    dayHeader.appendChild(dateBlock);
    dayHeader.appendChild(line);
    dayHeader.appendChild(timeBlock);
    dayGroup.appendChild(dayHeader);

    // Entries list
    const entryList = createEl('div', 'hl-entries');

    let colorIdx = 0;
    entries.forEach(e => {
      const color = ENTRY_COLORS[colorIdx % ENTRY_COLORS.length];
      colorIdx++;

      const row = createEl('div', 'hl-entry');

      // Colored accent bar
      const bar = createEl('div', 'hl-accent-bar');
      bar.style.backgroundColor = color;
      row.appendChild(bar);

      // Text content
      const textCol = createEl('div', 'hl-entry-text');
      textCol.appendChild(createEl('div', 'hl-materia', e.materia.toUpperCase()));
      const assuntoText = e.assunto || 'Sessão de estudo';
      textCol.appendChild(createEl('div', 'hl-assunto', assuntoText));
      row.appendChild(textCol);

      // Time
      row.appendChild(createEl('span', 'hl-entry-time', formatHorasMinutos(e.horas)));

      // Delete
      const btnDel = createEl('button', 'btn-delete', '×');
      btnDel.title = 'Remover';
      btnDel.addEventListener('click', () => deletar(e.id));
      row.appendChild(btnDel);

      entryList.appendChild(row);
    });

    dayGroup.appendChild(entryList);
    panel.appendChild(dayGroup);
  });
}

// ── STATS ─────────────────────────────────────────────────
function updateStats() {
  const filtered = getFilteredEntries();
  const totalH = filtered.reduce((s, e) => s + e.horas, 0);
  const totalQ = filtered.reduce((s, e) => s + e.questoes, 0);
  const totalA = filtered.reduce((s, e) => s + (e.acertos || 0), 0);
  const totalE = filtered.reduce((s, e) => s + (e.erros || 0), 0);
  const dias = new Set(filtered.map(e => e.data)).size;
  const materias = new Set(filtered.map(e => e.materia)).size;
  const aprov = totalA + totalE > 0 ? Math.round(totalA / (totalA + totalE) * 100) : null;

  $('totalHoras').textContent = formatHorasMinutos(totalH);
  $('totalQuestoes').textContent = totalQ;
  $('totalAcertos').textContent = totalA;
  $('totalErros').textContent = totalE;
  $('totalDias').textContent = dias;

  $('mediaHoras').textContent = dias > 0 ? `${formatHorasMinutos(totalH / dias)} média/dia` : '— média/dia';
  $('mediaQuestoes').textContent = dias > 0 ? `${Math.round(totalQ / dias)} média/dia` : '— média/dia';
  $('subAcertos').textContent = totalA + totalE > 0 ? `de ${totalA + totalE} com gabarito` : '— sem gabarito';

  if (aprov !== null) {
    $('totalAprov').textContent = aprov + '%';
  } else {
    $('totalAprov').textContent = '—';
  }

  renderConstancia();
  renderSubjectPerformance();
}

// ── DESEMPENHO POR DISCIPLINA ─────────────────────────────
const DISC_BAR_COLORS = [
  '#93c5fd', // soft blue
  '#86efac', // mint green
  '#c4b5fd', // lavender
  '#fde68a', // warm yellow
  '#a5b4fc', // periwinkle
  '#99f6e4', // teal mint
  '#f9a8d4', // soft pink
  '#fca5a5', // coral
];

function renderSubjectPerformance() {
  const section = $('discSection');
  const container = $('discGrid');

  const filtered = getFilteredEntries();
  const activeDisciplinas = getActiveDisciplinas();

  // Aggregate per matéria (only from filtered entries)
  const subjectMap = {};
  filtered.forEach(e => {
    if (activePlanId && !activeDisciplinas.includes(e.materia)) return;
    if (!subjectMap[e.materia]) {
      subjectMap[e.materia] = { horas: 0, questoes: 0, acertos: 0, erros: 0 };
    }
    const s = subjectMap[e.materia];
    s.horas += e.horas;
    s.questoes += e.questoes;
    s.acertos += (e.acertos || 0);
    s.erros += (e.erros || 0);
  });

  const subjects = Object.keys(subjectMap);

  if (subjects.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  container.innerHTML = '';

  // Sort by hours descending
  subjects.sort((a, b) => subjectMap[b].horas - subjectMap[a].horas);

  // Max hours for progress bar scaling
  const maxHoras = subjectMap[subjects[0]].horas || 1;

  // Build the new list layout
  const list = createEl('div', 'disc-list');

  subjects.forEach((name, idx) => {
    const data = subjectMap[name];
    const totalH = data.horas;
    const hoursInt = Math.floor(totalH);
    const minutesRem = Math.round((totalH - hoursInt) * 60);
    const timeStr = hoursInt > 0
      ? (minutesRem > 0 ? `${hoursInt}h${pad(minutesRem)}min` : `${hoursInt}h`)
      : `${minutesRem}min`;

    const pct = maxHoras > 0 ? Math.max((totalH / maxHoras) * 100, 4) : 4;
    const barColor = DISC_BAR_COLORS[idx % DISC_BAR_COLORS.length];

    // Item container
    const item = createEl('div', 'disc-item');

    // Row: name + time
    const row = createEl('div', 'disc-item-row');
    row.appendChild(createEl('span', 'disc-item-name', name));
    row.appendChild(createEl('span', 'disc-item-time', timeStr));
    item.appendChild(row);

    // Progress bar
    const track = createEl('div', 'disc-item-track');
    const fill = createEl('div', 'disc-item-fill');
    fill.style.width = pct + '%';
    fill.style.backgroundColor = barColor;
    track.appendChild(fill);
    item.appendChild(track);

    // Stats row (questions + accuracy)
    const totalAE = data.acertos + data.erros;
    const aprov = totalAE > 0 ? Math.round(data.acertos / totalAE * 100) : null;

    if (data.questoes > 0 || aprov !== null) {
      const statsRow = createEl('div', 'disc-item-stats');
      if (data.questoes > 0) {
        statsRow.appendChild(createEl('span', 'disc-item-stat', data.questoes + ' questões'));
      }
      if (aprov !== null) {
        const accSpan = createEl('span', 'disc-item-stat');
        accSpan.appendChild(createEl('span', 'disc-item-acc-dot'));
        accSpan.appendChild(document.createTextNode(aprov + '% acerto'));
        statsRow.appendChild(accSpan);
      }
      if (data.acertos > 0 || data.erros > 0) {
        const aeSpan = createEl('span', 'disc-item-stat disc-item-stat-ae');
        aeSpan.textContent = `✓${data.acertos}  ✕${data.erros}`;
        statsRow.appendChild(aeSpan);
      }
      item.appendChild(statsRow);
    }

    list.appendChild(item);
  });

  container.appendChild(list);
}

// ── CONSTÂNCIA (day bar + streak) ─────────────────────────
function buildDayPlanMap() {
  // Build a map of date -> [{ planId, planName, hours }]
  const map = {};
  state.entries.forEach(e => {
    if (!map[e.data]) map[e.data] = {};
    const pid = e.planId || '__none__';
    if (!map[e.data][pid]) {
      const plan = planos.find(p => p.id === e.planId);
      map[e.data][pid] = {
        planId: e.planId,
        planName: plan ? plan.nome : 'Sem plano',
        hours: 0
      };
    }
    map[e.data][pid].hours += e.horas;
  });
  return map;
}

function renderConstancia() {
  const filtered = getFilteredEntries();
  const dayMap = getDayHoursMap(filtered);
  const dayPlanMap = buildDayPlanMap();
  const todayStr = new Date().toISOString().split('T')[0];
  const todayDate = new Date();

  const DAYS = 30;

  const days = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  // Render day bar
  const dayBar = $('dayBar');
  dayBar.innerHTML = '';

  days.forEach(d => {
    const ds = d.toISOString().split('T')[0];
    const hours = dayMap[ds] || 0;
    const isToday = ds === todayStr;
    const hasSession = hours > 0;
    const isPast = ds < todayStr;

    const dateLabel = String(d.getDate()).padStart(2, '0');

    const node = createEl('div', 'day-node');
    const bubble = createEl('div', 'day-node-bubble');

    if (isToday) {
      if (hasSession) {
        bubble.classList.add('status-studied');
        bubble.classList.add('status-today-studied');
      } else {
        bubble.classList.add('status-today-empty');
      }
    } else if (isPast) {
      if (hasSession) {
        bubble.classList.add('status-studied');
      } else {
        bubble.classList.add('status-default');
      }
    } else {
      bubble.classList.add('status-today-empty');
    }

    // Build tooltip
    if (!activePlanId && hasSession && dayPlanMap[ds]) {
      // All plans mode: show plan breakdown
      const planEntries = Object.values(dayPlanMap[ds]);
      planEntries.sort((a, b) => b.hours - a.hours);
      const tipLines = planEntries.map(p => `${p.planName} — ${formatHorasMinutos(p.hours)}`);
      node.title = ds + '\n' + tipLines.join('\n');
    } else {
      node.title = hasSession ? `${ds} — ${hours.toFixed(1)}h ✓` : ds;
    }

    node.appendChild(bubble);
    node.appendChild(createEl('div', 'day-node-date', dateLabel));
    dayBar.appendChild(node);
  });

  // Range label
  const first = days[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const last = days[days.length - 1].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  $('constanciaRange').textContent = `${first} – ${last}`;

  // Streak calc
  const validDays = new Set(
    Object.entries(dayMap).filter(([, h]) => h * 60 >= MIN_MINUTES).map(([d]) => d)
  );

  let streak = 0;
  const cursor = new Date(todayDate);
  while (true) {
    const s = cursor.toISOString().split('T')[0];
    if (validDays.has(s)) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }

  const sorted = [...validDays].sort();
  let best = 0, cur = 0, prev = null;
  sorted.forEach(d => {
    cur = (prev && (new Date(d) - new Date(prev)) / 86400000 === 1) ? cur + 1 : 1;
    if (cur > best) best = cur;
    prev = d;
  });

  const onFire = streak >= 5;
  $('streakNumber').textContent = streak;
  $('streakNumber').className = 'streak-badge-num' + (onFire ? ' on-fire' : '');
  $('streakBest').textContent = best;
  $('streakValid').textContent = validDays.size;
  $('streakBadgeFire').style.display = onFire ? 'inline' : 'none';

  let msg = '';
  if (streak === 0) msg = 'Comece hoje e inicie sua sequência! 📚';
  else if (streak === 1) msg = 'Ótimo começo! Volte amanhã para continuar.';
  else if (streak < 5) msg = `Você está há <strong>${streak} dias</strong> estudando seguido. Faltam ${5 - streak} para o streak 🔥`;
  else msg = `Você está há <strong>${streak} dias</strong> em sequência. Recorde: <strong>${best} dias</strong> 🔥`;
  $('constanciaMsg').innerHTML = msg;
}

// ── DRAWER ────────────────────────────────────────────────
function abrirDrawer() {
  $('formDrawer').classList.add('open');
  $('drawerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fecharDrawer() {
  $('formDrawer').classList.remove('open');
  $('drawerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── TIMER MODAL ───────────────────────────────────────────
const FOCUS_QUOTES = [
  '"A disciplina é a ponte entre metas e realizações."',
  '"O segredo do sucesso é a constância no propósito."',
  '"Cada hora de estudo é um tijolo no seu futuro."',
  '"Foco: uma coisa de cada vez, com toda a sua atenção."',
  '"Não espere pela inspiração. Comece, e ela virá."',
  '"Sua dedicação hoje é o seu resultado amanhã."',
];

function toggleTimerModal() {
  const overlay = $('focusOverlay');
  if (overlay.classList.contains('open')) {
    askCloseFocus();
  } else {
    const q = FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)];
    $('focusQuote').textContent = q;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function minimizeFocus() {
  hideFocusConfirm();
  $('focusOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function askCloseFocus() {
  const running = swInterval || cdInterval;
  if (running) {
    $('focusConfirm').classList.add('open');
  } else {
    closeFocusOverlay();
  }
}

function hideFocusConfirm() {
  $('focusConfirm').classList.remove('open');
}

function stopAndCloseFocus() {
  hideFocusConfirm();
  closeQuickSave();
  swReset();
  cdReset();
  closeFocusOverlay();
}

function closeFocusOverlay() {
  $('focusOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function switchFocusTab(tab) {
  $('focusPaneSw').style.display = tab === 'sw' ? 'flex' : 'none';
  $('focusPaneCd').style.display = tab === 'cd' ? 'flex' : 'none';
  $('focusTabSw').classList.toggle('active', tab === 'sw');
  $('focusTabCd').classList.toggle('active', tab === 'cd');
}

// ── TOAST ─────────────────────────────────────────────────
function showToast() {
  const t = $('toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── TIMER MATÉRIAs SYNC ──────────────────────────────────
function syncTimerMaterias() {
  const disciplinas = getActiveDisciplinas();
  ['swMateria', 'cdMateria', 'qsMateria'].forEach(id => {
    const sel = $(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '';
    const defaultOpt = createEl('option', null, 'Selecione...');
    defaultOpt.value = '';
    sel.appendChild(defaultOpt);
    disciplinas.forEach(m => {
      const o = createEl('option', null, m);
      o.value = m;
      sel.appendChild(o);
    });
    if (cur && disciplinas.includes(cur)) sel.value = cur;
  });
}

// ── STOPWATCH ─────────────────────────────────────────────
let swInterval = null, swSeconds = 0, swRunning = false, swSessionSecs = 0;

function swTick() {
  swSeconds++;
  $('swDisplay').textContent = secsToHMS(swSeconds);
  const progress = (swSeconds % 60) / 60;
  $('swRing').style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
}

function updateFabState() {
  const fab = $('timerFab');
  const active = swRunning || cdRunning;
  fab.classList.toggle('running', active);
}

function swToggle() {
  if (!swRunning) {
    swRunning = true;
    swInterval = setInterval(swTick, 1000);
    $('swPlayBtn').innerHTML = '⏸ Pausar';
    $('swStopBtn').style.display = 'flex';
    $('swDisplay').classList.add('running');
    $('swRegister').classList.remove('visible');
  } else {
    swRunning = false;
    clearInterval(swInterval);
    $('swPlayBtn').innerHTML = '▶ Retomar';
    $('swDisplay').classList.remove('running');
    $('swDisplay').classList.add('paused');
  }
  updateFabState();
}

function swStop() {
  if (swSeconds === 0) return;
  swRunning = false;
  clearInterval(swInterval);
  swSessionSecs = swSeconds;
  $('swPlayBtn').innerHTML = '▶ Iniciar';
  $('swStopBtn').style.display = 'none';
  $('swDisplay').classList.remove('running', 'paused');
  updateFabState();
  openQuickSave('sw', swSessionSecs);
}

function swReset() {
  swRunning = false;
  clearInterval(swInterval);
  swSeconds = 0;
  swSessionSecs = 0;
  $('swDisplay').textContent = '00:00:00';
  $('swDisplay').classList.remove('running', 'paused');
  $('swPlayBtn').innerHTML = '▶ Iniciar';
  $('swStopBtn').style.display = 'none';
  $('swRing').style.strokeDashoffset = 0;
  $('swRegister').classList.remove('visible');
  updateFabState();
}

// ── COUNTDOWN ─────────────────────────────────────────────
let cdInterval = null, cdTotal = 0, cdRemaining = 0, cdRunning = false, cdSessionSecs = 0;

function cdGetInput() {
  const h = sanitizePositiveInt($('cdHours').value);
  const m = sanitizePositiveInt($('cdMinutes').value);
  const s = sanitizePositiveInt($('cdSeconds').value);
  return h * 3600 + m * 60 + s;
}

function cdTick() {
  if (cdRemaining <= 0) { cdFinished(); return; }
  cdRemaining--;
  $('cdDisplay').textContent = secsToHMS(cdRemaining);
  const progress = cdTotal > 0 ? (cdTotal - cdRemaining) / cdTotal : 0;
  $('cdRing').style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  if (cdRemaining <= 10 && cdRemaining > 0) {
    $('cdDisplay').style.color = 'var(--accent3)';
    $('cdDisplay').classList.add('pulse');
  }
}

function cdFinished() {
  clearInterval(cdInterval);
  cdRunning = false;
  cdSessionSecs = cdTotal;
  const disp = $('cdDisplay');
  disp.classList.remove('running', 'paused', 'pulse');
  disp.style.color = '';
  disp.textContent = '✓ Fim!';
  $('cdPlayBtn').innerHTML = '▶ Iniciar';
  $('cdStopBtn').style.display = 'none';
  $('cdRing').style.strokeDashoffset = 0;
  updateFabState();
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.18, 0.36].forEach(delay => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.25, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
      o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.3);
    });
  } catch (e) {
    // Audio not available
  }
  if (cdSessionSecs > 0) openQuickSave('cd', cdSessionSecs);
}

function cdToggle() {
  if (!cdRunning) {
    if (cdRemaining === 0) {
      cdTotal = cdGetInput();
      if (cdTotal <= 0) return alert('Defina um tempo!');
      cdRemaining = cdTotal;
    }
    cdRunning = true;
    cdInterval = setInterval(cdTick, 1000);
    $('cdPlayBtn').innerHTML = '⏸ Pausar';
    $('cdStopBtn').style.display = 'flex';
    $('cdDisplay').classList.add('running');
    $('cdDisplay').style.color = '';
    $('cdDisplay').classList.remove('pulse');
    $('cdRegister').classList.remove('visible');
    ['cdHours', 'cdMinutes', 'cdSeconds'].forEach(id => $(id).disabled = true);
  } else {
    cdRunning = false;
    clearInterval(cdInterval);
    $('cdPlayBtn').innerHTML = '▶ Retomar';
    $('cdDisplay').classList.remove('running');
    $('cdDisplay').classList.add('paused');
  }
  updateFabState();
}

function cdStop() {
  cdRunning = false;
  clearInterval(cdInterval);
  cdSessionSecs = cdTotal - cdRemaining;
  const disp = $('cdDisplay');
  disp.classList.remove('running', 'paused', 'pulse');
  disp.style.color = '';
  $('cdPlayBtn').innerHTML = '▶ Iniciar';
  $('cdStopBtn').style.display = 'none';
  updateFabState();
  if (cdSessionSecs > 0) openQuickSave('cd', cdSessionSecs);
}

function cdReset() {
  cdRunning = false;
  clearInterval(cdInterval);
  cdTotal = 0; cdRemaining = 0; cdSessionSecs = 0;
  const disp = $('cdDisplay');
  disp.textContent = '00:00:00';
  disp.classList.remove('running', 'paused', 'pulse');
  disp.style.color = '';
  $('cdPlayBtn').innerHTML = '▶ Iniciar';
  $('cdStopBtn').style.display = 'none';
  $('cdRing').style.strokeDashoffset = 0;
  $('cdRegister').classList.remove('visible');
  ['cdHours', 'cdMinutes', 'cdSeconds'].forEach(id => $(id).disabled = false);
  updateFabState();
}

// ── QUICK SAVE MODAL ──────────────────────────────────────
let quickSaveType = null;
let quickSaveSecs = 0;

function openQuickSave(type, secs) {
  quickSaveType = type;
  quickSaveSecs = secs;

  syncTimerMaterias();
  const timerMateria = $(type + 'Materia');
  if (timerMateria && timerMateria.value) {
    $('qsMateria').value = timerMateria.value;
  }

  $('qsTime').textContent = secsToHMS(secs);
  $('qsAssunto').value = '';
  $('qsQuestoes').value = '';
  $('qsAcertos').value = '';
  $('qsErros').value = '';
  $('quickSaveModal').classList.add('open');
}

function closeQuickSave() {
  $('quickSaveModal').classList.remove('open');
  quickSaveType = null;
}

function confirmQuickSave() {
  const materia = sanitizeText($('qsMateria').value);
  const assunto = sanitizeText($('qsAssunto').value);
  const questoes = sanitizePositiveInt($('qsQuestoes').value);
  const acertos = sanitizePositiveInt($('qsAcertos').value);
  const erros = sanitizePositiveInt($('qsErros').value);

  if (!materia) return alert('Selecione uma matéria!');
  if (acertos + erros > questoes && questoes > 0) return alert('Acertos + Erros não podem ser maiores que o total de questões!');

  const horas = Math.round(quickSaveSecs / 36) / 100;
  const todayStr = new Date().toISOString().split('T')[0];
  state.entries.unshift({ id: Date.now(), data: todayStr, materia, assunto, horas, questoes, acertos, erros, planId: activePlanId || null });
  saveState();
  renderHistory();
  updateStats();

  const type = quickSaveType;
  closeQuickSave();
  if (type === 'sw') swReset(); else cdReset();
  showToast();
}

// ── REGISTER FROM TIMER ───────────────────────────────────
function registrarTimer(type) {
  const materia = sanitizeText($(type + 'Materia').value);
  const assunto = sanitizeText($(type + 'Assunto').value);
  const questoes = sanitizePositiveInt($(type + 'Questoes').value);
  const acertos = sanitizePositiveInt($(type + 'Acertos').value);
  const erros = sanitizePositiveInt($(type + 'Erros').value);
  const secs = type === 'sw' ? swSessionSecs : cdSessionSecs;

  if (!materia) return alert('Selecione uma matéria!');
  if (secs <= 0) return alert('Nenhum tempo registrado!');
  if (acertos + erros > questoes && questoes > 0) return alert('Acertos + Erros não podem ser maiores que o total de questões!');

  const horas = Math.round(secs / 36) / 100;
  const todayStr = new Date().toISOString().split('T')[0];

  state.entries.unshift({ id: Date.now(), data: todayStr, materia, assunto, horas, questoes, acertos, erros, planId: activePlanId || null });
  saveState();
  renderHistory();
  updateStats();

  $(type + 'Register').classList.remove('visible');
  ['Assunto', 'Questoes', 'Acertos', 'Erros'].forEach(f => $(type + f).value = '');
  if (type === 'sw') swReset(); else cdReset();

  showToast();
}

// ── SIDEBAR NAVIGATION ───────────────────────────────────
function switchView(view) {
  document.querySelectorAll('.app-view').forEach(v => v.style.display = 'none');
  document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));

  if (view === 'planos') {
    $('viewPlanos').style.display = '';
    $('navPlanos').classList.add('active');
    renderPlanos();
  } else {
    $('viewTracker').style.display = '';
    $('navTracker').classList.add('active');
  }
}

// ── PLANOS DE ESTUDO ─────────────────────────────────────

let planos = [];
let currentPlanId = null;
let editPlanId = null;

function loadPlanos() {
  try {
    const saved = localStorage.getItem('concurso_planos');
    if (saved) planos = JSON.parse(saved);
  } catch (e) { console.warn('Failed to load planos:', e); }
}

function savePlanos() {
  try { localStorage.setItem('concurso_planos', JSON.stringify(planos)); }
  catch (e) { console.warn('Failed to save planos:', e); }
}


function renderPlanos() {
  const grid = $('planosGrid');
  if (planos.length === 0) {
    grid.innerHTML = '';
    const empty = createEl('div', 'empty-state');
    empty.appendChild(createEl('div', 'empty-icon', '\u{1F4CB}'));
    const text = createEl('div', 'empty-text');
    text.innerHTML = 'Nenhum plano criado ainda.<br>Crie o seu primeiro!';
    empty.appendChild(text);
    grid.appendChild(empty);
    return;
  }

  grid.innerHTML = '';
  planos.forEach(p => {
    const card = createEl('div', 'plano-card');


    // Parte de cima (Título e Obs)
    const contentWrap = createEl('div', 'plano-card-content');
    contentWrap.appendChild(createEl('div', 'plano-card-title', p.nome));
    if (p.obs) contentWrap.appendChild(createEl('div', 'plano-card-obs', p.obs));
    card.appendChild(contentWrap);

    // Rodapé (Quantidade de disciplinas e Botões)
    const footer = createEl('div', 'plano-card-footer');
    const discCount = (p.disciplinas || []).length;
    footer.appendChild(createEl('div', 'plano-card-meta', discCount + ' disciplina' + (discCount !== 1 ? 's' : '')));

    const actions = createEl('div', 'plano-card-actions');

    // Botão Editar
    const btnEdit = createEl('button', 'plano-action-btn');
    // Ícone SVG moderno de Lápis
    btnEdit.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
    btnEdit.title = 'Editar Plano';
    btnEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      openNovoPlanModal(p.id);
    });

    // Botão Excluir
    const btnDel = createEl('button', 'plano-action-btn delete-btn');
    // Ícone SVG moderno de Lixeira
    btnDel.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    btnDel.title = 'Excluir Plano';
    btnDel.addEventListener('click', (e) => {
      e.stopPropagation();
      deletarPlano(p.id);
    });

    actions.appendChild(btnEdit);
    actions.appendChild(btnDel);
    footer.appendChild(actions);

    card.appendChild(footer);
    card.addEventListener('click', () => openPlanDetail(p.id));
    grid.appendChild(card);
  });
}

function deletarPlano(id) {
  // Confirmação de segurança
  if (!confirm('⚠️ Tem certeza que deseja excluir este plano?\n\nTODOS os estudos registrados para ele serão apagados permanentemente do seu histórico e da tela de constância.')) return;

  // 1. Apaga o plano da lista
  planos = planos.filter(p => p.id !== id);
  savePlanos();

  // 2. Apaga em cascata todos os registros do histórico atrelados a ele
  state.entries = state.entries.filter(e => e.planId !== id);
  saveState();

  // 3. Se o plano apagado estava selecionado lá no topo do Tracker, limpa a seleção
  if (activePlanId === id) {
    activePlanId = null;
    saveActivePlan();
  }

  // 4. Atualiza a tela toda para refletir a exclusão
  renderPlanSelector();
  renderPlanos();
  if (currentPlanId === id) closePlanDetail(); // Fecha a tela de detalhes caso algum bug a tenha deixado aberta
  renderHistory();
  updateStats();
}

function openNovoPlanModal(editId) {
  editPlanId = editId || null;
  if (editPlanId) {
    const plan = planos.find(p => p.id === editPlanId);
    if (!plan) return;
    $('planNome').value = plan.nome;
    $('planObs').value = plan.obs || '';
    $('novoPlanModalTitle').textContent = 'Editar Plano';
    $('btnSavePlan').textContent = '✦ Salvar Alterações';
  } else {
    $('planNome').value = '';
    $('planObs').value = '';
    $('novoPlanModalTitle').textContent = 'Novo Plano de Estudo';
    $('btnSavePlan').textContent = '✦ Criar Plano';
  }
  $('novoPlanModal').classList.add('open');
}

function closeNovoPlanModal() {
  editPlanId = null;
  $('novoPlanModal').classList.remove('open');
}

function createPlan() {
  const nome = sanitizeText($('planNome').value);
  if (!nome) return alert('Digite o nome do plano!');
  if (editPlanId) {
    // Edit existing plan
    const plan = planos.find(p => p.id === editPlanId);
    if (plan) {
      plan.nome = nome;
      plan.obs = sanitizeText($('planObs').value);
    }
  } else {
    planos.push({ id: Date.now(), nome, obs: sanitizeText($('planObs').value), disciplinas: [] });
  }
  savePlanos();
  closeNovoPlanModal();
  renderPlanos();
  renderPlanSelector();
  if (editPlanId && currentPlanId === editPlanId) renderPlanDetail();
  updateStats();
}

function openPlanDetail(id) {
  currentPlanId = id;
  $('planosListView').style.display = 'none';
  $('planoDetailView').style.display = '';
  renderPlanDetail();
}

function closePlanDetail() {
  currentPlanId = null;
  $('planoDetailView').style.display = 'none';
  $('planosListView').style.display = '';
  renderPlanos();
}

function renderPlanDetail() {
  const plan = planos.find(p => p.id === currentPlanId);
  if (!plan) return closePlanDetail();

  $('planoDetailTitle').textContent = plan.nome;
  $('planoDetailObs').textContent = plan.obs || 'Sem observações.';
  const list = $('planoDiscList');
  if (!plan.disciplinas || plan.disciplinas.length === 0) {
    list.innerHTML = '';
    const empty = createEl('div', 'empty-state');
    empty.style.padding = '32px';
    empty.appendChild(createEl('div', 'empty-text', 'Nenhuma disciplina adicionada.'));
    list.appendChild(empty);
    return;
  }

  list.innerHTML = '';
  plan.disciplinas.forEach((d, i) => {
    const row = createEl('div', 'plano-disc-item');
    row.appendChild(createEl('span', 'plano-disc-name', d));
    const btn = createEl('button', 'plano-disc-remove', '\u00d7');
    btn.title = 'Remover';
    btn.addEventListener('click', () => removeDisc(i));
    row.appendChild(btn);
    list.appendChild(row);
  });
}

function openAddDiscModal() {
  $('discNome').value = '';
  $('addDiscModal').classList.add('open');
}

function closeAddDiscModal() {
  $('addDiscModal').classList.remove('open');
}

function addDisc() {
  const nome = sanitizeText($('discNome').value);
  if (!nome) return alert('Digite o nome da disciplina!');
  const plan = planos.find(p => p.id === currentPlanId);
  if (!plan) return;
  if (!plan.disciplinas) plan.disciplinas = [];
  if (plan.disciplinas.includes(nome)) { closeAddDiscModal(); return; }
  plan.disciplinas.push(nome);
  savePlanos();
  closeAddDiscModal();
  renderPlanDetail();
}

function removeDisc(idx) {
  const plan = planos.find(p => p.id === currentPlanId);
  if (!plan) return;
  plan.disciplinas.splice(idx, 1);
  savePlanos();
  renderPlanDetail();
}

// ── EVENT LISTENERS ───────────────────────────────────────
function initEventListeners() {
  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($('novoPlanModal').classList.contains('open')) { closeNovoPlanModal(); return; }
      if ($('addDiscModal').classList.contains('open')) { closeAddDiscModal(); return; }
      if ($('focusConfirm').classList.contains('open')) { hideFocusConfirm(); return; }
      if ($('focusOverlay').classList.contains('open')) { askCloseFocus(); return; }
      fecharDrawer();
    }
  });

  // Plan selector
  $('activePlanSelect').addEventListener('change', onPlanChange);

  // Sidebar navigation
  $('navTracker').addEventListener('click', () => switchView('tracker'));
  $('navPlanos').addEventListener('click', () => switchView('planos'));

  // Drawer
  $('drawerOverlay').addEventListener('click', fecharDrawer);
  $('drawerCloseBtn').addEventListener('click', fecharDrawer);
  $('btnAbrirDrawer').addEventListener('click', abrirDrawer);
  $('btnRegistrar').addEventListener('click', registrar);

  // Timer FAB
  $('timerFab').addEventListener('click', toggleTimerModal);

  // Focus overlay controls
  $('focusTabSw').addEventListener('click', () => switchFocusTab('sw'));
  $('focusTabCd').addEventListener('click', () => switchFocusTab('cd'));
  $('focusMinimizeBtn').addEventListener('click', minimizeFocus);
  $('focusCloseBtn').addEventListener('click', askCloseFocus);

  // Stopwatch buttons
  $('swPlayBtn').addEventListener('click', swToggle);
  $('swStopBtn').addEventListener('click', swStop);
  $('swResetBtn').addEventListener('click', swReset);

  // Countdown buttons
  $('cdPlayBtn').addEventListener('click', cdToggle);
  $('cdStopBtn').addEventListener('click', cdStop);
  $('cdResetBtn').addEventListener('click', cdReset);

  // Timer register buttons
  $('swRegBtn').addEventListener('click', () => registrarTimer('sw'));
  $('cdRegBtn').addEventListener('click', () => registrarTimer('cd'));

  // Focus confirm dialog
  $('confirmKeepBtn').addEventListener('click', hideFocusConfirm);
  $('confirmMinimizeBtn').addEventListener('click', minimizeFocus);
  $('confirmStopBtn').addEventListener('click', stopAndCloseFocus);

  // Quick save modal
  $('qsSaveBtn').addEventListener('click', confirmQuickSave);
  $('qsDiscardBtn').addEventListener('click', closeQuickSave);

  // Planos de Estudo
  $('btnNovoPlan').addEventListener('click', () => openNovoPlanModal());
  $('btnSavePlan').addEventListener('click', createPlan);
  $('btnCancelPlan').addEventListener('click', closeNovoPlanModal);
  $('btnBackPlanos').addEventListener('click', closePlanDetail);
  $('btnEditPlan').addEventListener('click', () => openNovoPlanModal(currentPlanId));
  $('btnAddDisc').addEventListener('click', openAddDiscModal);
  $('btnSaveDisc').addEventListener('click', addDisc);
  $('btnCancelDisc').addEventListener('click', closeAddDiscModal);
}
