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
  lastMotivationIndex: -1
};

const dom = {
  timerProgress: document.getElementById("timer-progress"),
  timerValue: document.getElementById("timer-value"),
  goalHoursText: document.getElementById("goal-hours-text"),
  progressText: document.getElementById("progress-text"),
  motivationText: document.getElementById("motivation-text"),
  goalSelect: document.getElementById("goal-select"),
  mainActionButton: document.getElementById("main-action-button"),
  mainActionText: document.getElementById("main-action-text"),
  mainActionIcon: document.getElementById("main-action-icon"),
  pauseButton: document.getElementById("pause-button"),
  endButton: document.getElementById("end-button"),
  streakValue: document.getElementById("streak-value"),
  streakBarFill: document.getElementById("streak-bar-fill"),
  completedValue: document.getElementById("completed-value"),
  completedBarFill: document.getElementById("completed-bar-fill"),
  completionModal: document.getElementById("completion-modal"),
  modalCloseButton: document.getElementById("modal-close-button")
};

const motivations = [
  "One more moment — you are building momentum.",
  "Stay steady. Every minute counts.",
  "Your commitment is getting stronger.",
  "You are past the easy part. Keep your focus.",
  "Strong mind. Clear target. Keep moving.",
  "You are closing in on the target.",
  "Final stretch — stay calm and finish strong."
];

function initializeApp() {
  loadState();
  dom.goalSelect.value = formatInputHours(state.goalHours);
  bindEvents();
  render();
  window.setInterval(tick, 1000);
}

function bindEvents() {
  dom.goalSelect.addEventListener("change", handleGoalChange);
  dom.mainActionButton.addEventListener("click", handleMainAction);
  dom.pauseButton.addEventListener("click", pauseFast);
  dom.endButton.addEventListener("click", endFast);
  dom.modalCloseButton.addEventListener("click", closeCompletionModal);
}

function handleGoalChange(event) {
  if (state.isRunning || state.elapsedBeforePause > 0) {
    event.target.value = formatInputHours(state.goalHours);
    return;
  }

  const customHours = Number.parseFloat(event.target.value);

  if (!Number.isFinite(customHours) || customHours <= 0) {
    event.target.value = formatInputHours(state.goalHours);
    return;
  }

  state.goalHours = customHours;
  event.target.value = formatInputHours(state.goalHours);
  saveState();
  render();
}

function handleMainAction() {
  if (isGoalComplete()) {
    resetProgress();
    startFast();
    return;
  }

  if (state.isRunning) {
    pulseMotivation();
    return;
  }

  startFast();
}

function startFast() {
  if (state.isRunning) return;

  const customHours = Number.parseFloat(dom.goalSelect.value);
  if (!Number.isFinite(customHours) || customHours <= 0) {
    dom.goalSelect.value = formatInputHours(state.goalHours);
    dom.goalSelect.focus();
    return;
  }

  state.goalHours = customHours;
  dom.goalSelect.value = formatInputHours(state.goalHours);
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
  state.lastMotivationIndex = -1;
}

function tick() {
  if (!state.isRunning) return;

  const elapsedMs = getElapsedMs();
  const goalMs = getGoalMs();

  if (elapsedMs >= goalMs && !state.completedShown) {
    completeFast(goalMs);
  }

  render();
}

function completeFast(goalMs) {
  state.completedShown = true;
  state.completedCount += 1;
  state.completedDates.push(getLocalDateKey(new Date()));
  state.completedDates = [...new Set(state.completedDates)].slice(-120);
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
  const progressPercent = Math.round(progress * 100);
  const streak = calculateStreak(state.completedDates);

  dom.timerValue.textContent = formatDuration(elapsedMs);
  dom.goalHoursText.textContent = formatDuration(goalMs);
  dom.timerProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  dom.timerProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));

  dom.streakValue.textContent = String(streak);
  dom.streakBarFill.style.width = `${Math.min(streak * 10, 100)}%`;
  dom.completedValue.textContent = String(state.completedCount);
  dom.completedBarFill.style.width = `${Math.min(state.completedCount * 5, 100)}%`;

  updateProgressText(progressPercent, remainingMs);
  updateMotivation(progressPercent);
  updateControls();
}

function updateProgressText(progressPercent, remainingMs) {
  if (remainingMs === 0 && getElapsedMs() > 0) {
    dom.progressText.textContent = "TARGET COMPLETE";
    return;
  }

  if (state.isRunning) {
    dom.progressText.textContent = `${progressPercent}% COMPLETE`;
    return;
  }

  if (state.elapsedBeforePause > 0) {
    dom.progressText.textContent = "PAUSED";
    return;
  }

  dom.progressText.textContent = "READY TO BEGIN";
}

function updateMotivation(progressPercent) {
  let index = 0;

  if (progressPercent >= 85) index = 6;
  else if (progressPercent >= 70) index = 5;
  else if (progressPercent >= 55) index = 4;
  else if (progressPercent >= 40) index = 3;
  else if (progressPercent >= 25) index = 2;
  else if (progressPercent >= 10) index = 1;

  if (index !== state.lastMotivationIndex) {
    state.lastMotivationIndex = index;
    dom.motivationText.textContent = motivations[index];
  }
}

function updateControls() {
  const hasProgress = state.elapsedBeforePause > 0 || state.isRunning;
  const complete = isGoalComplete();

  if (complete) {
    dom.mainActionText.textContent = "NEW FAST";
    dom.mainActionIcon.textContent = "⚡";
  } else if (state.isRunning) {
    dom.mainActionText.textContent = "KEEP GOING";
    dom.mainActionIcon.textContent = "⚡";
  } else if (state.elapsedBeforePause > 0) {
    dom.mainActionText.textContent = "RESUME FAST";
    dom.mainActionIcon.textContent = "⚡";
  } else {
    dom.mainActionText.textContent = "START FAST";
    dom.mainActionIcon.textContent = "⚡";
  }

  dom.pauseButton.disabled = !state.isRunning;
  dom.endButton.disabled = !hasProgress;
  dom.goalSelect.disabled = hasProgress;
}

function pulseMotivation() {
  const nextIndex = (state.lastMotivationIndex + 1) % motivations.length;
  state.lastMotivationIndex = nextIndex;
  dom.motivationText.textContent = motivations[nextIndex];

  dom.mainActionButton.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.02)" },
      { transform: "scale(1)" }
    ],
    { duration: 300, easing: "ease-out" }
  );
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
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatInputHours(hours) {
  return Number.isInteger(hours) ? String(hours) : String(Number(hours.toFixed(4)));
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateStreak(dateKeys) {
  const unique = new Set(dateKeys);
  let streak = 0;
  const cursor = new Date();

  if (!unique.has(getLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  for (let dayOffset = 0; dayOffset < 365; dayOffset += 1) {
    const key = getLocalDateKey(cursor);
    if (!unique.has(key)) break;

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
