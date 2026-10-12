(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const KEYS = { custom: "osnSpeedlab.custom.v1", history: "osnSpeedlab.history.v1", settings: "osnSpeedlab.settings.v1" };
  const state = { bank: [], custom: [], history: [], settings: { seconds: 10, count: "10", difficulty: "all" }, mode: "mental", questions: [], index: 0, results: [], selected: null, startedAt: 0, questionStartedAt: 0, timerId: null, deadline: 0, duration: 10, activeQuestion: null, lastRun: null, toastId: null };
  const screens = ["homeScreen", "quizScreen", "resultsScreen", "statsScreen"];
  const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || min));
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const normalizeAnswer = (v) => String(v ?? "").trim().replace(/\s+/g, " ").toLowerCase();

  // MathJax is loaded asynchronously, so queue elements until it is ready.
  const pendingMathElements = new Set();
  let mathLoadListenerRegistered = false;
  let mathTypesetQueue = Promise.resolve();
  function typesetMath(element) {
    if (!element) return;
    const mathJax = window.MathJax;
    if (!mathJax || typeof mathJax.typesetPromise !== "function") {
      pendingMathElements.add(element);
      const script = $("mathjax-script");
      if (script && !mathLoadListenerRegistered) {
        mathLoadListenerRegistered = true;
        script.addEventListener("load", () => {
          mathLoadListenerRegistered = false;
          const queued = [...pendingMathElements];
          pendingMathElements.clear();
          queued.forEach(typesetMath);
        }, { once: true });
        script.addEventListener("error", () => {
          mathLoadListenerRegistered = false;
          console.error("MathJax failed to load. LaTeX rendering requires a network connection.");
        }, { once: true });
      }
      return;
    }

    mathTypesetQueue = mathTypesetQueue.then(async () => {
      await mathJax.startup?.promise;
      if (!element.isConnected) return;
      // Clear any previous MathJax bookkeeping before re-rendering changing content.
      mathJax.typesetClear?.([element]);
      await mathJax.typesetPromise([element]);
    }).catch(error => console.error("Unable to render LaTeX:", error));
  }
  const readJSON = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } };
  const saveJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast("Browser storage is full; export your data or remove older entries."); } };
  function showScreen(id) { screens.forEach(s => $(s).classList.toggle("hidden", s !== id)); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function toast(message) { const el = $("toast"); el.textContent = message; el.classList.add("show"); clearTimeout(state.toastId); state.toastId = setTimeout(() => el.classList.remove("show"), 2400); }
  function setSeconds(value) { state.settings.seconds = clamp(value, 3, 120); $("timeLimit").value = state.settings.seconds; document.querySelectorAll(".preset").forEach(b => b.classList.toggle("active", Number(b.dataset.seconds) === state.settings.seconds)); saveJSON(KEYS.settings, state.settings); }
  function modeName(mode) { return ({ mental: "Mental Math", method: "Method Recall", mixed: "Mixed Mode" })[mode] || "Mixed Mode"; }
  function validQuestion(q) {
    if (!q || typeof q !== "object" || !String(q.question || "").trim() || !String(q.answer ?? "").trim()) return false;
    if (!["mental", "method"].includes(q.mode)) return false;
    if (!["multiple", "numeric"].includes(q.type)) return false;
    if (q.type === "multiple" && (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6)) return false;
    if (q.type === "multiple" && !q.options.some(o => normalizeAnswer(o) === normalizeAnswer(q.answer))) return false;
    return true;
  }
  function cleanQuestion(q, index = 0) {
    return { id: String(q.id || `q-${Date.now()}-${index}`), mode: q.mode, topic: String(q.topic || "General"), difficulty: ["Easy", "Medium", "Hard"].includes(q.difficulty) ? q.difficulty : "Medium", type: q.type, question: String(q.question).trim(), ...(q.type === "multiple" ? { options: q.options.map(String) } : {}), answer: String(q.answer).trim(), explanation: String(q.explanation || ""), timeMultiplier: clamp(q.timeMultiplier ?? 1, 0.25, 5), tags: Array.isArray(q.tags) ? q.tags.map(String) : [] };
  }
  async function init() {
    state.custom = readJSON(KEYS.custom, []);
    state.history = readJSON(KEYS.history, []);
    state.settings = { ...state.settings, ...readJSON(KEYS.settings, {}) };
    setSeconds(state.settings.seconds);
    $("questionCount").value = state.settings.count || "10";
    $("difficulty").value = state.settings.difficulty || "all";
    try {
      const response = await fetch("questions.json");
      if (!response.ok) throw new Error("Could not load question bank");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Question bank must be a JSON array");
      state.bank = data.filter(validQuestion).map((q, i) => cleanQuestion(q, i));
    } catch (error) {
      state.bank = [];
      toast("Built-in question bank couldn't load. Open via GitHub Pages or a local server, not file://.");
      console.error(error);
    }
    bindEvents();
  }
  function bindEvents() {
    document.querySelectorAll(".mode-card").forEach(button => button.addEventListener("click", () => { state.mode = button.dataset.mode; document.querySelectorAll(".mode-card").forEach(b => b.classList.toggle("chosen", b === button)); toast(`${modeName(state.mode)} selected`); }));
    $("timeMinus").addEventListener("click", () => setSeconds(state.settings.seconds - 1));
    $("timePlus").addEventListener("click", () => setSeconds(state.settings.seconds + 1));
    document.querySelectorAll(".preset").forEach(b => b.addEventListener("click", () => setSeconds(b.dataset.seconds)));
    $("timeLimit").addEventListener("change", e => setSeconds(e.target.value));
    $("questionCount").addEventListener("change", e => { state.settings.count = e.target.value; saveJSON(KEYS.settings, state.settings); });
    $("difficulty").addEventListener("change", e => { state.settings.difficulty = e.target.value; saveJSON(KEYS.settings, state.settings); });
    $("startBankButton").addEventListener("click", startBank);
    $("customButton").addEventListener("click", openCustom);
    $("importButton").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", importBank);
    $("customType").addEventListener("change", () => $("customOptionsGroup").classList.toggle("hidden", $("customType").value !== "multiple"));
    $("customForm").addEventListener("submit", saveCustom);
    $("closeCustom").addEventListener("click", closeCustom); $("cancelCustom").addEventListener("click", closeCustom);
    $("submitButton").addEventListener("click", () => submitAnswer("answer"));
    $("quitButton").addEventListener("click", quitSession);
    $("retryButton").addEventListener("click", () => state.lastRun ? startSession(state.lastRun.questions, state.lastRun.mode) : showScreen("homeScreen"));
    $("homeButton").addEventListener("click", () => showScreen("homeScreen"));
    $("homeLink").addEventListener("click", e => { e.preventDefault(); if (state.timerId) clearInterval(state.timerId); showScreen("homeScreen"); });
    $("statsButton").addEventListener("click", showStats);
    $("reviewButton").addEventListener("click", showStats);
    $("statsHomeButton").addEventListener("click", () => showScreen("homeScreen"));
    $("clearHistoryButton").addEventListener("click", () => { if (confirm("Delete all saved session results from this browser?")) { state.history = []; saveJSON(KEYS.history, []); renderStats(); toast("Saved results cleared."); } });
    document.addEventListener("keydown", handleKeyboard);
  }
  function startBank() {
    const difficulty = $("difficulty").value, count = $("questionCount").value;
    let pool = [...state.bank, ...state.custom];
    if (state.mode !== "mixed") pool = pool.filter(q => q.mode === state.mode);
    if (difficulty !== "all") pool = pool.filter(q => q.difficulty === difficulty);
    if (!pool.length) { toast("No questions match these settings. Try another mode or difficulty."); return; }
    pool = shuffle(pool);
    const amount = count === "all" ? pool.length : Math.min(Number(count), pool.length);
    if (amount < Number(count) && count !== "all") toast(`Only ${amount} matching question(s) available.`);
    startSession(pool.slice(0, amount), state.mode);
  }
  function shuffle(items) { for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } return items; }
  function startSession(questions, mode) {
    if (state.timerId) clearInterval(state.timerId);
    state.mode = mode; state.questions = questions.map(q => cleanQuestion(q)); state.index = 0; state.results = []; state.startedAt = Date.now();
    state.lastRun = { questions: state.questions.map(q => ({ ...q })), mode };
    showScreen("quizScreen"); renderQuestion();
  }
  function renderQuestion() {
    if (state.index >= state.questions.length) return finishSession();
    const q = state.questions[state.index];
    state.activeQuestion = q; state.selected = null; state.questionStartedAt = Date.now(); state.duration = clamp(state.settings.seconds * (q.timeMultiplier ?? 1), 1, 600); state.deadline = Date.now() + state.duration * 1000;
    $("quizModeLabel").textContent = modeName(state.mode).toUpperCase();
    $("questionCounter").textContent = `${String(state.index + 1).padStart(2, "0")} / ${state.questions.length}`;
    $("progressBar").style.width = `${(state.index / state.questions.length) * 100}%`;
    $("topicLabel").textContent = q.topic.toUpperCase(); $("difficultyLabel").textContent = q.difficulty.toUpperCase();
    $("questionText").textContent = q.question; $("questionStatus").textContent = "Answer before the timer reaches zero.";
    $("submitButton").disabled = false; $("submitButton").classList.toggle("hidden", q.type === "multiple"); $("submitButton").innerHTML = 'Submit answer <span>↗</span>';
    $("answerArea").innerHTML = "";
    if (q.type === "multiple") {
      q.options.forEach((option, index) => {
        const button = document.createElement("button"); button.type = "button"; button.className = "answer-option"; button.dataset.option = option;
        button.innerHTML = `<span class="option-key">${index + 1}</span><span>${escapeHTML(option)}</span>`;
        button.addEventListener("click", () => { if (!$("submitButton").disabled) { selectOption(option); submitAnswer("answer"); } }); $("answerArea").appendChild(button);
      });
    } else {
      const input = document.createElement("input"); input.type = "text"; input.inputMode = "decimal"; input.autocomplete = "off"; input.id = "numericInput"; input.className = "numeric-answer"; input.placeholder = "Type your answer…"; input.setAttribute("aria-label", "Numerical answer");
      input.addEventListener("input", () => { state.selected = input.value; }); input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submitAnswer("answer"); } }); $("answerArea").appendChild(input);
      setTimeout(() => input.focus({ preventScroll: true }), 50);
    }
    // Typeset both the prompt and the answer area after their content has been inserted.
    typesetMath($("questionText"));
    typesetMath($("answerArea"));
    updateLiveStats(); tickTimer();
    state.timerId = setInterval(tickTimer, 100);
  }
  function selectOption(option) {
    if (!state.activeQuestion || $("submitButton").disabled) return;
    state.selected = option;
    document.querySelectorAll(".answer-option").forEach(b => b.classList.toggle("selected", b.dataset.option === option));
  }
  function tickTimer() {
    const remaining = Math.max(0, (state.deadline - Date.now()) / 1000);
    $("timerNumber").textContent = remaining.toFixed(1);
    const fraction = Math.max(0, remaining / state.duration);
    $("ringProgress").style.strokeDashoffset = String(113.1 * (1 - fraction));
    $("timerRing").classList.toggle("urgent", remaining <= Math.min(3, state.duration * .25));
    if (remaining <= 0) { clearInterval(state.timerId); state.timerId = null; submitAnswer("timeout"); }
  }
  function submitAnswer(reason) {
    if (!state.activeQuestion || $("submitButton").disabled) return;
    if (state.timerId) clearInterval(state.timerId); state.timerId = null;
    const q = state.activeQuestion, elapsed = Math.min(state.duration, (Date.now() - state.questionStartedAt) / 1000);
    const timedOut = reason === "timeout", given = timedOut ? "" : String(state.selected ?? "").trim();
    const correct = !timedOut && given !== "" && normalizeAnswer(given) === normalizeAnswer(q.answer);
    state.results.push({ question: q, given, correct, timedOut, seconds: elapsed });
    $("submitButton").disabled = true; document.querySelectorAll(".answer-option").forEach(b => b.disabled = true); $("questionStatus").textContent = timedOut ? "Time's up. Moving on…" : correct ? "Answer locked. Moving on…" : "Answer locked. Moving on…";
    updateLiveStats();
    setTimeout(() => { state.index++; renderQuestion(); }, 450);
  }
  function updateLiveStats() {
    const attempted = state.results.length, correct = state.results.filter(r => r.correct).length;
    const avg = attempted ? state.results.reduce((s, r) => s + r.seconds, 0) / attempted : 0;
    $("liveScore").innerHTML = `${correct} <small>/ ${attempted}</small>`;
    $("liveAccuracy").textContent = attempted ? `${Math.round(correct / attempted * 100)}%` : "—";
    $("liveAverage").textContent = attempted ? `${avg.toFixed(1)}s` : "—";
  }
  function finishSession() {
    if (state.timerId) clearInterval(state.timerId); state.timerId = null;
    const total = state.results.length, correct = state.results.filter(r => r.correct).length, timeouts = state.results.filter(r => r.timedOut).length;
    const avg = total ? state.results.reduce((s, r) => s + r.seconds, 0) / total : 0;
    const run = { id: `run-${Date.now()}`, date: new Date().toISOString(), mode: state.mode, total, correct, accuracy: total ? Math.round(correct / total * 100) : 0, average: Number(avg.toFixed(2)), timeouts, duration: Math.round((Date.now() - state.startedAt) / 1000), results: state.results };
    state.history.unshift(run); state.history = state.history.slice(0, 100); saveJSON(KEYS.history, state.history);
    $("progressBar").style.width = "100%"; $("resultTitle").textContent = run.accuracy >= 90 ? "Excellent execution." : run.accuracy >= 70 ? "Solid reps." : "Find the pattern.";
    $("resultSubtitle").textContent = `${modeName(state.mode)} · ${new Date(run.date).toLocaleString()} · ${run.duration}s total session time`;
    $("resultScore").textContent = `${correct}/${total}`; $("resultAccuracy").textContent = `${run.accuracy}%`; $("resultAverage").textContent = `${avg.toFixed(1)}s`; $("resultTimeouts").textContent = timeouts;
    $("reviewCount").textContent = `${total} ITEMS`; renderReview(run.results); showScreen("resultsScreen");
  }
  function renderReview(results) {
    $("reviewList").innerHTML = "";
    results.forEach((r, i) => {
      const status = r.timedOut ? "TIMEOUT" : r.correct ? "CORRECT" : "INCORRECT";
      const cls = r.timedOut ? "timeout" : r.correct ? "correct" : "wrong";
      const item = document.createElement("article"); item.className = "review-item";
      item.innerHTML = `<div class="review-item-top"><span class="muted small">${String(i + 1).padStart(2, "0")} / ${escapeHTML(r.question.topic)} · ${r.seconds.toFixed(1)}s</span><span class="review-status ${cls}">${status}</span></div><h3>${escapeHTML(r.question.question)}</h3><p class="review-answer"><strong>Your answer:</strong> ${r.given ? escapeHTML(r.given) : "No answer"}</p><p class="review-answer"><strong>Correct answer:</strong> ${escapeHTML(r.question.answer)}</p>${r.question.explanation ? `<p class="review-explanation"><strong>Explanation:</strong> ${escapeHTML(r.question.explanation)}</p>` : ""}`;
      $("reviewList").appendChild(item);
    });
    typesetMath($("reviewList"));
  }
  function quitSession() {
    if (!confirm("Exit this session? Your unfinished session will not be saved.")) return;
    if (state.timerId) clearInterval(state.timerId); state.timerId = null; state.activeQuestion = null; showScreen("homeScreen");
  }
  function openCustom() {
    $("customForm").reset(); $("customMultiplier").value = 1; $("customMode").value = state.mode === "method" ? "method" : "mental"; $("customOptionsGroup").classList.remove("hidden"); $("customDialog").showModal(); setTimeout(() => $("customQuestion").focus(), 30);
  }
  function closeCustom() { if ($("customDialog").open) $("customDialog").close(); }
  function saveCustom(event) {
    event.preventDefault();
    const type = $("customType").value, options = $("customOptions").value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const q = { id: `custom-${Date.now()}`, mode: $("customMode").value, topic: $("customTopic").value.trim(), difficulty: "Medium", type, question: $("customQuestion").value.trim(), ...(type === "multiple" ? { options } : {}), answer: $("customAnswer").value.trim(), explanation: $("customExplanation").value.trim(), timeMultiplier: clamp($("customMultiplier").value || 1, 0.25, 5), tags: ["custom"] };
    if (type === "multiple" && (options.length < 2 || options.length > 6)) { toast("Add between 2 and 6 options, one per line."); return; }
    if (type === "multiple" && !options.some(o => normalizeAnswer(o) === normalizeAnswer(q.answer))) { toast("Correct answer must match one of the options exactly."); return; }
    if (!validQuestion(q)) { toast("Please check the question and answer fields."); return; }
    state.custom.unshift(cleanQuestion(q)); saveJSON(KEYS.custom, state.custom); closeCustom(); toast("Custom question saved to this browser.");
    if (confirm("Start a session with this custom question now?")) startSession([q], q.mode);
  }
  async function importBank(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error("The JSON file must contain an array of question objects.");
      const valid = parsed.filter(validQuestion).map((q, i) => cleanQuestion(q, i));
      if (!valid.length) throw new Error("No valid questions found. Check the format in questions.json.");
      state.custom = [...valid, ...state.custom]; saveJSON(KEYS.custom, state.custom); toast(`Imported ${valid.length} question(s) into this browser.`);
    } catch (error) { alert(`Import failed: ${error.message}`); }
    event.target.value = "";
  }
  function showStats() { renderStats(); showScreen("statsScreen"); }
  function renderStats() {
    const runs = state.history, totalQ = runs.reduce((s, r) => s + r.total, 0), totalCorrect = runs.reduce((s, r) => s + r.correct, 0), avgAccuracy = totalQ ? Math.round(totalCorrect / totalQ * 100) : 0, avgTime = totalQ ? runs.reduce((s, r) => s + r.average * r.total, 0) / totalQ : 0;
    $("historySummary").innerHTML = `<div class="result-stat"><span>SESSIONS</span><strong>${runs.length}</strong></div><div class="result-stat"><span>QUESTIONS ANSWERED</span><strong>${totalQ}</strong></div><div class="result-stat"><span>OVERALL ACCURACY</span><strong>${avgAccuracy}%</strong></div><div class="result-stat"><span>AVG. RESPONSE</span><strong>${avgTime.toFixed(1)}s</strong></div>`;
    $("historyList").innerHTML = "";
    if (!runs.length) { $("historyList").innerHTML = '<div class="empty-state">No saved sessions yet. Complete a quiz and your history will appear here.</div>'; return; }
    runs.forEach(run => {
      const row = document.createElement("div"); row.className = "history-item";
      row.innerHTML = `<div><strong>${escapeHTML(modeName(run.mode))}</strong><p>${new Date(run.date).toLocaleString()} · ${run.total} questions · ${run.timeouts} timeouts</p></div><div class="history-score">${run.accuracy}% <span class="muted small">${run.correct}/${run.total}</span></div>`;
      $("historyList").appendChild(row);
    });
  }
  function handleKeyboard(event) {
    if (!$("quizScreen").classList.contains("hidden")) {
      if (event.key === "Escape") { event.preventDefault(); quitSession(); return; }
      if (state.activeQuestion?.type === "multiple" && /^[1-6]$/.test(event.key)) {
        const option = state.activeQuestion.options[Number(event.key) - 1]; if (option !== undefined && !$("submitButton").disabled) { selectOption(option); submitAnswer("answer"); event.preventDefault(); }
      }
      if (event.key === "Enter" && event.target.tagName !== "INPUT" && !event.target.closest("button")) { event.preventDefault(); submitAnswer("answer"); }
    }
  }
  init();
})();