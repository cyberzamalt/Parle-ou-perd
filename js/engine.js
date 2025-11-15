// ============================================================
// Parle ou perd ! - js/engine.js
// ------------------------------------------------------------
// Rôle : moteur visuel du jeu (personnage, obstacles, collisions)
// Injecte dynamiquement le contenu dans #game-zone
// ============================================================
(function () {
  "use strict";

  const zone = document.getElementById("game-zone");
  if (!zone) {
    console.warn("[engine] Zone de jeu introuvable");
    return;
  }

  const player = document.createElement("div");
  const obstacle = document.createElement("div");

  player.className = "player";
  obstacle.className = "obstacle";

  zone.innerHTML = "";
  zone.appendChild(player);
  zone.appendChild(obstacle);

  // Positionnement initial
  player.style.left = "10px";
  player.style.bottom = "10px";
  obstacle.style.bottom = "10px";
  let obstacleX = zone.clientWidth - 40;

  window.POP_Engine = {
    jump: function () {
      if (player.classList.contains("jumping")) return;
      player.classList.add("jumping");
      player.style.bottom = "100px";
      setTimeout(() => {
        player.style.bottom = "10px";
        player.classList.remove("jumping");
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
      player.style.background = "#f00";
      obstacle.style.background = "#333";
      console.log("[engine] Collision détectée");
    }
  }

  function gameLoop() {
    obstacleX -= 2;
    if (obstacleX < -40) {
      obstacleX = zone.clientWidth + Math.random() * 100;
      obstacle.style.background = "#09f";
    }
    obstacle.style.left = obstacleX + "px";
    checkCollision();
    requestAnimationFrame(gameLoop);
  }

  console.log("[engine] Moteur lancé");
  requestAnimationFrame(gameLoop);
})();
