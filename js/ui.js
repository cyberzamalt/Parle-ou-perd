// ============================================================
// Parle ou perd ! - js/ui.js
// ------------------------------------------------------------
// Rôle : chef d’orchestre des ÉCRANS + BOUTONS + HUD.
// - gère quel écran est visible (menu, jeu, aide, options, pause, game over)
// - connecte les boutons au moteur de jeu (POP_Game) et à la voix (POP_Voice)
// - met à jour le HUD (score, record, série, dernière commande, micro)
// - gère les OPTIONS (volume, sensibilité micro, vibrations) + stockage local
//
// IMPORTANT :
//   - Aucune logique de jeu ici (pas d’obstacles, pas de score calculé).
//   - On se contente d’afficher / masquer et de transmettre les actions.
//
// Ce fichier expose window.POP_UI avec :
//   initUI()
//   showScreen(name)
//   showMenuScreen(bestScore)
//   showGameScreen(data)
//   showHelpScreen()
//   showOptionsScreen()
//   showGameOverScreen(endStats)
//   updateHUD(hudData)
//   updateLastCommand(info)
//   updateMicStatus(info)
//   onGameReady(payload)       (appelé par game.js)
//   onGamePaused()
//   onGameResumed()
//
// Les IDs d’éléments supposés dans index.html :
//   ÉCRANS :
//     #screen-menu
//     #screen-game
//     #screen-help
//     #screen-options
//     #screen-pause
//     #screen-gameover
//
//   BOUTONS (menu + autres) :
//     #btn-play
//     #btn-options
//     #btn-help
//     #btn-help-ok
//     #btn-pause
//     #btn-pause-resume
//     #btn-pause-menu
//     #btn-gameover-replay
//     #btn-gameover-menu
//     #btn-gameover-continue   (pour plus tard, pub récompensée)
//     #btn-options-back
//     #btn-options-reset-record
//
//   HUD (dans l’écran de jeu) :
//     #hud-score
//     #hud-best
//     #hud-streak
//     #hud-multiplier          (facultatif, si tu veux l’afficher)
//     #hud-last-command
//     #hud-mic-icon
//
//   TEXTE MENU :
//     #menu-record
//
//   OPTIONS :
//     #opt-volume              (input range 0–100, facultatif)
//     #opt-mic-sensitivity     (select : low / medium / high)
//     #opt-vibration           (checkbox ON/OFF)
//
//   GAME OVER :
//     #go-score
//     #go-record
//     #go-best-streak
//     #go-precision
//     #go-feedback
// ============================================================
(function () {
  "use strict";

  // ----------------------------------------------------------
  // 1. Raccourcis vers la config et l’état global
  // ----------------------------------------------------------
  var CONFIG = window.POP_CONFIG || {};
  var STORAGE_KEYS = CONFIG.storageKeys || {};
  var TEXTS = CONFIG.texts || {};
  var ADS_CONFIG = CONFIG.ads || {};

  var GLOBAL_STATE = (window.POP_STATE = window.POP_STATE || {});
  GLOBAL_STATE.ui = GLOBAL_STATE.ui || {};

  // Options par défaut si rien en stockage
  var DEFAULT_OPTIONS = CONFIG.defaultOptions || {
    volume: 100, // % visuel pour le slider
    micSensitivity:
      (CONFIG.voice && CONFIG.voice.defaultSensitivity) || "medium",
    vibrations: true
  };

  // ----------------------------------------------------------
  // 2. Références DOM (remplies dans initUI)
  // ----------------------------------------------------------
  var dom = {
    screens: {},
    buttons: {},
    hud: {},
    menu: {},
    options: {},
    gameover: {}
  };

  // État interne UI
  var uiState = {
    domBound: false,
    lastKnownBestScore: 0,
    lastCommandText: "(aucune)",
    lastMicStatus: null,
    options: null
  };

  // Payload que game.js peut envoyer AVANT que initUI soit appelé
  var pendingOnGameReadyPayload = null;

  // ----------------------------------------------------------
  // 3. Helpers DOM + format texte
  // ----------------------------------------------------------
  function $(id) {
    return document.getElementById(id);
  }

  function formatRecordLine(score) {
    var n = parseInt(score, 10);
    if (!isFinite(n) || n <= 0) {
      return "Record : 0 commande réussie";
    }
    var pluriel = n > 1 ? "s" : "";
    return "Record : " + n + " commande" + pluriel + " réussie" + pluriel;
  }

  // ----------------------------------------------------------
  // 4. Gestion des options (chargement / sauvegarde)
  // ----------------------------------------------------------
  var OPTIONS_STORAGE_KEY = STORAGE_KEYS.options || "POP_OPTIONS";

  function loadOptionsFromStorage() {
    try {
      var raw = localStorage.getItem(OPTIONS_STORAGE_KEY);
      if (!raw) {
        // Pas encore d’options → on clone les valeurs par défaut
        return {
          volume: DEFAULT_OPTIONS.volume,
          micSensitivity: DEFAULT_OPTIONS.micSensitivity,
          vibrations: DEFAULT_OPTIONS.vibrations
        };
      }
      var parsed = JSON.parse(raw);
      // On merge avec les défauts au cas où
      return {
        volume:
          typeof parsed.volume === "number"
            ? parsed.volume
            : DEFAULT_OPTIONS.volume,
        micSensitivity:
          parsed.micSensitivity || DEFAULT_OPTIONS.micSensitivity,
        vibrations:
          typeof parsed.vibrations === "boolean"
            ? parsed.vibrations
            : DEFAULT_OPTIONS.vibrations
      };
    } catch (err) {
      console.warn("[ui] Impossible de charger les options, on repart sur les défauts.", err);
      return {
        volume: DEFAULT_OPTIONS.volume,
        micSensitivity: DEFAULT_OPTIONS.micSensitivity,
        vibrations: DEFAULT_OPTIONS.vibrations
      };
    }
  }

  function saveOptionsToStorage(opts) {
    uiState.options = opts;
    GLOBAL_STATE.options = uiState.options;
    try {
      localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(opts));
    } catch (err) {
      console.warn("[ui] Impossible d’enregistrer les options.", err);
    }
  }

  // Applique les options aux contrôles HTML (slider, select, checkbox)
  function applyOptionsToUI() {
    if (!uiState.domBound || !uiState.options) return;

    var opts = uiState.options;

    if (dom.options.volume && typeof opts.volume === "number") {
      dom.options.volume.value = String(opts.volume);
    }

    if (dom.options.micSens && opts.micSensitivity) {
      dom.options.micSens.value = String(opts.micSensitivity);
    }

    if (dom.options.vibration) {
      dom.options.vibration.checked = !!opts.vibrations;
    }
  }

  // Applique les options aux autres modules (voix, vibrations + plus tard)
  function applyOptionsToSystems() {
    if (!uiState.options) return;
    var opts = uiState.options;

    // Sensibilité micro → voice.js
    if (window.POP_Voice && typeof POP_Voice.setSensitivity === "function") {
      POP_Voice.setSensitivity(opts.micSensitivity);
    }

    // Volume / vibrations : pour l’instant, on ne branche rien
    // (il n’y a pas encore de sons dans la V1). Mais on garde la valeur.
  }

  // ----------------------------------------------------------
  // 5. Gestion des écrans (showScreen + wrappers)
  // ----------------------------------------------------------
  function showScreen(screenName) {
    if (!uiState.domBound) return;

    var all = dom.screens;
    for (var key in all) {
      if (!Object.prototype.hasOwnProperty.call(all, key)) continue;
      var el = all[key];
      if (!el) continue;
      el.style.display = key === screenName ? "flex" : "none";
    }

    GLOBAL_STATE.ui.currentScreen = screenName || null;
  }

  // Menu principal (affiche aussi le record local)
  function showMenuScreen(bestScore) {
    if (typeof bestScore === "number" && isFinite(bestScore)) {
      uiState.lastKnownBestScore = bestScore;
    }
    if (dom.menu.recordText) {
      dom.menu.recordText.textContent = formatRecordLine(
        uiState.lastKnownBestScore
      );
    }

    showScreen("menu");
  }

  function showHelpScreen() {
    showScreen("help");
  }

  function showOptionsScreen() {
    applyOptionsToUI();
    showScreen("options");
  }

  function showGameScreen(/*data*/) {
    // L’écran “jeu” est déjà configuré par index.html + CSS.
    showScreen("game");

    // On s’assure que le micro écoute bien quand on arrive en jeu.
    if (window.POP_Voice && typeof POP_Voice.startListening === "function") {
      POP_Voice.startListening();
    }
  }

  function showPauseScreen() {
    showScreen("pause");
  }

  function showGameOverScreen(endStats) {
    if (!uiState.domBound) {
      // Si jamais game.js envoie trop tôt, on stocke en mémoire globale
      GLOBAL_STATE.ui.pendingGameOverStats = endStats || {};
      return;
    }

    endStats = endStats || {};

    // On arrête le micro : on ne veut pas de commandes en arrière-plan
    if (window.POP_Voice && typeof POP_Voice.stopListening === "function") {
      POP_Voice.stopListening();
    }

    // Mémorise le meilleur score connu
    if (typeof endStats.bestScore === "number") {
      uiState.lastKnownBestScore = endStats.bestScore;
    }

    // Mise à jour des chiffres
    if (dom.gameover.score) {
      dom.gameover.score.textContent =
        endStats.score != null ? endStats.score : 0;
    }

    if (dom.gameover.record) {
      if (endStats.isNewRecord) {
        dom.gameover.record.textContent =
          "NOUVEAU RECORD : " + (endStats.bestScore || 0) + " 🎉";
      } else {
        dom.gameover.record.textContent =
          "Record : " + (endStats.bestScore || uiState.lastKnownBestScore || 0);
      }
    }

    if (dom.gameover.bestStreak) {
      dom.gameover.bestStreak.textContent =
        endStats.bestStreak != null ? endStats.bestStreak : 0;
    }

    if (dom.gameover.precision) {
      var p = endStats.precisionPercent != null ? endStats.precisionPercent : 0;
      dom.gameover.precision.textContent = p + " %";
    }

    // Phrase de feedback (si fournie par game.js via TEXTS)
    if (dom.gameover.feedback) {
      dom.gameover.feedback.textContent = endStats.feedbackText || "";
    }

    // Bouton “CONTINUER (PUB)” selon canUseRewarded
    if (dom.gameover.btnContinue) {
      dom.gameover.btnContinue.style.display = endStats.canUseRewarded
        ? "inline-block"
        : "none";
    }

    showScreen("gameover");
  }

  // ----------------------------------------------------------
  // 6. Callbacks appelés par GAME & VOICE
  // ----------------------------------------------------------
  function onGameReady(payload) {
    // Peut être appelé avant initUI → on stocke
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
    // Pause = on arrête le micro et on affiche l’écran pause
    if (window.POP_Voice && typeof POP_Voice.stopListening === "function") {
      POP_Voice.stopListening();
    }
    showPauseScreen();
  }

  function onGameResumed() {
    // Reprise = on remet le jeu et on relance le micro
    if (window.POP_Voice && typeof POP_Voice.startListening === "function") {
      POP_Voice.startListening();
    }
    showGameScreen();
  }

  // Mise à jour du HUD en jeu (appelé régulièrement par game.js)
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

    if (dom.hud.multiplier && hudData.multiplier != null) {
      dom.hud.multiplier.textContent = "x" + hudData.multiplier;
    }

    // la dernière commande + statut micro sont gérés par updateLastCommand / updateMicStatus
  }

  // Dernière commande reconnue (appelé par game.js & voice.js)
  // info = { text: "...", recognized: true/false }
  function updateLastCommand(info) {
    if (!uiState.domBound) return;
    info = info || {};

    var text = info.text || "(aucune)";
    uiState.lastCommandText = text;

    if (dom.hud.lastCommand) {
      dom.hud.lastCommand.textContent = "Dernière commande : " + text;

      // On peut changer une classe CSS pour visuel “compris / pas compris”
      var el = dom.hud.lastCommand;
      el.classList.remove("cmd-ok", "cmd-fail");
      if (info.recognized === true) {
        el.classList.add("cmd-ok");   // à styliser dans CSS si tu veux
      } else if (info.recognized === false) {
        el.classList.add("cmd-fail");
      }
    }
  }

  // Statut du micro (appelé par voice.js)
  // info = { supported, isListening, errorCode, errorMessage, ready }
  function updateMicStatus(info) {
    if (!uiState.domBound) {
      uiState.lastMicStatus = info || null;
      return;
    }
    info = info || {};
    uiState.lastMicStatus = info;

    if (!dom.hud.micIcon) return;

    var el = dom.hud.micIcon;

    // nettoyage des classes éventuelles
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
  // 7. Gestion des clics sur les boutons
  // ----------------------------------------------------------
  function handlePlayClick(ev) {
    if (ev) ev.preventDefault();
    if (window.POP_Game && typeof POP_Game.startNewGame === "function") {
      POP_Game.startNewGame();
    } else {
      console.warn("[ui] POP_Game.startNewGame est introuvable.");
    }
  }

  function handleMenuOptionsClick(ev) {
    if (ev) ev.preventDefault();
    showOptionsScreen();
  }

  function handleMenuHelpClick(ev) {
    if (ev) ev.preventDefault();
    showHelpScreen();
  }

  function handleHelpOkClick(ev) {
    if (ev) ev.preventDefault();
    showMenuScreen(uiState.lastKnownBestScore);
  }

  function handlePauseClick(ev) {
    if (ev) ev.preventDefault();
    if (window.POP_Game && typeof POP_Game.pauseGame === "function") {
      POP_Game.pauseGame();
    }
  }

  function handlePauseResumeClick(ev) {
    if (ev) ev.preventDefault();
    if (window.POP_Game && typeof POP_Game.resumeGame === "function") {
      POP_Game.resumeGame();
    }
  }

  function handlePauseMenuClick(ev) {
    if (ev) ev.preventDefault();
    // On arrête vraiment le jeu -> retour menu
    showMenuScreen(uiState.lastKnownBestScore);
  }

  function handleGameOverReplayClick(ev) {
    if (ev) ev.preventDefault();
    if (window.POP_Game && typeof POP_Game.startNewGame === "function") {
      POP_Game.startNewGame();
    }
  }

  function handleGameOverMenuClick(ev) {
    if (ev) ev.preventDefault();
    showMenuScreen(uiState.lastKnownBestScore);
  }

  function handleGameOverContinueClick(ev) {
    if (ev) ev.preventDefault();

    // V1 : on délègue à game.js (qui lui-même appellera ads.js)
    if (
      window.POP_Game &&
      typeof POP_Game.requestRewardedContinue === "function"
    ) {
      POP_Game.requestRewardedContinue();
    } else {
      console.warn(
        "[ui] Bouton CONTINUER (PUB) cliqué, mais POP_Game.requestRewardedContinue est introuvable."
      );
    }
  }

  function handleOptionsBackClick(ev) {
    if (ev) ev.preventDefault();

    // On lit les valeurs des contrôles
    var opts = uiState.options || {};

    if (dom.options.volume) {
      var vol = parseInt(dom.options.volume.value, 10);
      if (isNaN(vol)) vol = DEFAULT_OPTIONS.volume;
      opts.volume = vol;
    }

    if (dom.options.micSens) {
      opts.micSensitivity = String(dom.options.micSens.value || DEFAULT_OPTIONS.micSensitivity);
    }

    if (dom.options.vibration) {
      opts.vibrations = !!dom.options.vibration.checked;
    }

    saveOptionsToStorage(opts);
    applyOptionsToSystems();

    showMenuScreen(uiState.lastKnownBestScore);
  }

  function handleOptionsResetRecordClick(ev) {
    if (ev) ev.preventDefault();

    if (!window.confirm("Réinitialiser le record local ?")) {
      return;
    }

    var bestKey = STORAGE_KEYS.bestScore;
    if (bestKey) {
      try {
        localStorage.removeItem(bestKey);
      } catch (err) {
        console.warn("[ui] Impossible de supprimer le record local.", err);
      }
    }

    uiState.lastKnownBestScore = 0;

    // Si possible, on demande à game.js de se réinitialiser pour refléter
    // le nouveau record à 0.
    if (window.POP_Game && typeof POP_Game.initGame === "function") {
      POP_Game.initGame();
    } else {
      // Sinon, on met juste à jour le texte du menu
      showMenuScreen(0);
    }
  }

  // ----------------------------------------------------------
  // 8. Initialisation UI : récupération DOM + listeners
  // ----------------------------------------------------------
  function bindDomElements() {
    // Écrans
    dom.screens.menu = $("#screen-menu");
    dom.screens.game = $("#screen-game");
    dom.screens.help = $("#screen-help");
    dom.screens.options = $("#screen-options");
    dom.screens.pause = $("#screen-pause");
    dom.screens.gameover = $("#screen-gameover");

    // HUD
    dom.hud.score = $("#hud-score");
    dom.hud.best = $("#hud-best");
    dom.hud.streak = $("#hud-streak");
    dom.hud.multiplier = $("#hud-multiplier");
    dom.hud.lastCommand = $("#hud-last-command");
    dom.hud.micIcon = $("#hud-mic-icon");

    // Menu
    dom.menu.recordText = $("#menu-record");

    // Options
    dom.options.volume = $("#opt-volume");
    dom.options.micSens = $("#opt-mic-sensitivity");
    dom.options.vibration = $("#opt-vibration");

    // Game Over
    dom.gameover.score = $("#go-score");
    dom.gameover.record = $("#go-record");
    dom.gameover.bestStreak = $("#go-best-streak");
    dom.gameover.precision = $("#go-precision");
    dom.gameover.feedback = $("#go-feedback");
    dom.gameover.btnContinue = $("#btn-gameover-continue");

    // Boutons (on les garde pour clarity, mais on pourrait appeler $ directement)
    dom.buttons.play = $("#btn-play");
    dom.buttons.options = $("#btn-options");
    dom.buttons.help = $("#btn-help");
    dom.buttons.helpOk = $("#btn-help-ok");
    dom.buttons.pause = $("#btn-pause");
    dom.buttons.pauseResume = $("#btn-pause-resume");
    dom.buttons.pauseMenu = $("#btn-pause-menu");
    dom.buttons.gameoverReplay = $("#btn-gameover-replay");
    dom.buttons.gameoverMenu = $("#btn-gameover-menu");
    dom.buttons.gameoverContinue = $("#btn-gameover-continue");
    dom.buttons.optionsBack = $("#btn-options-back");
    dom.buttons.optionsResetRecord = $("#btn-options-reset-record");

    uiState.domBound = true;
    GLOBAL_STATE.ui.domBound = true;
  }

  function attachEventHandlers() {
    if (dom.buttons.play) {
      dom.buttons.play.addEventListener("click", handlePlayClick);
    }
    if (dom.buttons.options) {
      dom.buttons.options.addEventListener("click", handleMenuOptionsClick);
    }
    if (dom.buttons.help) {
      dom.buttons.help.addEventListener("click", handleMenuHelpClick);
    }
    if (dom.buttons.helpOk) {
      dom.buttons.helpOk.addEventListener("click", handleHelpOkClick);
    }
    if (dom.buttons.pause) {
      dom.buttons.pause.addEventListener("click", handlePauseClick);
    }
    if (dom.buttons.pauseResume) {
      dom.buttons.pauseResume.addEventListener(
        "click",
        handlePauseResumeClick
      );
    }
    if (dom.buttons.pauseMenu) {
      dom.buttons.pauseMenu.addEventListener("click", handlePauseMenuClick);
    }
    if (dom.buttons.gameoverReplay) {
      dom.buttons.gameoverReplay.addEventListener(
        "click",
        handleGameOverReplayClick
      );
    }
    if (dom.buttons.gameoverMenu) {
      dom.buttons.gameoverMenu.addEventListener(
        "click",
        handleGameOverMenuClick
      );
    }
    if (dom.buttons.gameoverContinue) {
      dom.buttons.gameoverContinue.addEventListener(
        "click",
        handleGameOverContinueClick
      );
    }
    if (dom.buttons.optionsBack) {
      dom.buttons.optionsBack.addEventListener(
        "click",
        handleOptionsBackClick
      );
    }
    if (dom.buttons.optionsResetRecord) {
      dom.buttons.optionsResetRecord.addEventListener(
        "click",
        handleOptionsResetRecordClick
      );
    }
  }

  // ----------------------------------------------------------
  // 9. Fonction d’entrée principale pour l’UI
  // ----------------------------------------------------------
  function initUI() {
    bindDomElements();

    // Charge les options depuis localStorage
    uiState.options = loadOptionsFromStorage();
    GLOBAL_STATE.options = uiState.options;

    // Expose un petit helper global pour que voice.js puisse sauvegarder aussi
    window.POP_OptionsStorage = {
      load: loadOptionsFromStorage,
      save: saveOptionsToStorage
    };

    applyOptionsToUI();
    applyOptionsToSystems();

    attachEventHandlers();

    // Si game.js a déjà envoyé onGameReady, on le rejoue ici
    if (pendingOnGameReadyPayload) {
      var payload = pendingOnGameReadyPayload;
      pendingOnGameReadyPayload = null;
      onGameReady(payload);
    } else {
      // Sinon, on essaie de récupérer un bestScore via getStateSnapshot()
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
      } catch (err) {
        console.warn("[ui] Impossible de récupérer l’état du jeu au démarrage.", err);
      }
      uiState.lastKnownBestScore = best;
      showMenuScreen(best);
    }

    // Si voice.js a déjà stocké un statut micro avant initUI, on le rejoue
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
    showScreen: showScreen,
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
