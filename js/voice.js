// ============================================================
// Parle ou perd ! - js/voice.js
// ------------------------------------------------------------
// Rôle : gérer le MICRO + la RECONNAISSANCE VOCALE et traduire
// tout ça en commandes propres pour le moteur de jeu :
//
//   "SAUTE", "BAISSE", "GAUCHE", "DROITE", ou "NONE"
//
// Ce module NE dessine rien à l'écran :
// - POP_Game.applyVoiceCommand(...) reçoit les ordres propres.
// - POP_UI.updateMicStatus(...) met à jour l’icône micro.
// - POP_UI.updateLastCommand(...) affiche la dernière commande.
//
// Il essaye d’utiliser l’API Web Speech (SpeechRecognition).
// Si ce n’est pas dispo, il ne plante pas, marque juste
// "isSupported = false" et prévient l’UI.
// ============================================================
(function () {
  "use strict";

  // ----------------------------------------------------------
  // 1. Raccourcis vers la config & l’état global
  // ----------------------------------------------------------
  var CONFIG = window.POP_CONFIG || {};
  var VOICE_CFG = CONFIG.voice || {};
  var COMMANDS_CFG = VOICE_CFG.commands || {};
  var SENS_LEVELS = VOICE_CFG.sensitivityLevels || {};
  var DEFAULT_SENS = VOICE_CFG.defaultSensitivity || "medium";

  // On s’assure que POP_STATE existe pour stocker des infos globales
  var GLOBAL_STATE = (window.POP_STATE = window.POP_STATE || {});
  GLOBAL_STATE.voice = GLOBAL_STATE.voice || {};

  // ----------------------------------------------------------
  // 2. Détection de l’API de reconnaissance vocale
  // ----------------------------------------------------------
  var SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

  var recognitionSupported = !!SpeechRecognition;
  GLOBAL_STATE.voice.isSupported = recognitionSupported;

  // ----------------------------------------------------------
  // 3. État interne de voice.js
  // ----------------------------------------------------------
  var recognition = null;         // instance de SpeechRecognition
  var isListening = false;        // est-ce que le micro est “en écoute” ?
  var currentSensitivityKey = DEFAULT_SENS; // "low" | "medium" | "high"
  var lastErrorCode = null;
  var lastErrorMessage = null;

  // ----------------------------------------------------------
  // 4. Helpers pour parler aux autres modules (UI / Game)
  // ----------------------------------------------------------
  function callUI(methodName, payload) {
    var ui = window.POP_UI;
    if (!ui || typeof ui[methodName] !== "function") return;
    try {
      ui[methodName](payload);
    } catch (err) {
      console.warn("[voice] Erreur dans POP_UI." + methodName, err);
    }
  }

  function callGame(methodName, payload, meta) {
    var game = window.POP_Game;
    if (!game || typeof game[methodName] !== "function") return;
    try {
      // applyVoiceCommand(command, meta)
      if (methodName === "applyVoiceCommand") {
        game.applyVoiceCommand(payload, meta || {});
      } else {
        game[methodName](payload);
      }
    } catch (err) {
      console.warn("[voice] Erreur dans POP_Game." + methodName, err);
    }
  }

  // Mise à jour centralisée du statut du micro pour l’UI + GLOBAL_STATE
  function updateMicStatusForUI(extra) {
    var info = {
      supported: recognitionSupported,
      isListening: isListening,
      errorCode: lastErrorCode,
      errorMessage: lastErrorMessage
    };
    if (extra && typeof extra === "object") {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) {
          info[k] = extra[k];
        }
      }
    }

    GLOBAL_STATE.voice.isListening = isListening;
    GLOBAL_STATE.voice.lastErrorCode = lastErrorCode;
    GLOBAL_STATE.voice.lastErrorMessage = lastErrorMessage;

    callUI("updateMicStatus", info);
  }

  // ----------------------------------------------------------
  // 5. Normalisation du texte + extraction de commande
  // ----------------------------------------------------------
  // Nettoie un texte brut (accent, ponctuation, espaces)
  function normalizeText(text) {
    if (!text) return "";
    // Mise en minuscules
    var t = text.toLowerCase();

    // Essaye d’enlever les accents (si le navigateur supporte normalize)
    try {
      t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (e) {
      // Si normalize n’existe pas, on ignore cette étape
    }

    // On retire tout ce qui n’est pas lettre / chiffre / espace
    t = t.replace(/[^a-z0-9\s]/g, " ");

    // On compresse les espaces
    t = t.replace(/\s+/g, " ").trim();

    return t;
  }

  // Retourne "SAUTE", "BAISSE", "GAUCHE", "DROITE" ou "NONE"
  function parseCommandFromText(rawText) {
    var txt = normalizeText(rawText);

    if (!txt) return "NONE";

    // On regarde chaque commande définie dans config.voice.commands
    // Structure attendue :
    //   {
    //     jump: { canonical: "SAUTE", variants: ["saute", "sauter"] },
    //     ...
    //   }
    var keys = Object.keys(COMMANDS_CFG);
    for (var i = 0; i < keys.length; i++) {
      var cmdKey = keys[i];
      var cfg = COMMANDS_CFG[cmdKey];
      if (!cfg) continue;

      var canonical = (cfg.canonical || "").toUpperCase();
      var variants = cfg.variants || [];

      // On crée une liste de “patterns” à tester dans le texte
      var wanted = [canonical.toLowerCase()];
      for (var j = 0; j < variants.length; j++) {
        wanted.push(normalizeText(variants[j]));
      }

      // Si un des mots-clés apparaît dans la phrase reconnue, on considère
      // que c'est cette commande.
      for (var k = 0; k < wanted.length; k++) {
        var pattern = wanted[k];
        if (!pattern) continue;
        var regex = new RegExp("\\b" + pattern + "\\b");
        if (regex.test(txt)) {
          return canonical; // "SAUTE" par ex.
        }
      }
    }

    return "NONE";
  }

  // ----------------------------------------------------------
  // 6. Gestion des résultats de la reco vocale
  // ----------------------------------------------------------
  function handleRecognitionResult(event) {
    if (!event || !event.results || event.results.length === 0) {
      return;
    }

    // On prend le dernier résultat final
    var lastResult = event.results[event.results.length - 1];
    if (!lastResult || lastResult.isFinal === false) {
      // On ignore les résultats provisoires pour la V1
      return;
    }

    var transcript = (lastResult[0] && lastResult[0].transcript) || "";
    var command = parseCommandFromText(transcript);

    // On informe le moteur de jeu
    var isRecognizedCommand = command !== "NONE";
    callGame("applyVoiceCommand", command, {
      recognized: isRecognizedCommand,
      rawText: transcript
    });

    // On met éventuellement à jour la “dernière commande” dans le HUD
    // (le moteur le fait déjà à la réception, mais si un jour le jeu
    // n’est pas en PLAYING, ça permet quand même d’afficher quelque chose).
    callUI("updateLastCommand", {
      text: isRecognizedCommand ? command : transcript || "(pas compris)",
      recognized: isRecognizedCommand
    });
  }

  // ----------------------------------------------------------
  // 7. Gestion des erreurs de reconnaissance
  // ----------------------------------------------------------
  function handleRecognitionError(event) {
    lastErrorCode = event && event.error ? String(event.error) : "unknown";
    lastErrorMessage =
      (event && event.message) ||
      (event && event.error) ||
      "Erreur inconnue de la reconnaissance vocale.";

    console.warn("[voice] SpeechRecognition erreur :", lastErrorCode, lastErrorMessage);

    // Certains codes signifient que l’utilisateur a refusé l’accès au micro
    // ou que le micro est indisponible.
    if (lastErrorCode === "not-allowed" || lastErrorCode === "service-not-allowed") {
      isListening = false;
    }

    updateMicStatusForUI();
  }

  // Quand la reco s’arrête (ex : timeout, pas de son, etc.)
  function handleRecognitionEnd() {
    if (!isListening) {
      // On a arrêté volontairement
      updateMicStatusForUI();
      return;
    }

    // Mode “écoute continue” : on relance.
    try {
      recognition.start();
    } catch (err) {
      // Certains navigateurs n’aiment pas le redémarrage immédiat
      console.warn("[voice] Impossible de relancer la reco vocale immédiatement :", err);
      isListening = false;
      lastErrorCode = "restart-failed";
      lastErrorMessage = "La reconnnaissance vocale s’est arrêtée et n’a pas pu redémarrer.";
      updateMicStatusForUI();
    }
  }

  // ----------------------------------------------------------
  // 8. (Re)création de l’instance SpeechRecognition
  // ----------------------------------------------------------
  function createRecognitionInstance() {
    if (!recognitionSupported) {
      recognition = null;
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = VOICE_CFG.recognitionLanguage || "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onresult = handleRecognitionResult;
    recognition.onerror = handleRecognitionError;
    recognition.onend = handleRecognitionEnd;

    // On ne gère pas onstart ici, on met simplement à jour l’UI
    // dans startListening().
  }

  // ----------------------------------------------------------
  // 9. API publique : initVoice / start / stop / sensibilité
  // ----------------------------------------------------------
  function initVoice() {
    // Si pas supporté, on prévient juste l’UI
    if (!recognitionSupported) {
      lastErrorCode = "not-supported";
      lastErrorMessage =
        "Reconnaissance vocale non disponible sur ce navigateur / appareil.";
      isListening = false;
      updateMicStatusForUI();
      console.warn("[voice] SpeechRecognition non supporté.");
      return;
    }

    createRecognitionInstance();

    GLOBAL_STATE.voice.currentSensitivity = currentSensitivityKey;

    // Info pour l’UI (par exemple, passer l’icône micro en “prête”)
    updateMicStatusForUI({ ready: true });

    console.log("[voice] initVoice terminé. Langue =", recognition.lang);
  }

  function startListening() {
    if (!recognitionSupported || !recognition) {
      console.warn("[voice] startListening appelé alors que la reco n’est pas disponible.");
      return;
    }

    if (isListening) {
      // Déjà en écoute
      return;
    }

    try {
      recognition.start();
      isListening = true;
      lastErrorCode = null;
      lastErrorMessage = null;
      updateMicStatusForUI();
      console.log("[voice] startListening (micro ON)");
    } catch (err) {
      console.warn("[voice] Impossible de démarrer la reco vocale :", err);
      lastErrorCode = "start-failed";
      lastErrorMessage = "Impossible de démarrer la reconnaissance vocale.";
      isListening = false;
      updateMicStatusForUI();
    }
  }

  function stopListening() {
    if (!recognitionSupported || !recognition) return;
    if (!isListening) return;

    try {
      isListening = false;
      recognition.stop();
      console.log("[voice] stopListening (micro OFF)");
    } catch (err) {
      console.warn("[voice] Erreur lors de l’arrêt de la reco vocale :", err);
    } finally {
      updateMicStatusForUI();
    }
  }

  function setSensitivity(levelKey) {
    if (!SENS_LEVELS || !SENS_LEVELS.hasOwnProperty(levelKey)) {
      console.warn("[voice] setSensitivity : niveau inconnu =", levelKey);
      return;
    }

    currentSensitivityKey = levelKey;
    GLOBAL_STATE.voice.currentSensitivity = levelKey;

    // Si les options globales existent, on les met à jour + sauvegarde
    if (GLOBAL_STATE.options) {
      GLOBAL_STATE.options.micSensitivity = levelKey;
      if (window.POP_OptionsStorage && typeof window.POP_OptionsStorage.save === "function") {
        window.POP_OptionsStorage.save(GLOBAL_STATE.options);
      }
    }

    console.log("[voice] Sensibilité micro réglée sur", levelKey);
  }

  // ----------------------------------------------------------
  // 10. Exposition publique
  // ----------------------------------------------------------
  window.POP_Voice = {
    initVoice: initVoice,
    startListening: startListening,
    stopListening: stopListening,
    setSensitivity: setSensitivity,
    // Petit helper optionnel si un jour tu veux tester
    isSupported: function () {
      return recognitionSupported;
    }
  };
})();
