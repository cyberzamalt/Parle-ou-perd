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
  const VOICE_CFG = CONFIG.voice || {};
  const VALID_COMMANDS = VOICE_CFG.commands || ["saute", "baisse", "gauche", "droite"];
  const VOICE_LANG = VOICE_CFG.language || "fr-FR";
  const MIN_COMMAND_DELAY_MS = 600;

  let recognition = null;
  let isListening = false;
  let isStarting = false;
  let lastCommandTime = 0;

  function initVoice() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("[voice] API Web Speech non supportée");
      updateMicStatus({ supported: false });
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = VOICE_LANG;

    recognition.onstart = () => {
      isStarting = false;
      isListening = true;
      STATE.voice.ready = true;
      updateMicStatus({ supported: true, isListening: true });
      console.log("[voice] démarré");
    };

    recognition.onerror = (event) => {
      console.warn("[voice] erreur:", event.error);
      isStarting = false;
      isListening = false;
      updateMicStatus({
        supported: true,
        isListening: false,
        errorCode: event.error
      });
    };

    recognition.onend = () => {
      isStarting = false;
      isListening = false;
      updateMicStatus({ supported: true, isListening: false });

      // On tente de relancer l'écoute en continu (tant que la reconnaissance existe)
      setTimeout(() => {
        if (recognition && !isListening && !isStarting) {
          startListening();
        }
      }, 1000);
    };

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (!result || !result[0]) return;

      const transcript = result[0].transcript.trim().toLowerCase();
      const isFinal = result.isFinal;

      // On affiche toujours ce qui a été entendu dans le HUD
      if (window.POP_UI?.updateLastCommand) {
        window.POP_UI.updateLastCommand({
          text: transcript,
          recognized: false
        });
      }

      // ⚠️ Ne déclencher la commande QUE sur le résultat final
      // pour éviter le double "saute" (intermédiaire + final).
      if (!isFinal) {
        return;
      }

      const command = VALID_COMMANDS.find((cmd) => transcript.includes(cmd));
      const now = Date.now();

      if (command && now - lastCommandTime > MIN_COMMAND_DELAY_MS) {
        console.log(
          `[voice] Exécution: ${command} (final: ${isFinal}) après ${
            now - lastCommandTime
          }ms`
        );
        lastCommandTime = now;

        if (window.POP_Game?.simulateCommand) {
          window.POP_Game.simulateCommand(command);
        }

        if (window.POP_UI?.updateLastCommand) {
          window.POP_UI.updateLastCommand({
            text: transcript,
            recognized: true
          });
        }
      } else if (command) {
        console.log(`[voice] Ignoré (doublon ou trop proche): ${command}`);
      }
    };

    updateMicStatus({ supported: true, isListening: false });
  }

  function startListening() {
    if (!recognition) {
      console.warn("[voice] startListening appelé mais recognition est null");
      return;
    }

    if (isListening || isStarting) {
      console.log("[voice] startListening ignoré (déjà en cours)");
      return;
    }

    try {
      isStarting = true;
      recognition.start();
      console.log("[voice] startListening called");
    } catch (e) {
      isStarting = false;
      console.warn("[voice] start() failed:", e);
    }
  }

  function stopListening() {
    if (!recognition) return;

    if (isListening || isStarting) {
      try {
        recognition.stop();
      } catch (e) {
        console.warn("[voice] stop() failed:", e);
      }
    }
  }

  function setSensitivity(level) {
    // Option disponible pour plus tard (faible / normal / fort, etc.)
    // On pourrait, par exemple, ajuster MIN_COMMAND_DELAY_MS ici.
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

  // Initialisation au chargement
  initVoice();
})();
