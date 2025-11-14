// ============================================================
// Parle ou perd ! - js/ui.js (corrigé)
// ------------------------------------------------------------
// Gère l'affichage des écrans du jeu (menu, aide, options, jeu, pause, fin)
// et garantit qu'un seul écran est visible à la fois.
// ============================================================
(function () {
  "use strict";

  const STATE = (window.POP_STATE = window.POP_STATE || {});

  let currentScreen = null;

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((el) => {
      el.hidden = true;
    });
    const el = document.getElementById(id);
    if (el) {
      el.hidden = false;
      currentScreen = id;
    }
  }

  function showMenuScreen(bestScore) {
    const span = document.getElementById("menu-best-score");
    if (span && typeof bestScore === "number") {
      span.textContent = bestScore;
    }
    showScreen("screen-menu");
  }

  function showHelpScreen() {
    showScreen("screen-help");
  }

  function showOptionsScreen() {
    showScreen("screen-options");
  }

  function showGameScreen() {
    showScreen("screen-game");
  }

  function showPauseScreen() {
    showScreen("screen-pause");
  }

  function showGameOverScreen(stats) {
    if (stats) {
      document.getElementById("gameover-score").textContent = stats.score;
      document.getElementById("gameover-best").textContent = stats.bestScore;
      document.getElementById("gameover-best-streak").textContent = stats.bestStreak;
      document.getElementById("gameover-accuracy").textContent = stats.precisionPercent + "%";
      document.getElementById("gameover-feedback").textContent = stats.feedbackText || "";

      const block = document.getElementById("gameover-rewarded");
      if (block) block.hidden = !stats.canUseRewarded;
    }
    showScreen("screen-gameover");
  }

  function updateHUD(data) {
    document.getElementById("hud-score").textContent = data.score;
    document.getElementById("hud-best").textContent = data.bestScore;
    document.getElementById("hud-streak").textContent = data.streak;
  }

  function updateLastCommand(info) {
    const el = document.getElementById("hud-last-spoken");
    el.textContent = info.text;
    el.classList.remove("cmd-ok", "cmd-fail");
    if (info.recognized === true) el.classList.add("cmd-ok");
    if (info.recognized === false) el.classList.add("cmd-fail");
  }

  function updateMicStatus(status) {
    const el = document.getElementById("hud-mic-status");
    el.className = status.isListening ? "mic-ok" : "mic-off";
    el.title = status.errorCode ? status.errorMessage : (status.isListening ? "Micro actif" : "Micro inactif");
  }

  function onGameReady(data) {
    showMenuScreen(data.bestScore);
  }

  function onGamePaused() {
    showPauseScreen();
  }

  function onGameResumed() {
    showGameScreen();
  }

  function bindEvents() {
    document.getElementById("btn-menu-play").onclick = () => POP_Game?.startNewGame();
    document.getElementById("btn-menu-help").onclick = () => showHelpScreen();
    document.getElementById("btn-menu-options").onclick = () => showOptionsScreen();
    document.getElementById("btn-help-back").onclick = () => showMenuScreen();
    document.getElementById("btn-options-back").onclick = () => showMenuScreen();
    document.getElementById("btn-reset-record").onclick = () => {
      localStorage.removeItem(POP_CONFIG?.storageKeys?.bestScore);
      showMenuScreen(0);
    };
    document.getElementById("btn-pause-resume").onclick = () => POP_Game?.resumeGame();
    document.getElementById("btn-pause-restart").onclick = () => POP_Game?.startNewGame();
    document.getElementById("btn-pause-menu").onclick = () => showMenuScreen();
    document.getElementById("btn-gameover-restart").onclick = () => POP_Game?.startNewGame();
    document.getElementById("btn-gameover-menu").onclick = () => showMenuScreen();
    document.getElementById("btn-gameover-continue").onclick = () => POP_Game?.requestRewardedContinue();
  }

  function initUI() {
    bindEvents();
    showMenuScreen();
  }

  window.POP_UI = {
    initUI,
    showMenuScreen,
    showHelpScreen,
    showOptionsScreen,
    showGameScreen,
    showPauseScreen,
    showGameOverScreen,
    updateHUD,
    updateLastCommand,
    updateMicStatus,
    onGameReady,
    onGamePaused,
    onGameResumed
  };
})();
