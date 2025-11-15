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
    right: "0px",
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

  // Position actuelle de l'obstacle (en pixels)
  let obstacleX = area.clientWidth - 50; // Position de départ approximative

  // Boucle d'animation
  function gameLoop() {
    obstacleX -= 2; // vitesse (pixels par frame)
    if (obstacleX < -40) {
      obstacleX = area.clientWidth + Math.random() * 100; // boucle + variation
    }
    obstacle.style.left = obstacleX + "px";

    requestAnimationFrame(gameLoop);
  }

  // Démarrage moteur
  console.log("[engine] Moteur lancé");
  requestAnimationFrame(gameLoop);
})();
