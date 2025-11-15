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

  function attachOptionsListeners() {
    const volumeSlider = document.getElementById("options-volume");
    const sensitivitySelect = document.getElementById("options-sensitivity");
    const vibrationCheckbox = document.getElementById("options-vibration");
    const resetButton = document.getElementById("options-reset");

    if (volumeSlider) {
      volumeSlider.addEventListener("input", (e) => {
        const volume = e.target.value;
        POP_CONFIG.volume = volume;
        // On pourrait appeler ici une fonction pour appliquer le volume
      });
    }

    if (sensitivitySelect) {
      sensitivitySelect.addEventListener("change", (e) => {
        const value = e.target.value;
        // Appliquer la sensibilité si nécessaire
      });
    }

    if (vibrationCheckbox) {
      vibrationCheckbox.addEventListener("change", (e) => {
        const enabled = e.target.checked;
        // Appliquer ou non la vibration
      });
    }

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        localStorage.removeItem(POP_CONFIG.storageKeys.bestScore);
        alert("Record réinitialisé !");
      });
    }
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
    onGameResumed() {},
    attachOptionsListeners
  };

  // Initialisation dès le chargement
  document.addEventListener("DOMContentLoaded", () => {
    attachOptionsListeners();
  });
})();
