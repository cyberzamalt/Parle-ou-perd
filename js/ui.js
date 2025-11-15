// ============================================================
// Parle ou perd ! - js/ui.js
// ------------------------------------------------------------
// Rôle : gestion de l'interface utilisateur (navigation, HUD)
// Lance le jeu uniquement après que le micro est prêt
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
    const volumeSlider = document.getElementById("option-volume");
    const sensitivitySelect = document.getElementById("option-mic-sensitivity");
    const vibrationCheckbox = document.getElementById("option-vibration");
    const resetButton = document.getElementById("option-reset-record");

    if (volumeSlider) {
      volumeSlider.addEventListener("input", (e) => {
        POP_CONFIG.volume = e.target.value;
      });
    }

    if (sensitivitySelect) {
      sensitivitySelect.addEventListener("change", (e) => {
        POP_Voice.setSensitivity(e.target.value);
      });
    }

    if (vibrationCheckbox) {
      vibrationCheckbox.addEventListener("change", (e) => {
        // à brancher si nécessaire
      });
    }

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        localStorage.removeItem(POP_CONFIG.storageKeys.bestScore);
        alert("Record réinitialisé !");
      });
    }
  }

  function waitForMicReady(callback, timeout = 5000) {
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.POP_STATE?.voice?.ready || Date.now() - start > timeout) {
        clearInterval(interval);
        callback();
      }
    }, 100);
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
      if (POP_Voice?.startListening) {
        POP_Voice.startListening();
      }
      waitForMicReady(() => {
        if (POP_Engine?.init) {
          POP_Engine.init();
        }
      });
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
    attachOptionsListeners
  };

  document.addEventListener("DOMContentLoaded", () => {
    attachOptionsListeners();
  });
})();
