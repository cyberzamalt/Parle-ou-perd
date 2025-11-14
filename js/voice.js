// ============================================================
// Parle ou perd ! - js/voice.js
// ------------------------------------------------------------
// Rôle : gestion du micro et de la reconnaissance vocale.
// Utilise l'API Web Speech (SpeechRecognition) dans le navigateur.
// ============================================================
(function () {
  "use strict";

  const STATE = (window.POP_STATE = window.POP_STATE || {});
  STATE.voice = STATE.voice || {};

  const CONFIG = window.POP_CONFIG || {};

  let recognition = null;
  let isSupported = false;
  let isListening = false;
  let errorCode = null;
  let lastTranscript = "";
  let sensitivity = CONFIG.voice?.defaultSensitivity || "medium";

  const VALID_COMMANDS = ["saute", "baisse", "gauche", "droite"];

  function initVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[voice] API Web Speech non supportée");
      updateMicStatus({ supported: false });
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "fr-FR";

    recognition.onstart = () => {
      isListening = true;
      updateMicStatus({ supported: true, isListening });
    };

    recognition.onerror = (event) => {
      console.warn("[voice] erreur:", event.error);
      errorCode = event.error;
      isListening = false;
      updateMicStatus({ supported: true, isListening, errorCode });
    };

    recognition.onend = () => {
      isListening = false;
      updateMicStatus({ supported: true, isListening });
      // Redémarre automatiquement si en jeu
      if (STATE?.ui?.currentScreen === "game") {
        startListening();
      }
    };

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (!result || !result[0]) return;
      const transcript = result[0].transcript.trim().toLowerCase();
      lastTranscript = transcript;

      const matched = VALID_COMMANDS.find((cmd) => transcript.includes(cmd));
      const isValid = !!matched;

      if (window.POP_UI?.updateLastCommand) {
        window.POP_UI.updateLastCommand({ text: transcript, recognized: isValid });
      }
      if (isValid && window.POP_Game?.simulateCommand) {
        window.POP_Game.simulateCommand(matched);
      }
    };

    isSupported = true;
    updateMicStatus({ supported: true, isListening });
  }

  function startListening() {
    if (!recognition || isListening) return;
    try {
      recognition.start();
    } catch (e) {
      console.warn("[voice] start() failed:", e);
    }
  }

  function stopListening() {
    if (!recognition || !isListening) return;
    try {
      recognition.stop();
    } catch (e) {
      console.warn("[voice] stop() failed:", e);
    }
  }

  function setSensitivity(level) {
    sensitivity = level;
    // Optionnel : modifier comportement en fonction de la sensibilité
  }

  function updateMicStatus(status) {
    STATE.voice.status = status;
    if (window.POP_UI?.updateMicStatus) {
      window.POP_UI.updateMicStatus(status);
    }
  }

  window.POP_Voice = {
    initVoice,
    startListening,
    stopListening,
    setSensitivity
  };
})();
