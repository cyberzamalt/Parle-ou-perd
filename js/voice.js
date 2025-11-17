// ============================================================
// Parle ou perd ! - js/voice.js
// ------------------------------------------------------------
// Rôle : gestion du micro et de la reconnaissance vocale.
// Utilise l'API Web Speech (SpeechRecognition) dans le navigateur.
// ============================================================
(function () {
  "use strict";

  const STATE = (window.POP_STATE = window.POP_STATE || {});
  STATE.voice = STATE.voice || { ready: false };

  const CONFIG = window.POP_CONFIG || {};
  let recognition = null;
  let isListening = false;
  let lastCommandTime = 0;

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
    recognition.interimResults = true;
    recognition.lang = "fr-FR";

    recognition.onstart = () => {
      isListening = true;
      STATE.voice.ready = true;
      updateMicStatus({ supported: true, isListening: true });
      console.log("[voice] démarré");
    };

    recognition.onerror = (event) => {
      console.warn("[voice] erreur:", event.error);
      isListening = false;
      updateMicStatus({ supported: true, isListening: false, errorCode: event.error });
    };

    recognition.onend = () => {
      isListening = false;
      updateMicStatus({ supported: true, isListening: false });
      setTimeout(startListening, 1000);
    };

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (!result || !result[0]) return;

      const transcript = result[0].transcript.trim().toLowerCase();
      const isFinal = result.isFinal;
      const command = VALID_COMMANDS.find(cmd => transcript.includes(cmd));
      const now = Date.now();

      if (command && (now - lastCommandTime > 600)) {
        console.log(`[voice] Exécution: ${command} (final: ${isFinal}) après ${now - lastCommandTime}ms`);
        lastCommandTime = now;

        if (window.POP_Game?.simulateCommand) {
          window.POP_Game.simulateCommand(command);
        }

        if (window.POP_UI?.updateLastCommand) {
          window.POP_UI.updateLastCommand({ text: transcript, recognized: true });
        }

      } else if (command) {
        console.log(`[voice] Ignoré (doublon ou trop proche): ${command}`);
      }
    };

    updateMicStatus({ supported: true, isListening: false });
  }

  function startListening() {
    if (recognition && !isListening) {
      try {
        recognition.start();
        console.log("[voice] startListening called");
      } catch (e) {
        console.warn("[voice] start() failed:", e);
      }
    }
  }

  function stopListening() {
    if (recognition && isListening) {
      try {
        recognition.stop();
      } catch (e) {
        console.warn("[voice] stop() failed:", e);
      }
    }
  }

  function setSensitivity(level) {
    // Option disponible, non utilisée dans cette version
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

initVoice(); // ← ce doit être appelé ici pour démarrer la reconnaissance
})();
