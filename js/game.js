// ============================================================
// Parle ou perd ! - js/game.js (corrigé)
// ------------------------------------------------------------
// Rôle : moteur principal du jeu (logique, score, séquence, etc.)
// ============================================================
(function () {
  "use strict";

  const CONFIG = window.POP_CONFIG || {};
  const STATE = (window.POP_STATE = window.POP_STATE || {});

  let score = 0;
  let bestScore = 0;
  let streak = 0;

  let goodCommands = 0;
  let badCommands = 0;

  let isRunning = false;

  function initGame() {
    console.log("[game] initGame()");
    score = 0;
    streak = 0;
    goodCommands = 0;
    badCommands = 0;
    isRunning = false;

    try {
      bestScore = parseInt(localStorage.getItem(CONFIG.storageKeys.bestScore)) || 0;
    } catch (e) {
      bestScore = 0;
    }

    if (window.POP_UI?.onGameReady) {
      window.POP_UI.onGameReady({ bestScore });
    }
  }

  function startNewGame() {
    console.log("[game] startNewGame()");
    score = 0;
    streak = 0;
    goodCommands = 0;
    badCommands = 0;
    isRunning = true;

    if (window.POP_UI?.showGameScreen) window.POP_UI.showGameScreen();
    updateHUD();
  }

  function simulateCommand(cmd) {
    if (!isRunning) return;
    const valid = ["saute", "baisse", "gauche", "droite"];
    const isGood = valid.includes(cmd.toLowerCase());

    if (isGood) {
      score++;
      streak++;
      goodCommands++;
    } else {
      streak = 0;
      badCommands++;
    }

    if (score > bestScore) {
      bestScore = score;
      try {
        localStorage.setItem(CONFIG.storageKeys.bestScore, bestScore);
      } catch (e) {}
    }

    if (window.POP_UI?.updateLastCommand) {
      window.POP_UI.updateLastCommand({ text: cmd, recognized: isGood });
    }

    updateHUD();

    if (!isGood) {
      endGame();
    }
  }

  function updateHUD() {
    if (window.POP_UI?.updateHUD) {
      window.POP_UI.updateHUD({ score, bestScore, streak });
    }
  }

  function endGame() {
    if (!isRunning) return; // ❌ empêche double fin
    console.log("[game] endGame()");
    isRunning = false;

    const total = goodCommands + badCommands;
    const percent = total > 0 ? Math.round((goodCommands / total) * 100) : 0;

    if (window.POP_UI?.showGameOverScreen) {
      window.POP_UI.showGameOverScreen({
        score,
        bestScore,
        bestStreak: streak,
        precisionPercent: percent,
        canUseRewarded: true
      });
    }
  }

  function resumeGame() {
    isRunning = true;
    if (window.POP_UI?.onGameResumed) window.POP_UI.onGameResumed();
  }

  function pauseGame() {
    if (!isRunning) return;
    isRunning = false;
    if (window.POP_UI?.onGamePaused) window.POP_UI.onGamePaused();
  }

  function getStateSnapshot() {
    return { score, bestScore, streak, isRunning };
  }

  function requestRewardedContinue() {
    if (!window.POP_Ads?.showRewarded) return;
    window.POP_Ads.showRewarded(() => {
      console.log("[game] rewarded OK, on continue");
      isRunning = true;
      if (window.POP_UI?.showGameScreen) window.POP_UI.showGameScreen();
    });
  }

  window.POP_Game = {
    initGame,
    startNewGame,
    resumeGame,
    pauseGame,
    getStateSnapshot,
    simulateCommand,
    requestRewardedContinue
  };
})();
