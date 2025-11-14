// ============================================================
// Parle ou perd ! - js/game.js
// ------------------------------------------------------------
// Rôle : moteur du jeu (LOGIQUE UNIQUEMENT)
// - état de la partie (score, série, statut…)
// - génération des obstacles (simples + combos)
// - gestion des collisions / Game Over
// - calcul des stats (précision vocale, record…)
//
// IMPORTANT :
// - Pas de DOM direct ici (ou le minimum possible).
// - ui.js s’occupe d’afficher les écrans / HUD.
// - voice.js envoie les commandes vocales ici.
// - ads.js / Android gèrent les pubs (rewarded) à partir
//   des infos données par le moteur.
//
// Ce fichier expose un objet global window.POP_Game avec :
//   initGame()
//   startNewGame()
//   pauseGame()
//   resumeGame()
//   applyVoiceCommand(command, meta)
//   getStateSnapshot()
//   requestRewardedContinue()   (prévu pour plus tard)
//
// Le reste (état interne, obstacles…) reste privé.
// ============================================================
(function () {
  "use strict";

  // ----------------------------------------------------------
  // 1. Raccourcis vers la config globale
  // ----------------------------------------------------------
  var CONFIG = window.POP_CONFIG || {};
  var STORAGE_KEYS = (CONFIG.storageKeys) || {};
  var DIFFICULTY = (CONFIG.difficulty) || {};
  var TEXTS = (CONFIG.texts) || {};
  var ADS_CONFIG = (CONFIG.ads) || {};

  // Petite sécurité : si config.js n’a pas encore été chargé,
  // on log et on essaye quand même de ne pas planter.
  if (!window.POP_CONFIG) {
    console.warn("[game] Attention : POP_CONFIG est introuvable. Vérifie que config.js est bien chargé avant game.js.");
  }

  // ----------------------------------------------------------
  // 2. Constantes internes
  // ----------------------------------------------------------
  var STATUS = {
    IDLE: "idle",        // moteur initialisé mais aucune partie
    READY: "ready",      // prêt à lancer une partie
    PLAYING: "playing",
    PAUSED: "paused",
    GAMEOVER: "gameover"
  };

  // Durée (ms) entre le moment où l’obstacle est “au contact”
  // et le moment où on considère que c’est trop tard (aucune commande).
  var MISS_GRACE_MS = 150;

  // Fenêtre d’anticipation dans laquelle une commande peut être
  // associée à l’obstacle (avant impact).
  var COMMAND_EARLY_WINDOW_MS = 1500;

  // Espacement (ms) entre les deux parties d’un combo
  var COMBO_GAP_MS = 700;

  // Temps (ms) entre “apparition” logique de l’obstacle
  // et son moment de collision, pour donner le temps de réagir.
  var BASE_TIME_TO_HIT_MS = 2000;

  // Multiplicateur série : tous les 10 obstacles réussis
  var STREAK_STEP_FOR_MULTIPLIER = (DIFFICULTY.streak && DIFFICULTY.streak.streakStep) || 10;
  var MAX_MULTIPLIER = (DIFFICULTY.streak && DIFFICULTY.streak.maxMultiplier) || 3;

  // ----------------------------------------------------------
  // 3. État interne du jeu (non exposé directement)
  // ----------------------------------------------------------
  var gameState = {
    status: STATUS.IDLE,

    // Temps
    timeSinceStartMs: 0,
    timeToNextSpawnMs: 0,

    // Obstacles
    obstacles: [],
    nextObstacleId: 1,
    nextComboGroupId: 1,

    // Score & stats
    score: 0,
    bestScore: 0,
    streak: 0,
    bestStreakInRun: 0,
    multiplier: 1,
    maxMultiplierInRun: 1,

    // Stats de précision vocale
    precision: {
      recognizedCommands: 0,      // commandes reconnues comme l’un des 4 mots
      usefulCorrectCommands: 0    // commandes reconnues ET utiles pour éviter un obstacle
      // (on pourra rajouter “spokenTotal” si besoin)
    },

    // Rewarded
    rewardedUsedInRun: false,

    // Raf
    _rafId: null,
    _lastTimestamp: null
  };

  // ----------------------------------------------------------
  // 4. Helpers : accès au UI / Ads de manière sécurisée
  // ----------------------------------------------------------
  function callUI(methodName, payload) {
    var ui = window.POP_UI;
    if (!ui || typeof ui[methodName] !== "function") return;
    try {
      ui[methodName](payload);
    } catch (err) {
      console.warn("[game] Erreur dans POP_UI." + methodName, err);
    }
  }

  function callAds(methodName, payload, callback) {
    var ads = window.POP_Ads;
    if (!ads || typeof ads[methodName] !== "function") {
      console.warn("[game] POP_Ads." + methodName + " est introuvable (pas encore implémenté ?)");
      if (typeof callback === "function") {
        // On simule une réussite immédiate en debug,
        // pour ne pas casser la logique de jeu.
        callback();
      }
      return;
    }
    try {
      ads[methodName](payload, callback);
    } catch (err) {
      console.warn("[game] Erreur dans POP_Ads." + methodName, err);
      if (typeof callback === "function") {
        callback();
      }
    }
  }

  // ----------------------------------------------------------
  // 5. Gestion du record (localStorage)
  // ----------------------------------------------------------
  function loadBestScoreFromStorage() {
    var key = STORAGE_KEYS.bestScore;
    if (!key) return 0;
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return 0;
      var parsed = parseInt(raw, 10);
      return isNaN(parsed) ? 0 : parsed;
    } catch (err) {
      console.warn("[game] Impossible de charger le record local.", err);
      return 0;
    }
  }

  function saveBestScoreToStorage(bestScore) {
    var key = STORAGE_KEYS.bestScore;
    if (!key) return;
    try {
      localStorage.setItem(key, String(bestScore));
    } catch (err) {
      console.warn("[game] Impossible d’enregistrer le record local.", err);
    }
  }

  // ----------------------------------------------------------
  // 6. Outils de difficulté & combos (basés sur config.js)
  // ----------------------------------------------------------
  function getSpawnSettingsForScore(score) {
    var intervals = DIFFICULTY.spawnIntervals || [];
    for (var i = 0; i < intervals.length; i++) {
      var s = intervals[i];
      if (score >= s.minScore && score < s.maxScore) {
        return s;
      }
    }
    // fallback : dernier ou valeurs par défaut
    if (intervals.length > 0) {
      return intervals[intervals.length - 1];
    }
    return {
      minIntervalSec: 1.5,
      maxIntervalSec: 2.0,
      combosEnabled: false
    };
  }

  function pickSpawnIntervalMs(score) {
    var settings = getSpawnSettingsForScore(score);
    var minMs = (settings.minIntervalSec || 1.5) * 1000;
    var maxMs = (settings.maxIntervalSec || 2.0) * 1000;
    var r = Math.random();
    return minMs + (maxMs - minMs) * r;
  }

  function getComboPercentForScore(score) {
    var combosCfg = DIFFICULTY.combos || {};
    if (typeof combosCfg.startScore !== "number") return 0;

    if (score < combosCfg.startScore) {
      return 0;
    }

    var percent = combosCfg.initialComboPercent || 0.12;
    var steps = combosCfg.steps || [];
    for (var i = 0; i < steps.length; i++) {
      if (score >= steps[i].score) {
        percent = steps[i].comboPercent;
      } else {
        break;
      }
    }
    return percent;
  }

  function shouldSpawnCombo(score) {
    var settings = getSpawnSettingsForScore(score);
    if (!settings.combosEnabled) return false;
    var comboPercent = getComboPercentForScore(score);
    if (comboPercent <= 0) return false;
    return Math.random() < comboPercent;
  }

  // ----------------------------------------------------------
  // 7. Gestion des obstacles
  // ----------------------------------------------------------
  // Un obstacle est ici 100 % logique, pas graphique.
  //
  // Structure typique :
  // {
  //   id: 1,
  //   groupId: null ou un id >0 pour les combos,
  //   kind: "SIMPLE" | "COMBO",
  //   requiredCommand: "SAUTE" | "BAISSE" | "GAUCHE" | "DROITE",
  //   timeToHitMs: 2000,
  //   scored: false,
  //   failed: false,
  //   resolved: false
  // }
  //
  // Pour un combo, on crée 2 obstacles avec le même groupId
  // et des timeToHitMs décalés (COMBO_GAP_MS).
  // ----------------------------------------------------------
  function createObstacle(requiredCommand, groupId, timeOffsetMs) {
    var obstacle = {
      id: gameState.nextObstacleId++,
      groupId: groupId || null,
      requiredCommand: requiredCommand, // "SAUTE", "BAISSE", "GAUCHE", "DROITE"
      timeToHitMs: BASE_TIME_TO_HIT_MS + (timeOffsetMs || 0),
      scored: false,   // score déjà compté pour ce groupe ?
      failed: false,   // la partie a déjà échoué sur cet obstacle
      resolved: false  // commande correcte déjà appliquée ?
    };
    gameState.obstacles.push(obstacle);
    return obstacle;
  }

  function spawnSimpleObstacle() {
    // Pour l’instant on choisit un type aléatoire parmi les 4.
    // Plus tard on pourra raffiner selon la piste, les visuels, etc.
    var commands = ["SAUTE", "BAISSE", "GAUCHE", "DROITE"];
    var cmd = commands[Math.floor(Math.random() * commands.length)];
    createObstacle(cmd, null, 0);
  }

  function spawnComboObstaclePair() {
    // Un combo = 2 obstacles liés par un groupId commun.
    var groupId = gameState.nextComboGroupId++;

    // On choisit un pattern de combo simple (pour l’instant : "BAISSE puis SAUTE").
    // Plus tard on pourra varier (GAUCHE puis BAISSE, etc.).
    var pattern = [
      "BAISSE",
      "SAUTE"
    ];

    createObstacle(pattern[0], groupId, 0);
    createObstacle(pattern[1], groupId, COMBO_GAP_MS);
  }

  function spawnAccordingToDifficulty() {
    if (shouldSpawnCombo(gameState.score)) {
      spawnComboObstaclePair();
    } else {
      spawnSimpleObstacle();
    }
  }

  // Supprime les obstacles trop anciens (qui sont passés et déjà scorés)
  function cleanupObstacles() {
    gameState.obstacles = gameState.obstacles.filter(function (o) {
      // On garde ceux qui peuvent encore être scorés ou qui sont proches
      return !(o.scored && o.timeToHitMs < -2000);
    });
  }

  // ----------------------------------------------------------
  // 8. Gestion du score / série / multiplicateur
  // ----------------------------------------------------------
  function registerPassedObstacleGroup(groupId) {
    // Si groupId est null → obstacle simple = groupe unique
    var groupKey = (groupId == null) ? "__single__" : String(groupId);

    // Pour éviter de compter 2 fois le même groupe, on marque
    // l’obstacle courant (et éventuellement son compagnon de combo) comme "scored".
    var alreadyScored = false;
    for (var i = 0; i < gameState.obstacles.length; i++) {
      var o = gameState.obstacles[i];
      if ((groupId == null && o.groupId == null && !o.scored) ||
          (groupId != null && o.groupId === groupId && o.scored)) {
        alreadyScored = alreadyScored || o.scored;
      }
    }
    if (alreadyScored) return;

    // Marque tous les obstacles de ce groupe comme "scored"
    for (var j = 0; j < gameState.obstacles.length; j++) {
      var o2 = gameState.obstacles[j];
      if (groupId == null) {
        if (o2.groupId == null) {
          o2.scored = true;
        }
      } else {
        if (o2.groupId === groupId) {
          o2.scored = true;
        }
      }
    }

    // Règle de design : un combo (2 actions) compte comme 1 obstacle.
    // On ajoute donc 1 point par groupe, qu’il soit simple ou combo.
    var basePoints = 1;

    // Application du multiplicateur
    var gained = basePoints * gameState.multiplier;
    gameState.score += gained;

    // Série + multiplicateur
    gameState.streak += 1;
    if (gameState.streak > gameState.bestStreakInRun) {
      gameState.bestStreakInRun = gameState.streak;
    }

    // Mise à jour du multiplicateur en fonction de la série
    var newMultiplier = 1 + Math.floor(gameState.streak / STREAK_STEP_FOR_MULTIPLIER);
    if (newMultiplier > MAX_MULTIPLIER) {
      newMultiplier = MAX_MULTIPLIER;
    }
    gameState.multiplier = newMultiplier;
    if (newMultiplier > gameState.maxMultiplierInRun) {
      gameState.maxMultiplierInRun = newMultiplier;
    }

    // Record local (en mémoire, on sauvegardera en fin de partie)
    if (gameState.score > gameState.bestScore) {
      gameState.bestScore = gameState.score;
    }
  }

  // ----------------------------------------------------------
  // 9. Gestion du Game Over
  // ----------------------------------------------------------
  function handleGameOver(reason) {
    if (gameState.status === STATUS.GAMEOVER) return;

    gameState.status = STATUS.GAMEOVER;

    // Sauvegarde du record
    if (gameState.score > gameState.bestScore) {
      gameState.bestScore = gameState.score;
      saveBestScoreToStorage(gameState.bestScore);
    } else {
      // Même si pas de nouveau record, on s’assure que bestScore est bien enregistré
      saveBestScoreToStorage(gameState.bestScore);
    }

    // Calcul de la précision vocale
    var recognized = gameState.precision.recognizedCommands;
    var useful = gameState.precision.usefulCorrectCommands;
    var accuracy = 0;
    if (recognized > 0) {
      accuracy = Math.round((useful / recognized) * 100);
    }

    // Détermination de la phrase de feedback
    var feedbackText = "";
    var fbList = (TEXTS.feedbackByScore) || [];
    for (var i = 0; i < fbList.length; i++) {
      if (gameState.score <= fbList[i].maxScore) {
        feedbackText = fbList[i].text;
        break;
      }
    }

    var isNewRecord = (gameState.score >= gameState.bestScore);

    var endStats = {
      score: gameState.score,
      bestScore: gameState.bestScore,
      isNewRecord: isNewRecord,
      streak: gameState.streak,
      bestStreak: gameState.bestStreakInRun,
      multiplier: gameState.multiplier,
      maxMultiplier: gameState.maxMultiplierInRun,
      precisionPercent: accuracy,
      precisionDetails: {
        recognizedCommands: recognized,
        usefulCorrectCommands: useful
      },
      reason: reason || "unknown",
      canUseRewarded: !!(ADS_CONFIG.rewarded && ADS_CONFIG.rewarded.enabled && !gameState.rewardedUsedInRun)
    };

    // Informe l’UI (écran de fin)
    callUI("showGameOverScreen", endStats);
  }

  // ----------------------------------------------------------
  // 10. Mise à jour du jeu à chaque frame
  // ----------------------------------------------------------
  function updateGame(deltaMs) {
    if (gameState.status !== STATUS.PLAYING) return;

    gameState.timeSinceStartMs += deltaMs;

    // 1) Mise à jour des obstacles
    for (var i = 0; i < gameState.obstacles.length; i++) {
      var o = gameState.obstacles[i];
      if (o.failed) continue;
      o.timeToHitMs -= deltaMs;

      // Cas 1 : aucun ordre correct avant la collision → Game Over
      if (!o.resolved && o.timeToHitMs < -MISS_GRACE_MS) {
        o.failed = true;
        gameState.streak = 0;
        gameState.multiplier = 1;
        handleGameOver("no-command");
        return;
      }

      // Cas 2 : obstacle franchi avec succès → score
      if (!o.scored && o.resolved && o.timeToHitMs <= 0) {
        // Pour les groupes (combos), on ne score qu’une fois
        registerPassedObstacleGroup(o.groupId);
      }
    }

    // 2) Nettoyage des obstacles lointains
    cleanupObstacles();

    // 3) Spawn d’un nouvel obstacle si nécessaire
    gameState.timeToNextSpawnMs -= deltaMs;
    if (gameState.timeToNextSpawnMs <= 0) {
      spawnAccordingToDifficulty(gameState.score);
      gameState.timeToNextSpawnMs = pickSpawnIntervalMs(gameState.score);
    }

    // 4) Mise à jour du HUD via l’UI
    callUI("updateHUD", {
      score: gameState.score,
      bestScore: gameState.bestScore,
      streak: gameState.streak,
      multiplier: gameState.multiplier
    });
  }

  // Boucle d’animation (requestAnimationFrame)
  function gameLoop(timestamp) {
    if (gameState.status !== STATUS.PLAYING) {
      gameState._rafId = null;
      gameState._lastTimestamp = null;
      return;
    }

    if (gameState._lastTimestamp == null) {
      gameState._lastTimestamp = timestamp;
    }
    var deltaMs = timestamp - gameState._lastTimestamp;
    if (deltaMs < 0) deltaMs = 0;
    if (deltaMs > 100) deltaMs = 100; // clamp pour éviter les gros sauts

    updateGame(deltaMs);

    gameState._lastTimestamp = timestamp;
    gameState._rafId = window.requestAnimationFrame(gameLoop);
  }

  // ----------------------------------------------------------
  // 11. Commandes vocales (depuis voice.js)
  // ----------------------------------------------------------
  // applyVoiceCommand(command, meta)
  //
  // command : "SAUTE" | "BAISSE" | "GAUCHE" | "DROITE" | "NONE"
  //
  // meta (optionnel) :
  //   - recognized : true/false
  //   - rawText : texte brut prononcé (pour debug éventuel)
  // ----------------------------------------------------------
  function applyVoiceCommand(command, meta) {
    if (gameState.status !== STATUS.PLAYING) {
      // On peut quand même informer l’UI de la dernière commande,
      // mais ça ne change pas la partie.
      callUI("updateLastCommand", {
        text: command,
        recognized: !!(meta && meta.recognized)
      });
      return;
    }

    var recognized = !meta || meta.recognized !== false;

    // Cas “parole ratée / incomprise”
    if (!recognized || command === "NONE") {
      // On compte seulement les commandes reconnues comme
      // une des 4 pour la précision.
      callUI("updateLastCommand", {
        text: "(pas compris)",
        recognized: false
      });
      return;
    }

    // À partir d’ici, on a une commande reconnue comme l’un des 4 mots.
    gameState.precision.recognizedCommands += 1;

    // On cherche l’obstacle concerné : le plus proche de l’impact
    // dans une fenêtre [ -MISS_GRACE_MS , COMMAND_EARLY_WINDOW_MS ].
    var target = null;
    var bestTime = Infinity;
    for (var i = 0; i < gameState.obstacles.length; i++) {
      var o = gameState.obstacles[i];
      if (o.failed || o.resolved) continue;

      var t = o.timeToHitMs;
      if (t < -MISS_GRACE_MS) continue;             // trop tard
      if (t > COMMAND_EARLY_WINDOW_MS) continue;    // trop tôt

      if (t < bestTime) {
        bestTime = t;
        target = o;
      }
    }

    // S’il n’y a pas d’obstacle pertinent → commande reconnue
    // mais inutile (pas de bonus, pas de malus).
    if (!target) {
      callUI("updateLastCommand", {
        text: command,
        recognized: true
      });
      return;
    }

    // Cas 1 : bonne commande pour cet obstacle
    if (command === target.requiredCommand) {
      target.resolved = true;
      gameState.precision.usefulCorrectCommands += 1;

      callUI("updateLastCommand", {
        text: command,
        recognized: true
      });
      return;
    }

    // Cas 2 : commande reconnue mais incorrecte → Game Over immédiat
    target.failed = true;
    gameState.streak = 0;
    gameState.multiplier = 1;

    callUI("updateLastCommand", {
      text: command,
      recognized: true
    });

    handleGameOver("wrong-command");
  }

  // ----------------------------------------------------------
  // 12. Rewarded : demande de continuation après pub
  // ----------------------------------------------------------
  function requestRewardedContinue() {
    // Si pas autorisé par la config ou déjà utilisé → on ignore
    if (!ADS_CONFIG.rewarded || !ADS_CONFIG.rewarded.enabled) return;
    if (gameState.rewardedUsedInRun) return;
    if (gameState.status !== STATUS.GAMEOVER) return;

    // On délègue à ads.js / Android l’affichage de la pub.
    callAds("showRewarded", {}, function onRewardSuccess() {
      // Pub terminée et “récompense” accordée.
      gameState.rewardedUsedInRun = true;

      // On relance une partie “proche” de la précédente.
      // Pour simplifier la V1 : on recommence la partie
      // (mais on pourrait, plus tard, restaurer la position).
      startNewGame();
    });
  }

  // ----------------------------------------------------------
  // 13. Fonctions publiques : init / start / pause / resume
  // ----------------------------------------------------------
  function resetGameStateForNewRun() {
    // On préserve bestScore, rewardedUsedInRun (reset pour la run)
    var previousBest = gameState.bestScore;

    gameState.status = STATUS.READY;
    gameState.timeSinceStartMs = 0;
    gameState.timeToNextSpawnMs = pickSpawnIntervalMs(0);

    gameState.obstacles = [];
    gameState.nextObstacleId = 1;
    gameState.nextComboGroupId = 1;

    gameState.score = 0;
    gameState.streak = 0;
    gameState.bestStreakInRun = 0;
    gameState.multiplier = 1;
    gameState.maxMultiplierInRun = 1;
    gameState.bestScore = previousBest;

    gameState.precision.recognizedCommands = 0;
    gameState.precision.usefulCorrectCommands = 0;

    gameState.rewardedUsedInRun = false;

    // Reset boucle
    if (gameState._rafId != null) {
      cancelAnimationFrame(gameState._rafId);
      gameState._rafId = null;
    }
    gameState._lastTimestamp = null;
  }

  function initGame() {
    // On s’assure que POP_STATE existe
    var globalState = (window.POP_STATE = window.POP_STATE || {});
    if (!globalState.config) {
      // Si initConfig() existe et n’a pas été appelé, on le tente.
      if (typeof window.initConfig === "function") {
        window.initConfig();
        CONFIG = window.POP_CONFIG || CONFIG;
        STORAGE_KEYS = CONFIG.storageKeys || STORAGE_KEYS;
        DIFFICULTY = CONFIG.difficulty || DIFFICULTY;
        TEXTS = CONFIG.texts || TEXTS;
        ADS_CONFIG = CONFIG.ads || ADS_CONFIG;
      }
    }

    // Charge le record depuis le stockage
    gameState.bestScore = loadBestScoreFromStorage();

    // Positionne l’état global pour debug éventuel
    globalState.game = gameState;

    gameState.status = STATUS.READY;

    // Informe l’UI que le jeu est prêt (pour afficher le menu)
    callUI("onGameReady", { bestScore: gameState.bestScore });
  }

  function startNewGame() {
    resetGameStateForNewRun();
    gameState.status = STATUS.PLAYING;

    // Demande à l’UI d’afficher l’écran de jeu
    callUI("showGameScreen", {
      bestScore: gameState.bestScore
    });

    // Lancement de la boucle
    gameState._lastTimestamp = null;
    gameState._rafId = window.requestAnimationFrame(gameLoop);
  }

  function pauseGame() {
    if (gameState.status !== STATUS.PLAYING) return;
    gameState.status = STATUS.PAUSED;
    callUI("onGamePaused", {});
  }

  function resumeGame() {
    if (gameState.status !== STATUS.PAUSED) return;
    gameState.status = STATUS.PLAYING;
    gameState._lastTimestamp = null;
    gameState._rafId = window.requestAnimationFrame(gameLoop);
    callUI("onGameResumed", {});
  }

  // ----------------------------------------------------------
  // 14. Snapshot d’état (pour debug / UI)
  // ----------------------------------------------------------
  function getStateSnapshot() {
    // On renvoie une copie "safe" de l’état, sans les références internes.
    return JSON.parse(JSON.stringify({
      status: gameState.status,
      score: gameState.score,
      bestScore: gameState.bestScore,
      streak: gameState.streak,
      bestStreakInRun: gameState.bestStreakInRun,
      multiplier: gameState.multiplier,
      maxMultiplierInRun: gameState.maxMultiplierInRun,
      precision: gameState.precision,
      obstaclesCount: gameState.obstacles.length,
      timeSinceStartMs: gameState.timeSinceStartMs
    }));
  }

  // ----------------------------------------------------------
  // 15. Exposition publique
  // ----------------------------------------------------------
  window.POP_Game = {
    initGame: initGame,
    startNewGame: startNewGame,
    pauseGame: pauseGame,
    resumeGame: resumeGame,
    applyVoiceCommand: applyVoiceCommand,
    requestRewardedContinue: requestRewardedContinue,
    getStateSnapshot: getStateSnapshot
  };
})();
