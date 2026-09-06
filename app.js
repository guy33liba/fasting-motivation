const STORAGE_KEY = "fastingPowerTimer.v2";
const RING_RADIUS = 132;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const state = {
  goalHours: 16,
  startedAt: null,
  elapsedBeforePause: 0,
  isRunning: false,
  completedCount: 0,
  completedDates: [],
  completedShown: false,
  motivationIndex: 0
};

const dom = {
  goalInput: document.getElementById("goal-input"),
  targetNote: document.getElementById("target-note"),
  timerProgress: document.getElementById("timer-progress"),
  timerValue: document.getElementById("timer-value"),
  progressValue: document.getElementById("progress-value"),
  goalHoursText: document.getElementById("goal-hours-text"),
  remainingValue: document.getElementById("remaining-value"),
  mainActionButton: document.getElementById("main-action-button"),
  mainActionText: document.getElementById("main-action-text"),
  mainActionIcon: document.getElementById("main-action-icon"),
  endButton: document.getElementById("end-button"),
  motivationText: document.getElementById("motivation-text"),
  motivationIcon: document.getElementById("motivation-icon"),
  streakValue: document.getElementById("streak-value"),
  completedValue: document.getElementById("completed-value"),
  completionModal: document.getElementById("completion-modal"),
  modalCloseButton: document.getElementById("modal-close-button")
};

const motivations = [
  { icon: "♡", text: "One clear choice at a time." },
  { icon: "⚡", text: "Stay steady. Every minute counts." },
  { icon: "✦", text: "Keep your focus on the target you chose." },
  { icon: "🔥", text: "Strong rhythm. Calm mind. Keep going." },
  { icon: "★", text: "You are building momentum." },
  { icon: "🏁", text: "Final stretch. Stay steady." }
];

function initializeApp() {
  loadState();
  dom.goalInput.value = formatInputHours(state.goalHours);
  bindEvents();
  render();
  window.setInterval(tick, 1000);
}

function bindEvents() {
  dom.goalInput.addEventListener("input", handleGoalInput);
  dom.goalInput.addEventListener("blur", handleGoalBlur);
  dom.mainActionButton.addEventListener("click", handleMainAction);
  dom.endButton.addEventListener("click", endFast);
  dom.modalCloseButton.addEventListener("click", closeCompletionModal);
}

function handleGoalInput(event) {
  if (hasProgress()) {
    event.target.value = formatInputHours(state.goalHours);
    return;
  }

  const nextGoal = Number(event.target.value);
  if (!Number.isFinite(nextGoal) || nextGoal <= 0) return;

  state.goalHours = nextGoal;
  saveState();
  render();
}

function handleGoalBlur(event) {
  const nextGoal = Number(event.target.value);

  if (!Number.isFinite(nextGoal) || nextGoal <= 0) {
    event.target.value = formatInputHours(state.goalHours);
  }
}

function handleMainAction() {
  if (isGoalComplete()) {
    resetProgress();
    startFast();
    return;
  }

  if (state.isRunning) {
    pauseFast();
    return;
  }

  startFast();
}

function startFast() {
  if (state.isRunning) return;

  state.startedAt = Date.now();
  state.isRunning = true;
  state.completedShown = false;
  saveState();
  render();
}

function pauseFast() {
  if (!state.isRunning || !state.startedAt) return;

  state.elapsedBeforePause += Date.now() - state.startedAt;
  state.startedAt = null;
  state.isRunning = false;
  saveState();
  render();
}

function endFast() {
  resetProgress();
  saveState();
  render();
}

function resetProgress() {
  state.startedAt = null;
  state.elapsedBeforePause = 0;
  state.isRunning = false;
  state.completedShown = false;
  state.motivationIndex = 0;
}

function tick() {
  if (!state.isRunning) return;

  if (getElapsedMs() >= getGoalMs() && !state.completedShown) {
    completeFast();
  }

  render();
}

function completeFast() {
  const goalMs = getGoalMs();
  const today = getLocalDateKey(new Date());

  state.completedShown = true;
  state.completedCount += 1;
  state.completedDates = [...new Set([...state.completedDates, today])].slice(-120);
  state.isRunning = false;
  state.elapsedBeforePause = goalMs;
  state.startedAt = null;
  saveState();
  showCompletionModal();
}

function render() {
  const goalMs = getGoalMs();
  const elapsedMs = Math.min(getElapsedMs(), goalMs);
  const remainingMs = Math.max(goalMs - elapsedMs, 0);
  const progress = goalMs > 0 ? Math.min(elapsedMs / goalMs, 1) : 0;
  const percent = Math.round(progress * 100);
  const streak = calculateStreak(state.completedDates);

  dom.timerValue.textContent = formatDuration(elapsedMs);
  dom.progressValue.textContent = `${percent}%`;
  dom.goalHoursText.textContent = formatDuration(goalMs);
  dom.remainingValue.textContent = formatDuration(remainingMs);
  dom.timerProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  dom.timerProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
  dom.streakValue.textContent = String(streak);
  dom.completedValue.textContent = String(state.completedCount);

  updateMotivation(percent);
  updateControls();
  updateTargetNote();
}

function updateControls() {
  const progressExists = hasProgress();
  const complete = isGoalComplete();

  if (complete) {
    dom.mainActionText.textContent = "START NEW FAST";
    dom.mainActionIcon.textContent = "⚡";
  } else if (state.isRunning) {
    dom.mainActionText.textContent = "PAUSE FAST";
    dom.mainActionIcon.textContent = "Ⅱ";
  } else if (state.elapsedBeforePause > 0) {
    dom.mainActionText.textContent = "RESUME FAST";
    dom.mainActionIcon.textContent = "▶";
  } else {
    dom.mainActionText.textContent = "START FAST";
    dom.mainActionIcon.textContent = "⚡";
  }

  dom.endButton.hidden = !progressExists;
  dom.goalInput.disabled = progressExists;
}

function updateMotivation(percent) {
  let index = 0;

  if (percent >= 90) index = 5;
  else if (percent >= 70) index = 4;
  else if (percent >= 45) index = 3;
  else if (percent >= 20) index = 2;
  else if (percent > 0) index = 1;

  state.motivationIndex = index;
  dom.motivationIcon.textContent = motivations[index].icon;
  dom.motivationText.textContent = motivations[index].text;
}

function updateTargetNote() {
  if (state.goalHours > 24) {
    dom.targetNote.hidden = false;
    dom.targetNote.textContent = "Extended fasts can carry additional risks. Consider medical guidance before longer fasting.";
    return;
  }

  dom.targetNote.hidden = true;
  dom.targetNote.textContent = "";
}

function hasProgress() {
  return state.isRunning || state.elapsedBeforePause > 0;
}

function isGoalComplete() {
  return !state.isRunning && state.elapsedBeforePause >= getGoalMs() && state.elapsedBeforePause > 0;
}

function getElapsedMs() {
  const activeElapsed = state.isRunning && state.startedAt
    ? Date.now() - state.startedAt
    : 0;

  return Math.max(0, state.elapsedBeforePause + activeElapsed);
}

function getGoalMs() {
  return state.goalHours * 60 * 60 * 1000;
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatInputHours(hours) {
  return Number.isInteger(hours) ? String(hours) : String(Number(hours.toFixed(2)));
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateStreak(dateKeys) {
  const uniqueDates = new Set(dateKeys);
  const cursor = new Date();
  let streak = 0;

  if (!uniqueDates.has(getLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  for (let index = 0; index < 365; index += 1) {
    const key = getLocalDateKey(cursor);
    if (!uniqueDates.has(key)) break;

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function showCompletionModal() {
  dom.completionModal.hidden = false;
  dom.modalCloseButton.focus();
}

function closeCompletionModal() {
  dom.completionModal.hidden = true;
  dom.mainActionButton.focus();
}

function saveState() {
  const payload = {
    goalHours: state.goalHours,
    startedAt: state.startedAt,
    elapsedBeforePause: state.elapsedBeforePause,
    isRunning: state.isRunning,
    completedCount: state.completedCount,
    completedDates: state.completedDates,
    completedShown: state.completedShown
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw);
    const savedGoal = Number(saved.goalHours);

    state.goalHours = Number.isFinite(savedGoal) && savedGoal > 0 ? savedGoal : 16;
    state.startedAt = Number.isFinite(saved.startedAt) ? saved.startedAt : null;
    state.elapsedBeforePause = Number.isFinite(saved.elapsedBeforePause) && saved.elapsedBeforePause >= 0
      ? saved.elapsedBeforePause
      : 0;
    state.isRunning = Boolean(saved.isRunning && state.startedAt);
    state.completedCount = Number.isInteger(saved.completedCount) && saved.completedCount >= 0
      ? saved.completedCount
      : 0;
    state.completedDates = Array.isArray(saved.completedDates)
      ? saved.completedDates.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)).slice(-120)
      : [];
    state.completedShown = Boolean(saved.completedShown);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

initializeApp();
