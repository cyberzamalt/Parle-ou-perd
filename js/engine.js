// ============================================================
// Parle ou perd ! - js/engine.js
// ------------------------------------------------------------
// Rôle : moteur visuel du jeu (personnage, obstacles, collisions)
// Démarrage synchronisé avec le micro prêt
// ============================================================
(function () {
  "use strict";

  const area = document.getElementById("game-area");
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

  function waitForVoiceReady(callback, timeout = 5000) {
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.POP_STATE?.voice?.ready || Date.now() - start > timeout) {
        clearInterval(interval);
        callback();
      }
    }, 50);
  }

  console.log("[engine] Initialisation du moteur. En attente du micro...");
  waitForVoiceReady(() => {
    console.log("[engine] Micro prêt. Démarrage du jeu...");
    requestAnimationFrame(gameLoop);
  });
})();
