// ============================================================
// Parle ou perd ! - js/config.js
// ------------------------------------------------------------
// Rôle : configuration centrale du jeu (voix, pub, stockage)
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
