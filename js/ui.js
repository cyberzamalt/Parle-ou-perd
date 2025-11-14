// ============================================================
// Parle ou perd ! - js/ui.js
// ------------------------------------------------------------
// Rôle : gérer les écrans, les boutons, le HUD et les options.
//
// ⚠ Très important : ce fichier est calé sur TON index.html :
//
// ÉCRANS :
//   #screen-menu
//   #screen-help
//   #screen-options
//   #screen-game
//   #screen-pause
//   #screen-gameover
//
// BOUTONS :
//   Menu :
//     #btn-menu-play
//     #btn-menu-options
//     #btn-menu-help
//
//   Aide :
//     #btn-help-back
//
//   Options :
//     #btn-options-back
//     #btn-reset-record
//
//   Pause :
//     #btn-pause-resume
//     #btn-pause-restart
//     #btn-pause-menu
//
//   Game Over :
//     #btn-gameover-continue
//     #btn-gameover-restart
//     #btn-gameover-menu
//
// HUD (dans screen-game) :
//   #hud-score
//   #hud-best
//   #hud-streak
//   #hud-mic-status   (icône ●)
//   #hud-last-spoken  (“Dernière commande”)
//
// MENU record :
//   #menu-best-score  (le nombre dans “Record : X commande réussie”)
//
// GAME OVER :
//   #gameover-score
//   #gameover-best
//   #gameover-best-streak
//   #gameover-accuracy
//   #gameover-feedback
//   #gameover-rewarded (bloc continue pub)
//
// Ce module parle avec :
//   - POP_Game (logique)    → startNewGame, pauseGame, resumeGame…
–   - POP_Voice (micro)     → startListening, stopListening, setSensitivity
//   - POP_Ads (pub)         → showBanner(screenName)
// ============================================================
(function () {
  "use strict";

  // ----------------------------------------------------------
  // 1. Raccourcis vers config & état global
  // ----------------------------------------------------------
  var CONFIG = window.POP_CONFIG || {};
  var TEXTS = CONFIG.texts || {};
  var ADS_CFG = CONFIG.ads || {};
  var STORAGE_KEYS = CONFIG.storageKeys || {};
  var DEFAULT_OPTIONS = CONFIG.defaultOptions || {
    volume: 0.8,
    micSensitivity:
      (CONFIG.voice && CONFIG.voice.defaultSensitivity) || "medium",
    vibration: true
  };

  var GLOBAL_STATE = (window.POP_STATE = window.POP_STATE || {});
  GLOBAL_STATE.ui = GLOBAL_STATE.ui || {};

  var uiState = {
    domBound: false,
    lastKnownBestScore: 0,
    lastMicStatus: null,
    lastCommandText: "–",
    options: null
  };

  var dom = {
    screens: {},
    buttons: {},
    hud: {},
    menu: {},
    options: {},
    gameover: {}
  };

  var pendingOnGameReadyPayload = null;

  // ----------------------------------------------------------
  // 2. Helpers DOM
  // ----------------------------------------------------------
  function $(id) {
    return document.getElementById(id);
  }

  // ----------------------------------------------------------
  // 3. Options (localStorage) + lien avec voice.js
  // ----------------------------------------------------------
  var OPTIONS_KEY = STORAGE_KEYS.options || "pop_options_v1";

  function loadOptions() {
    try {
      var raw = localStorage.getItem(OPTIONS_KEY);
      if (!raw) {
        return {
          volume: DEFAULT_OPTIONS.volume,
          micSensitivity: DEFAULT_OPTIONS.micSensitivity,
          vibration: DEFAULT_OPTIONS.vibration
        };
      }
      var parsed = JSON.parse(raw);
      return {
        volume:
          typeof parsed.volume === "number"
            ? parsed.volume
            : DEFAULT_OPTIONS.volume,
        micSensitivity:
          parsed.micSensitivity || DEFAULT_OPTIONS.micSensitivity,
        vibration:
          typeof parsed.vibration === "boolean"
            ? parsed.vibration
            : DEFAULT_OPTIONS.vibration
      };
    } catch (e) {
      console.warn("[ui] Impossible de charger les options, valeurs par défaut.", e);
      return {
        volume: DEFAULT_OPTIONS.volume,
        micSensitivity: DEFAULT_OPTIONS.micSensitivity,
        vibration: DEFAULT_OPTIONS.vibration
      };
    }
  }

  function saveOptions(opts) {
    uiState.options = opts;
    GLOBAL_STATE.options = opts;
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(opts));
    } catch (e) {
      console.warn("[ui] Impossible d’enregistrer les options.", e);
    }
  }

  function applyOptionsToControls() {
    if (!uiState.domBound || !uiState.options) return;
    var opts = uiState.options;

    if (dom.options.volume) {
      dom.options.volume.value = Math.round((opts.volume || 0) * 100);
    }
    if (dom.options.micSens) {
      dom.options.micSens.value = String(opts.micSensitivity);
    }
    if (dom.options.vibration) {
      dom.options.vibration.checked = !!opts.vibration;
    }
  }

  function applyOptionsToSystems() {
    if (!uiState.options) return;
    var opts = uiState.options;

    // Micro
    if (window.POP_Voice && typeof POP_Voice.setSensitivity === "function") {
      POP_Voice.setSensitivity(opts.micSensitivity);
    }

    // Volume / vibration : on garde pour plus tard (sons, vibration native…)
  }

  // ----------------------------------------------------------
  // 4. Gestion des pubs (bannière) selon l’écran
  // ----------------------------------------------------------
  function updateBannerForScreen(screenName) {
    if (!ADS_CFG || ADS_CFG.enabled === false) return;
    if (!window.POP_Ads || typeof POP_Ads.showBanner !== "function") return;
    // ads.js se charge de regarder bannerScreens[placement]
    POP_Ads.showBanner(screenName);
  }

  // ----------------------------------------------------------
  // 5. Affichage des écrans
  // ----------------------------------------------------------
  function showScreen(screenName) {
    if (!uiState.domBound) return;

    var s = dom.screens;
    Object.keys(s).forEach(function (key) {
      if (!s[key]) return;
      s[key].hidden = key !== screenName;
    });

    GLOBAL_STATE.ui.currentScreen = screenName;
    updateBannerForScreen(screenName);
  }

  function showMenuScreen(bestScore) {
    if (typeof bestScore === "number" && isFinite(bestScore)) {
      uiState.lastKnownBestScore = bestScore;
    }
    if (dom.menu.bestScoreSpan) {
      dom.menu.bestScoreSpan.textContent = String(uiState.lastKnownBestScore);
    }
    showScreen("menu");
  }

  function showHelpScreen() {
    showScreen("help");
  }

  function showOptionsScreen() {
    applyOptionsToControls();
    showScreen("options");
  }

  function showGameScreen() {
    showScreen("game");
    // Micro ON en jeu
    if (window.POP_Voice && typeof POP_Voice.startListening === "function") {
      POP_Voice.startListening();
    }
  }

  function showPauseScreen() {
    showScreen("pause");
    // En pause, on peut couper le micro pour éviter les faux positifs
    if (window.POP_Voice && typeof POP_Voice.stopListening === "function") {
      POP_Voice.stopListening();
    }
  }

  function showGameOverScreen(endStats) {
    endStats = endStats || {};

    // Micro OFF
    if (window.POP_Voice && typeof POP_Voice.stopListening === "function") {
      POP_Voice.stopListening();
    }

    if (typeof endStats.bestScore === "number") {
      uiState.lastKnownBestScore = endStats.bestScore;
    }

    if (dom.gameover.score) {
      dom.gameover.score.textContent =
        endStats.score != null ? endStats.score : 0;
    }
    if (dom.gameover.best) {
      dom.gameover.best.textContent =
        endStats.bestScore != null
          ? endStats.bestScore
          : uiState.lastKnownBestScore;
    }
    if (dom.gameover.bestStreak) {
      dom.gameover.bestStreak.textContent =
        endStats.bestStreak != null ? endStats.bestStreak : 0;
    }
    if (dom.gameover.accuracy) {
      var p =
        endStats.precisionPercent != null ? endStats.precisionPercent : 0;
      dom.gameover.accuracy.textContent = p + " %";
    }

    // Feedback : si game.js ne fournit pas feedbackText, on recalcule ici
    var feedbackText = endStats.feedbackText || "";
    if (!feedbackText && TEXTS && Array.isArray(TEXTS.feedbackByScore)) {
      var score = endStats.score != null ? endStats.score : 0;
      var fbList = TEXTS.feedbackByScore;
      for (var i = 0; i < fbList.length; i++) {
        if (score <= fbList[i].maxScore) {
          feedbackText = fbList[i].text;
          break;
        }
      }
    }
    if (dom.gameover.feedback) {
      dom.gameover.feedback.textContent = feedbackText || "";
    }

    // Bloc “CONTINUER (PUB)”
    if (dom.gameover.rewardBlock && dom.gameover.btnContinue) {
      var canUseRewarded = !!endStats.canUseRewarded;
      dom.gameover.rewardBlock.hidden = !canUseRewarded;
    }

    showScreen("gameover");
  }

  // ----------------------------------------------------------
  // 6. Callbacks appelés par le moteur / la voix
  // ----------------------------------------------------------
  function onGameReady(payload) {
    if (!uiState.domBound) {
      pendingOnGameReadyPayload = payload || {};
      if (payload && typeof payload.bestScore === "number") {
        uiState.lastKnownBestScore = payload.bestScore;
      }
      return;
    }
    var best =
      payload && typeof payload.bestScore === "number"
        ? payload.bestScore
        : uiState.lastKnownBestScore;
    showMenuScreen(best);
  }

  function onGamePaused() {
    showPauseScreen();
  }

  function onGameResumed() {
    showGameScreen();
  }

  function updateHUD(hudData) {
    if (!uiState.domBound) return;
    hudData = hudData || {};

    if (dom.hud.score) {
      dom.hud.score.textContent =
        hudData.score != null ? hudData.score : 0;
    }
    if (dom.hud.best) {
      var best =
        hudData.bestScore != null
          ? hudData.bestScore
          : uiState.lastKnownBestScore;
      dom.hud.best.textContent = best;
      uiState.lastKnownBestScore = best;
    }
    if (dom.hud.streak) {
      dom.hud.streak.textContent =
        hudData.streak != null ? hudData.streak : 0;
    }
  }

  function updateLastCommand(info) {
    if (!uiState.domBound) return;
    info = info || {};
    var text = info.text || "–";
    uiState.lastCommandText = text;

    if (dom.hud.lastCommand) {
      dom.hud.lastCommand.textContent = text;
      dom.hud.lastCommand.classList.remove("cmd-ok", "cmd-fail");
      if (info.recognized === true) {
        dom.hud.lastCommand.classList.add("cmd-ok");
      } else if (info.recognized === false) {
        dom.hud.lastCommand.classList.add("cmd-fail");
      }
    }
  }

  function updateMicStatus(info) {
    info = info || {};
    uiState.lastMicStatus = info;

    if (!uiState.domBound || !dom.hud.micIcon) return;
    var el = dom.hud.micIcon;

    el.classList.remove("mic-ok", "mic-off", "mic-error");

    if (!info.supported) {
      el.classList.add("mic-error");
      el.setAttribute("title", "Micro non supporté sur cet appareil.");
      return;
    }

    if (info.errorCode) {
      el.classList.add("mic-error");
      el.setAttribute(
        "title",
        "Problème micro : " + (info.errorMessage || info.errorCode)
      );
      return;
    }

    if (info.isListening) {
      el.classList.add("mic-ok");
      el.setAttribute("title", "Micro actif");
    } else {
      el.classList.add("mic-off");
      el.setAttribute("title", "Micro inactif");
    }
  }

  // ----------------------------------------------------------
  // 7. Boutons (handlers)
  // ----------------------------------------------------------
  function handleMenuPlay(e) {
    e && e.preventDefault();
    if (window.POP_Game && typeof POP_Game.startNewGame === "function") {
      POP_Game.startNewGame();
    }
  }

  function handleMenuOptions(e) {
    e && e.preventDefault();
    showOptionsScreen();
  }

  function handleMenuHelp(e) {
    e && e.preventDefault();
    showHelpScreen();
  }

  function handleHelpBack(e) {
    e && e.preventDefault();
    showMenuScreen(uiState.lastKnownBestScore);
  }

  function handleOptionsBack(e) {
    e && e.preventDefault();

    var opts = uiState.options || {};

    if (dom.options.volume) {
      var v = parseInt(dom.options.volume.value, 10);
      if (isNaN(v)) v = 80;
      opts.volume = Math.max(0, Math.min(100, v)) / 100;
    }
    if (dom.options.micSens) {
      opts.micSensitivity = String(dom.options.micSens.value || "medium");
    }
    if (dom.options.vibration) {
      opts.vibration = !!dom.options.vibration.checked;
    }

    saveOptions(opts);
    applyOptionsToSystems();
    showMenuScreen(uiState.lastKnownBestScore);
  }

  function handleResetRecord(e) {
    e && e.preventDefault();
    if (!window.confirm("Réinitialiser le record local ?")) return;

    var key = STORAGE_KEYS.bestScore;
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn("[ui] Impossible de supprimer le record local.", err);
      }
    }
    uiState.lastKnownBestScore = 0;

    // On laisse le moteur tenir son état, mais on met à jour l’affichage menu
    showMenuScreen(0);
  }

  function handlePauseResume(e) {
    e && e.preventDefault();
    if (window.POP_Game && typeof POP_Game.resumeGame === "function") {
      POP_Game.resumeGame();
    }
  }

  function handlePauseRestart(e) {
    e && e.preventDefault();
    if (window.POP_Game && typeof POP_Game.startNewGame === "function") {
      POP_Game.startNewGame();
    }
  }

  function handlePauseMenu(e) {
    e && e.preventDefault();
    showMenuScreen(uiState.lastKnownBestScore);
  }

  function handleGameOverRestart(e) {
    e && e.preventDefault();
    if (window.POP_Game && typeof POP_Game.startNewGame === "function") {
      POP_Game.startNewGame();
    }
  }

  function handleGameOverMenu(e) {
    e && e.preventDefault();
    showMenuScreen(uiState.lastKnownBestScore);
  }

  function handleGameOverContinue(e) {
    e && e.preventDefault();
    if (
      window.POP_Game &&
      typeof POP_Game.requestRewardedContinue === "function"
    ) {
      POP_Game.requestRewardedContinue();
    } else {
      console.warn("[ui] Bouton CONTINUER (PUB) cliqué mais POP_Game.requestRewardedContinue introuvable.");
    }
  }

  // ----------------------------------------------------------
  // 8. Récupération DOM + listeners
  // ----------------------------------------------------------
  function bindDomElements() {
    // Écrans
    dom.screens.menu = $("#screen-menu");
    dom.screens.help = $("#screen-help");
    dom.screens.options = $("#screen-options");
    dom.screens.game = $("#screen-game");
    dom.screens.pause = $("#screen-pause");
    dom.screens.gameover = $("#screen-gameover");

    // HUD
    dom.hud.score = $("#hud-score");
    dom.hud.best = $("#hud-best");
    dom.hud.streak = $("#hud-streak");
    dom.hud.micIcon = $("#hud-mic-status");
    dom.hud.lastCommand = $("#hud-last-spoken");

    // Menu
    dom.menu.bestScoreSpan = $("#menu-best-score");

    // Options
    dom.options.volume = $("#opt-volume");
    dom.options.micSens = $("#opt-mic-sens");
    dom.options.vibration = $("#opt-vibration");

    // Game Over
    dom.gameover.score = $("#gameover-score");
    dom.gameover.best = $("#gameover-best");
    dom.gameover.bestStreak = $("#gameover-best-streak");
    dom.gameover.accuracy = $("#gameover-accuracy");
    dom.gameover.feedback = $("#gameover-feedback");
    dom.gameover.rewardBlock = $("#gameover-rewarded");
    dom.gameover.btnContinue = $("#btn-gameover-continue");
    dom.gameover.btnRestart = $("#btn-gameover-restart");
    dom.gameover.btnMenu = $("#btn-gameover-menu");

    // Boutons
    dom.buttons.menuPlay = $("#btn-menu-play");
    dom.buttons.menuOptions = $("#btn-menu-options");
    dom.buttons.menuHelp = $("#btn-menu-help");
    dom.buttons.helpBack = $("#btn-help-back");
    dom.buttons.optionsBack = $("#btn-options-back");
    dom.buttons.resetRecord = $("#btn-reset-record");
    dom.buttons.pauseResume = $("#btn-pause-resume");
    dom.buttons.pauseRestart = $("#btn-pause-restart");
    dom.buttons.pauseMenu = $("#btn-pause-menu");
    dom.buttons.gameoverContinue = $("#btn-gameover-continue");
    dom.buttons.gameoverRestart = $("#btn-gameover-restart");
    dom.buttons.gameoverMenu = $("#btn-gameover-menu");

    uiState.domBound = true;
    GLOBAL_STATE.ui.domBound = true;
  }

  function attachEventHandlers() {
    if (dom.buttons.menuPlay) {
      dom.buttons.menuPlay.addEventListener("click", handleMenuPlay);
    }
    if (dom.buttons.menuOptions) {
      dom.buttons.menuOptions.addEventListener("click", handleMenuOptions);
    }
    if (dom.buttons.menuHelp) {
      dom.buttons.menuHelp.addEventListener("click", handleMenuHelp);
    }
    if (dom.buttons.helpBack) {
      dom.buttons.helpBack.addEventListener("click", handleHelpBack);
    }
    if (dom.buttons.optionsBack) {
      dom.buttons.optionsBack.addEventListener("click", handleOptionsBack);
    }
    if (dom.buttons.resetRecord) {
      dom.buttons.resetRecord.addEventListener("click", handleResetRecord);
    }
    if (dom.buttons.pauseResume) {
      dom.buttons.pauseResume.addEventListener("click", handlePauseResume);
    }
    if (dom.buttons.pauseRestart) {
      dom.buttons.pauseRestart.addEventListener("click", handlePauseRestart);
    }
    if (dom.buttons.pauseMenu) {
      dom.buttons.pauseMenu.addEventListener("click", handlePauseMenu);
    }
    if (dom.buttons.gameoverRestart) {
      dom.buttons.gameoverRestart.addEventListener("click", handleGameOverRestart);
    }
    if (dom.buttons.gameoverMenu) {
      dom.buttons.gameoverMenu.addEventListener("click", handleGameOverMenu);
    }
    if (dom.buttons.gameoverContinue) {
      dom.buttons.gameoverContinue.addEventListener("click", handleGameOverContinue);
    }
  }

  // ----------------------------------------------------------
  // 9. initUI : point d’entrée
  // ----------------------------------------------------------
  function initUI() {
    bindDomElements();

    // Options
    uiState.options = loadOptions();
    GLOBAL_STATE.options = uiState.options;
    window.POP_OptionsStorage = {
      load: loadOptions,
      save: saveOptions
    };

    applyOptionsToControls();
    applyOptionsToSystems();
    attachEventHandlers();

    // Si game.js a déjà signalé “prêt”
    if (pendingOnGameReadyPayload) {
      var payload = pendingOnGameReadyPayload;
      pendingOnGameReadyPayload = null;
      onGameReady(payload);
    } else {
      // Sinon, on tente de récupérer un bestScore via snapshot
      var best = 0;
      try {
        if (
          window.POP_Game &&
          typeof POP_Game.getStateSnapshot === "function"
        ) {
          var snap = POP_Game.getStateSnapshot();
          if (snap && typeof snap.bestScore === "number") {
            best = snap.bestScore;
          }
        }
      } catch (e) {
        console.warn("[ui] Impossible de lire l’état du jeu au démarrage.", e);
      }
      uiState.lastKnownBestScore = best;
      showMenuScreen(best);
    }

    // Si voice.js a déjà mis un statut micro en mémoire
    if (uiState.lastMicStatus) {
      updateMicStatus(uiState.lastMicStatus);
    }

    console.log("[ui] initUI terminé.");
  }

  // ----------------------------------------------------------
  // 10. Exposition publique
  // ----------------------------------------------------------
  window.POP_UI = {
    initUI: initUI,
    showMenuScreen: showMenuScreen,
    showGameScreen: showGameScreen,
    showHelpScreen: showHelpScreen,
    showOptionsScreen: showOptionsScreen,
    showPauseScreen: showPauseScreen,
    showGameOverScreen: showGameOverScreen,
    updateHUD: updateHUD,
    updateLastCommand: updateLastCommand,
    updateMicStatus: updateMicStatus,
    onGameReady: onGameReady,
    onGamePaused: onGamePaused,
    onGameResumed: onGameResumed
  };
})();
