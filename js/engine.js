// ============================================================
// Parle ou perd ! - js/engine.js
// ------------------------------------------------------------
// Rôle : moteur visuel du jeu (personnage, obstacles, collisions)
// Injecte dynamiquement le contenu dans #game-area
// ============================================================
(function () {
  "use strict";

  const area = document.getElementById("game-area"); // ✅ Corrigé ici
  if (!area) {
    console.warn("[engine] Zone de jeu introuvable");
    return;
  }

  const player = document.createElement("div");
  const obstacle = document.createElement("div");

  player.className = "player";
  obstacle.className = "obstacle";

  area.innerHTML = "";
  area.appendChild(player);
  area.appendChild(obstacle);

  let obstacleX = area.clientWidth - 50;
  let isJumping = false;

  window.POP_Engine = {
    init: function () {
      console.log("[engine] Initialisation moteur de jeu");
      obstacleX = area.clientWidth - 50;
      player.style.left = "10px";
      player.style.bottom = "10px";
      obstacle.style.bottom = "10px";
      requestAnimationFrame(gameLoop);
    },
    jump: function () {
      if (isJumping) return;
      isJumping = true;
      player.classList.add("jumping");
      player.style.bottom = "100px";
      setTimeout(() => {
        player.style.bottom = "10px";
        player.classList.remove("jumping");
        isJumping = false;
      }, 400);
    }
  };

  function checkCollision() {
    const p = player.getBoundingClientRect();
    const o = obstacle.getBoundingClientRect();

    const intersect =
      p.right > o.left &&
      p.left < o.right &&
      p.bottom > o.top &&
      p.top < o.bottom;

    if (intersect) {
      player.style.background = "#aaa";
      obstacle.style.background = "#000";
      console.log("[engine] Collision détectée");
    }
  }

  function gameLoop() {
    obstacleX -= 2;
    if (obstacleX < -40) {
      obstacleX = area.clientWidth + Math.random() * 100;
    }
    obstacle.style.left = obstacleX + "px";
    checkCollision();
    requestAnimationFrame(gameLoop);
  }

})();
