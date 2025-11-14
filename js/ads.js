// ============================================================
// Parle ou perd ! - js/ads.js
// ------------------------------------------------------------
// Rôle : gérer la PUB côté JavaScript.
//
// ⚙️ Version V1 (web + proto APK) :
// - Si les pubs sont désactivées dans config.js → tout est neutre.
// - Si pas de bridge Android → on affiche juste un faux bandeau
//   “BANNIÈRE TEST” en bas pour debug.
// - Si un jour le bridge Android existe (window.AndroidAds),
//   on lui délègue showBanner / hideBanner / showRewarded.
//
// IMPORTANT :
// - Pas d’AdMob direct dans ce fichier : ce sera géré
//   côté Android natif (WebView + SDK AdMob).
// - Ici, on ne fait que : décider “quand” et “où” afficher la pub,
//   et recevoir la récompense pour le rewarded.
// ============================================================
(function () {
  "use strict";

  // ----------------------------------------------------------
  // 1. Raccourcis vers la config & état global
  // ----------------------------------------------------------
  var CONFIG = window.CONFIG || {};
  var ADS_CFG = CONFIG.ads || {};

  var GLOBAL_STATE = (window.POP_STATE = window.POP_STATE || {});
  GLOBAL_STATE.ads = GLOBAL_STATE.ads || {};

  // ----------------------------------------------------------
  // 2. DOM pour le bandeau (mode debug web)
  // ----------------------------------------------------------
  var bannerContainer = null;
  var bannerBox = null;

  // ----------------------------------------------------------
  // 3. Mode de fonctionnement : "disabled" / "web-debug" / "android-bridge"
  // ----------------------------------------------------------
  var mode = "disabled";
  if (ADS_CFG.enabled !== false) {
    mode = window.AndroidAds ? "android-bridge" : "web-debug";
  }

  // ----------------------------------------------------------
  // 4. Banner : showBanner(placement) / hideBanner()
  // ----------------------------------------------------------
  /**
   * Affiche la bannière (ou demande à Android de l’afficher) pour un écran donné.
   * @param {string} placement – Nom de l’écran (menu, game, pause, etc.)
   */
  function showBanner(placement) {
    if (mode === "disabled") return;

    // Sur Android natif : on passe par le bridge
    if (mode === "android-bridge") {
      try {
        window.AndroidAds.showBanner(placement);
      } catch (err) {
        console.warn("[ads] Erreur AndroidAds.showBanner :", err);
      }
      return;
    }

    // Mode WEB DEBUG
    var allowed = ADS_CFG.bannerScreens[placement];
    if (allowed === false) {
      // Cet écran n’est pas censé avoir de pub → on masque
      hideBanner();
      return;
    }

    // S'assurer d'avoir les éléments DOM
    if (!bannerContainer || !bannerBox) {
      bannerContainer = document.getElementById("ad-banner-container") || null;
      bannerBox = document.getElementById("ad-banner") || null;
      if (!bannerContainer || !bannerBox) {
        console.warn("[ads] Élément #ad-banner-container manquant.");
        return;
      }
    }

    bannerContainer.style.display = "flex";
    bannerContainer.setAttribute("aria-hidden", "false");
    document.body.style.paddingBottom = "50px";
    // (Le contenu visuel du bandeau est purement décoratif en mode debug)
  }

  /**
   * Masque la bannière (ou demande à Android de la masquer).
   */
  function hideBanner() {
    if (mode === "disabled") return;

    // Sur Android natif
    if (mode === "android-bridge") {
      try {
        window.AndroidAds.hideBanner();
      } catch (err) {
        console.warn("[ads] Erreur AndroidAds.hideBanner :", err);
      }
      return;
    }

    // Mode WEB DEBUG
    if (bannerContainer) {
      bannerContainer.style.display = "none";
    }
    if (bannerBox) {
      bannerBox.textContent = "";
    }
    document.body.style.paddingBottom = "";
    if (bannerContainer) {
      bannerContainer.setAttribute("aria-hidden", "true");
    }
  }

  // ----------------------------------------------------------
  // 5. Rewarded : showRewarded(onComplete) + callback Android
  // ----------------------------------------------------------
  /**
   * Demande l’affichage d’une publicité vidéo “rewarded”.
   * @param {Function} onComplete – Callback à exécuter quand la pub est terminée
   */
  function showRewarded(onComplete) {
    if (mode === "disabled") return;
    var callback = typeof onComplete === "function" ? onComplete : function () {};

    // Sur Android natif
    if (mode === "android-bridge") {
      try {
        // On sauvegarde le callback, Android appellera POP_Ads.onAndroidRewardedComplete.
        GLOBAL_STATE.ads.pendingRewardCallback = callback;
        window.AndroidAds.showRewarded();
      } catch (err) {
        console.warn("[ads] Erreur AndroidAds.showRewarded :", err);
        // Si erreur, on libère quand même le jeu pour éviter blocage
        callback(false);
      }
      return;
    }

    // Mode WEB DEBUG : on simule une pub reward (timer de 3 sec)
    console.log("[ads] (DEBUG) Début de la pub récompense simulée...");
    setTimeout(function () {
      console.log("[ads] (DEBUG) Fin de la pub simulée. Récompense accordée !");
      callback(true);
    }, 3000);
  }

  /**
   * (Appelé par Android) Callback quand une pub rewarded se termine.
   * @param {boolean} success – true si le joueur doit être récompensé
   */
  function onAndroidRewardedComplete(success) {
    // On remet la WebView dans l'état qu'elle avait avant la pub (si besoin)
    try {
      window.AndroidAds.onRewardedCompleteAck();
    } catch (err) {
      console.warn("[ads] Erreur onRewardedCompleteAck :", err);
    }
    // On exécute le callback stocké lors de showRewarded
    var pendingCb = GLOBAL_STATE.ads.pendingRewardCallback;
    GLOBAL_STATE.ads.pendingRewardCallback = null;
    if (typeof pendingCb === "function") {
      pendingCb(!!success);
    }
  }

  // ----------------------------------------------------------
  // 6. Initialisation des pubs (appelée au chargement du jeu)
  // ----------------------------------------------------------
  function initAds() {
    // DOM du bandeau (mode web-debug uniquement)
    bannerContainer = document.getElementById("ad-banner-container") || null;
    bannerBox = document.getElementById("ad-banner") || null;
    // Si on est en mode debug web, on affiche le bandeau par défaut sur l'écran menu
    if (mode === "web-debug") {
      console.log("[ads] Mode debug web activé : bannière factice affichée.");
      showBanner("menu");
    }
    // Côté Android : on pourrait envoyer un signal de readiness ici si besoin
  }

  // On expose les fonctions nécessaires dans l'objet global POP_Ads
  window.POP_Ads = {
    initAds: initAds,
    showBanner: showBanner,
    hideBanner: hideBanner,
    showRewarded: showRewarded,
    onAndroidRewardedComplete: onAndroidRewardedComplete
  };
})();
