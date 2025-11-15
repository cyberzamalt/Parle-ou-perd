// ============================================================
// Parle ou perd ! - js/config.js
// ------------------------------------------------------------
// Rôle : contient la configuration globale du jeu
// Utilisé par : game.js, ads.js, ui.js, etc.
// ============================================================

window.POP_CONFIG = {
  version: "1.0.0",

  storageKeys: {
    bestScore: "pop_bestScore"
  },

  ads: {
    enabled: true,
    rewardedAvailable: true
  },

  voice: {
    commands: ["saute", "baisse", "gauche", "droite"],
    language: "fr-FR"
  }
};
