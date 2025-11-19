// ============================================================
// Parle ou perd ! - js/ui.js
// ------------------------------------------------------------
// Rôle : gestion de l'interface utilisateur (navigation, HUD)
// N'affiche que les écrans ; le moteur et la voix sont lancés
// depuis game.js (startNewGame / initGame).
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
        // Stockage éventuel du volume dans la config globale
        if (window.POP_CONFIG) {
          window.POP_CONFIG.volume = volume;
        }
      });
    }

    if (sensitivitySelect) {
      sensitivitySelect.addEventListener("change", (e) => {
        const value = e.target.value;
        // Ici tu pourras relier la sensibilité au moteur / à la voix
        if (window.POP_CONFIG) {
          window.POP_CONFIG.sensitivity = value;
        }
      });
    }

    if (vibrationCheckbox) {
      vibrationCheckbox.addEventListener("change", (e) => {
        const enabled = e.target.checked;
        // Flag potentiellement utilisable côté moteur / feedback
        if (window.POP_CONFIG) {
          window.POP_CONFIG.vibration = enabled;
        }
      });
    }

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        if (window.confirm("Réinitialiser les options ?")) {
          if (volumeSlider) volumeSlider.value = 50;
          if (sensitivitySelect) sensitivitySelect.value = "normal";
          if (vibrationCheckbox) vibrationCheckbox.checked = true;

          if (window.POP_CONFIG) {
            window.POP_CONFIG.volume = 50;
            window.POP_CONFIG.sensitivity = "normal";
            window.POP_CONFIG.vibration = true;
          }
        }
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
      // ⚠️ Version simplifiée : l’UI s’occupe UNIQUEMENT d’afficher l’écran.
      // Le lancement du moteur (POP_Engine.init) et de la voix
      // est géré dans game.js (startNewGame).
      showScreen("game");
    },

    showGameOverScreen({ score, bestScore, bestStreak, precisionPercent }) {
      showScreen("gameover");

      const scoreEl = document.getElementById("gameover-score");
      const precisionEl = document.getElementById("gameover-precision");

      if (scoreEl) {
        scoreEl.textContent = `Score : ${score}`;
      }
      if (precisionEl) {
        precisionEl.textContent = `Précision : ${precisionPercent}%`;
      }

      // Si tu veux afficher bestScore / bestStreak plus tard :
      // document.getElementById("gameover-best")...
    },

    updateHUD({ score, bestScore, streak }) {
      const scoreEl = document.getElementById("hud-score");
      const bestEl = document.getElementById("hud-best");
      const streakEl = document.getElementById("hud-streak");

      if (scoreEl) scoreEl.textContent = score;
      if (bestEl) bestEl.textContent = bestScore;
      if (streakEl) streakEl.textContent = streak;
    },

    updateLastCommand({ text, recognized }) {
      const el = document.getElementById("hud-last-spoken");
      if (!el) return;
      el.textContent = text;
      el.style.color = recognized ? "lime" : "red";
    },

    onGameReady() {},
    onGamePaused() {},
    onGameResumed() {},

    attachOptionsListeners
  };

  document.addEventListener("DOMContentLoaded", () => {
    attachOptionsListeners();
  });
})();
