
// ─────────────────────────────────────────────
//  DATA
// ─────────────────────────────────────────────
let tasks = [];
const activeTimers = {}; // taskId -> intervalId

function saveData() {
  localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
}

function loadData() {
  try {
    const raw = localStorage.getItem('taskflow_tasks');
    tasks = raw ? JSON.parse(raw) : [];
    // Reset isTracking on load (timers don't survive refresh)
    tasks.forEach(t => { t.isTracking = false; });
    saveData();
  } catch(e) { tasks = []; }
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function deadlineStatus(dateStr) {
  if (!dateStr) return 'none';
  const today = new Date(); today.setHours(0,0,0,0);
  const dl    = new Date(dateStr + 'T00:00:00');
  if (dl < today) return 'overdue';
  if (dl.getTime() === today.getTime()) return 'today';
  return 'future';
}

function isOverdue(task) {
  return !task.completed && deadlineStatus(task.deadline) === 'overdue';
}

// ─────────────────────────────────────────────
//  TIMER
// ─────────────────────────────────────────────
function startTimer(id) {
  if (activeTimers[id]) return;
  activeTimers[id] = setInterval(() => {
    const task = tasks.find(t => t.id === id);
    if (!task) { clearInterval(activeTimers[id]); delete activeTimers[id]; return; }
    task.timeSpent++;
    saveData();
    // update only the timer display without full re-render
    const el = document.querySelector(`[data-id="${id}"] .timer-display`);
    if (el) el.textContent = formatTime(task.timeSpent);
  }, 1000);
}

function stopTimer(id) {
  clearInterval(activeTimers[id]);
  delete activeTimers[id];
}

function toggleTimer(id) {
  const task = tasks.find(t => t.id === id);
  if (!task || task.completed) return;
  task.isTracking = !task.isTracking;
  task.isTracking ? startTimer(id) : stopTimer(id);
  saveData();
  // toggle classes without full re-render
  const card    = document.querySelector(`[data-id="${id}"]`);
  const btn     = card?.querySelector('.btn-play');
  const display = card?.querySelector('.timer-display');
  if (card)    card.classList.toggle('tracking', task.isTracking);
  if (btn)     { btn.textContent = task.isTracking ? '⏸' : '▶'; btn.classList.toggle('active', task.isTracking); }
  if (display) display.style.color = task.isTracking ? 'var(--accent3)' : '';
  updateStats();
}

// ─────────────────────────────────────────────
//  CRUD
// ─────────────────────────────────────────────
function addTask() {
  const title    = document.getElementById('inp-title').value.trim();
  const deadline = document.getElementById('inp-deadline').value;
  if (!title) { showToast('Please enter a task name.'); return; }

  const task = { id: uid(), title, deadline, timeSpent: 0, isTracking: false, completed: false };
  tasks.unshift(task);
  saveData();
  render();
  document.getElementById('inp-title').value = '';
  document.getElementById('inp-deadline').value = '';
  showToast('Task added!');
}

function deleteTask(id) {
  stopTimer(id);
  tasks = tasks.filter(t => t.id !== id);
  saveData();
  render();
}

function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (task.isTracking) { task.isTracking = false; stopTimer(id); }
  task.completed = !task.completed;
  saveData();
  render();
}

// ─────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────
function render() {
  const container = document.getElementById('task-container');

  if (!tasks.length) {
    container.innerHTML = `
      <div class="empty">
        <span class="big">∅</span>
        No tasks yet.<br>Add one above to get started.
      </div>`;
    updateStats(); return;
  }

  container.innerHTML = tasks.map(task => {
    const status  = deadlineStatus(task.deadline);
    const overdue = !task.completed && status === 'overdue';
    const today   = !task.completed && status === 'today';

    const cardClass = [
      'task-card',
      overdue ? 'overdue' : '',
      task.completed ? 'done' : '',
      task.isTracking ? 'tracking' : ''
    ].filter(Boolean).join(' ');

    const badgeClass = overdue ? 'task-deadline overdue-badge'
                     : today  ? 'task-deadline today-badge'
                     :          'task-deadline';

    const deadlineLabel = task.deadline
      ? (overdue ? `⚠ ${task.deadline}` : today ? `⚡ Today` : task.deadline)
      : '—';

    return `
    <div class="${cardClass}" data-id="${task.id}">
      <div class="task-top">
        <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''}
          onchange="toggleComplete('${task.id}')" title="Mark complete" />
        <span class="task-title">${escHtml(task.title)}</span>
        <span class="${badgeClass}">${deadlineLabel}</span>
      </div>
      <div class="task-bottom">
        <span class="timer-display">${formatTime(task.timeSpent)}</span>
        <button class="btn-play ${task.isTracking ? 'active' : ''}"
          onclick="toggleTimer('${task.id}')"
          title="${task.isTracking ? 'Pause' : 'Start'} timer"
          ${task.completed ? 'disabled style="opacity:.3;cursor:not-allowed"' : ''}>
          ${task.isTracking ? '⏸' : '▶'}
        </button>
      </div>
      <div class="task-actions">
        <button class="btn-del" onclick="deleteTask('${task.id}')" title="Delete task">✕</button>
      </div>
    </div>`;
  }).join('');

  updateStats();
}

function updateStats() {
  const active  = tasks.filter(t => !t.completed).length;
  const done    = tasks.filter(t => t.completed).length;
  const overdue = tasks.filter(t => isOverdue(t)).length;
  document.getElementById('stat-active').textContent  = active;
  document.getElementById('stat-done').textContent    = done;
  document.getElementById('stat-overdue').textContent = overdue;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
let toastTimeout;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 2200);
}

// ─────────────────────────────────────────────
//  EVENTS
// ─────────────────────────────────────────────
document.getElementById('btn-add').addEventListener('click', addTask);
document.getElementById('inp-title').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

// Set min date on deadline picker
document.getElementById('inp-deadline').min = new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
loadData();
render();
