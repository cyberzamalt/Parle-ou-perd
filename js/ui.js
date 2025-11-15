// ============================================================
// Parle ou perd ! - js/ui.js
// ------------------------------------------------------------
// Rôle : gestion de l'interface utilisateur (navigation, HUD)
// ============================================================
(function () {
  "use strict";

  const screens = {
    menu: document.getElementById("screen-menu"),
    options: document.getElementById("screen-options"),
    help: document.getElementById("screen-help"),
    game: document.getElementById("screen-game"),
    gameover: document.getElementById("screen-gameover")
  };

  function showScreen(key) {
    Object.values(screens).forEach((el) => (el.hidden = true));
    if (screens[key]) screens[key].hidden = false;
  }

  window.POP_UI = {
    showMenuScreen() {
      showScreen("menu");
    },
    showOptionsScreen() {
      showScreen("options");
    },
    showHelpScreen() {
      showScreen("help");
    },
    showGameScreen() {
      showScreen("game");
    },
    showGameOverScreen({ score, bestScore, bestStreak, precisionPercent }) {
      showScreen("gameover");
      document.getElementById("gameover-score").textContent = `Score : ${score}`;
      document.getElementById("gameover-precision").textContent = `Précision : ${precisionPercent}%`;
    },
    updateHUD({ score, bestScore, streak }) {
      document.getElementById("hud-score").textContent = score;
      document.getElementById("hud-best").textContent = bestScore;
      document.getElementById("hud-streak").textContent = streak;
    },
    updateLastCommand({ text, recognized }) {
      const el = document.getElementById("hud-last-spoken");
      el.textContent = text;
      el.style.color = recognized ? "lime" : "red";
    },
    onGameReady() {},
    onGamePaused() {},
    onGameResumed() {}
  };
})();
