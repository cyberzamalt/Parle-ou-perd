// ============================================================
// Parle ou perd ! - js/engine.js
// ------------------------------------------------------------
// Rôle : moteur de rendu de la zone de jeu (animation, obstacles)
// Injecte dynamiquement le jeu dans #game-area
// ============================================================
(function () {
  "use strict";

  const area = document.getElementById("game-area");
  if (!area) {
    console.warn("[engine] Zone de jeu introuvable (#game-area)");
    return;
  }

  // Éléments visuels à animer
  const player = document.createElement("div");
  const obstacle = document.createElement("div");

  player.id = "player";
  obstacle.className = "obstacle";

  // Style de base
  Object.assign(player.style, {
    position: "absolute",
    bottom: "10px",
    left: "40px",
    width: "40px",
    height: "40px",
    background: "#4cf",
    borderRadius: "8px",
    zIndex: 10,
  });

  Object.assign(obstacle.style, {
    position: "absolute",
    bottom: "10px",
    right: "10px",
    width: "40px",
    height: "40px",
    background: "#f44",
    borderRadius: "8px",
    zIndex: 9,
  });

  // Injection dans la zone de jeu
  area.innerHTML = ""; // Clear
  area.appendChild(player);
  area.appendChild(obstacle);

  // Boucle simple pour tests (bientôt supprimée au profit du moteur réel)
  function gameLoop() {
    // Animation future ici
    requestAnimationFrame(gameLoop);
  }

  // Démarrage moteur
  console.log("[engine] Moteur lancé");
  requestAnimationFrame(gameLoop);
})();
