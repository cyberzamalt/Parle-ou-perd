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
    transition: "bottom 0.2s",
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

  // Fonction de saut simulé (peut être appelée depuis voice.js ou game.js)
  window.POP_Engine = {
    jump: function () {
      if (player.classList.contains("jumping")) return;
      player.classList.add("jumping");
      player.style.bottom = "100px";
      setTimeout(() => {
        player.style.bottom = "10px";
        player.classList.remove("jumping");
      }, 400);
    },
  };

  // Détection de collision simple (AABB)
  function checkCollision() {
    const p = player.getBoundingClientRect();
    const o = obstacle.getBoundingClientRect();
    const a = area.getBoundingClientRect();

    const intersect =
      p.right > o.left &&
      p.left < o.right &&
      p.bottom > o.top &&
      p.top < o.bottom;

    if (intersect) {
      player.style.background = "#aaa";
      obstacle.style.background = "#000";
      console.log("[engine] Collision détectée !");
    }
  }

  // Boucle d'animation
  function gameLoop() {
    obstacleX -= 2; // vitesse (pixels par frame)
    if (obstacleX < -40) {
      obstacleX = area.clientWidth + Math.random() * 100; // boucle + variation
    }
    obstacle.style.left = obstacleX + "px";

    checkCollision();
    requestAnimationFrame(gameLoop);
  }

  // Démarrage moteur
  console.log("[engine] Moteur lancé");
  requestAnimationFrame(gameLoop);
})();
