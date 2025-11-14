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
  var CONFIG = window.POP_CONFIG || {};
  var ADS_CFG = CONFIG.ads || {};

  var GLOBAL_STATE = (window.POP_STATE = window.POP_STATE || {});
  GLOBAL_STATE.ads = GLOBAL_STATE.ads || {};

  // DOM pour le bandeau de debug web
  var bannerContainer = null;
  var bannerBox = null;

  // Mode de fonctionnement :
  // "disabled"     → pubs coupées
  // "web-debug"    → faux bandeau HTML + rewarded simulée
  // "android-bridge" → vrai SDK géré côté Android (via window.AndroidAds)
  var mode = "disabled";

  // Callback en attente pour la prochaine rewarded (jeu → pub → jeu)
  var pendingRewardCallback = null;

  // ----------------------------------------------------------
  // 2. Détection du bridge Android
  // ----------------------------------------------------------
  function hasAndroidBridge() {
    // Nom volontairement simple : à définir côté Android plus tard.
    // Par ex. côté Java :
    //   webView.addJavascriptInterface(new AdsBridge(...), "AndroidAds");
    //
    // Et dans AdsBridge :
    //   @JavascriptInterface fun showBanner(...)
    //   @JavascriptInterface fun hideBanner(...)
    //   @JavascriptInterface fun showRewarded(...)
    //
    var b = window.AndroidAds;
    if (!b) return false;
    if (typeof b.showBanner !== "function") return false;
    if (typeof b.hideBanner !== "function") return false;
    if (typeof b.showRewarded !== "function") return false;
    return true;
  }

  // ----------------------------------------------------------
  // 3. Initialisation du module pub
  // ----------------------------------------------------------
  function initAds() {
    // Si désactivé en config → on sort tout de suite
    if (!ADS_CFG || ADS_CFG.enabled === false) {
      mode = "disabled";
      GLOBAL_STATE.ads.mode = mode;
      console.log("[ads] Pubs désactivées dans config.js.");
      return;
    }

    // Récupère le DOM pour le bandeau (utilisé en mode web-debug)
    bannerContainer = document.getElementById("ad-banner-container") || null;
    bannerBox = document.getElementById("ad-banner") || null;

    // Détection du bridge Android
    if (hasAndroidBridge()) {
      mode = "android-bridge";
      console.log("[ads] Mode ANDROID BRIDGE actif (AndroidAds).");
    } else {
      mode = "web-debug";
      console.log("[ads] Mode WEB DEBUG (aucun bridge Android détecté).");
    }

    GLOBAL_STATE.ads.mode = mode;

    // En debug, on cache le bandeau au démarrage
    if (mode === "web-debug") {
      if (bannerContainer) {
        bannerContainer.style.display = "none";
      }
      if (bannerBox) {
        bannerBox.textContent = "";
      }
    }
  }

  // ----------------------------------------------------------
  // 4. Bandeau (bannière) : showBanner / hideBanner
  // ----------------------------------------------------------
  /**
   * Affiche ou demande l’affichage de la bannière.
   * @param {string} placement - optionnel, ex : "menu", "help", "options", "game", "gameover"
   */
  function showBanner(placement) {
    placement = placement || "default";

    // Si globalement désactivées → rien
    if (mode === "disabled") return;

    // Si config précise les écrans autorisés
    if (ADS_CFG.bannerScreens) {
      var allowed = ADS_CFG.bannerScreens[placement];
      if (allowed === false) {
        // Cet écran n’est pas censé avoir de pub → on masque
        hideBanner();
        return;
      }
    }

    if (mode === "android-bridge") {
      try {
        // On délègue à la couche Android. Le côté natif
        // décidera comment utiliser "placement" (si utile).
        window.AndroidAds.showBanner(String(placement));
      } catch (err) {
        console.warn("[ads] Erreur AndroidAds.showBanner :", err);
      }
      return;
    }

    // Mode WEB DEBUG : on affiche un faux bandeau en bas
    if (!bannerContainer || !bannerBox) {
      // Rien dans le DOM → on log juste
      console.warn("[ads] Impossible d’afficher le bandeau : #ad-banner-container manquant.");
      return;
    }

    bannerContainer.style.display = "flex";
    bannerBox.textContent = "BANNIÈRE PUB (TEST) – écran : " + placement;
  }

  /**
   * Masque ou demande de masquer la bannière.
   */
  function hideBanner() {
    if (mode === "disabled") return;

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
  }

  // ----------------------------------------------------------
  // 5. Rewarded : showRewarded(onComplete) + callback Android
  // ----------------------------------------------------------
  /**
   * Demande l’affichage d’une pub rewarded.
   * En V1, game.js nous appelle via callAds("showRewarded", payload, callback).
   *
   * @param {object} payload - optionnel (peut contenir des infos de debug)
   * @param {function} onComplete - appelé SI la récompense est validée.
   */
  function showRewarded(payload, onComplete) {
    if (typeof payload === "function" && !onComplete) {
      // cas où on aurait appelé showRewarded(onComplete) directement
      onComplete = payload;
      payload = {};
    }
    payload = payload || {};

    // Si pubs désactivées ou rewarded désactivée → on exécute immédiatement
    if (
      mode === "disabled" ||
      !ADS_CFG ||
      !ADS_CFG.rewarded ||
      ADS_CFG.rewarded.enabled === false
    ) {
      if (typeof onComplete === "function") {
        console.log("[ads] Rewarded désactivée : on simule une réussite immédiate.");
        onComplete();
      }
      return;
    }

    // On stocke le callback pour la fin de la vidéo
    pendingRewardCallback = typeof onComplete === "function" ? onComplete : null;

    if (mode === "android-bridge") {
      try {
        // On délègue l’affichage à Android.
        // Le côté natif devra, à la fin de la vidéo,
        // appeler window.POP_Ads.onAndroidRewardedComplete(true/false).
        window.AndroidAds.showRewarded();
      } catch (err) {
        console.warn("[ads] Erreur AndroidAds.showRewarded :", err);
        // Si ça plante, on libère le callback pour ne pas bloquer le jeu
        var cb = pendingRewardCallback;
        pendingRewardCallback = null;
        if (cb) cb();
      }
      return;
    }

    // Mode WEB DEBUG : on simule une pub reward en 1 seconde
    console.log("[ads] WEB DEBUG : simulation de rewarded, aucune vraie pub.");
    setTimeout(function () {
      var cb = pendingRewardCallback;
      pendingRewardCallback = null;
      if (cb) cb();
    }, 1000);
  }

  /**
   * Méthode appelée depuis Android quand la vidéo rewarded est terminée.
   * À implémenter côté natif, par ex :
   *
   *   webView.evaluateJavascript("window.POP_Ads.onAndroidRewardedComplete(true);", null)
   *
   * @param {boolean} success - true si la récompense est validée.
   */
  function onAndroidRewardedComplete(success) {
    success = success !== false; // par défaut, on considère que c’est OK

    var cb = pendingRewardCallback;
    pendingRewardCallback = null;

    if (!cb) {
      console.warn("[ads] onAndroidRewardedComplete appelé sans callback en attente.");
      return;
    }

    if (success) {
      cb();
    } else {
      // Si Android signale un échec (fermé avant la fin, erreur réseau, etc.)
      // on peut décider de NE PAS donner la récompense.
      console.log("[ads] Rewarded terminée sans récompense (success = false).");
    }
  }

  // ----------------------------------------------------------
  // 6. Interstitiel “peut-être” (optionnel, plus tard)
  // ----------------------------------------------------------
  function maybeShowInterstitial(context) {
    // Prévu pour plus tard : entre deux parties, au bout de X runs, etc.
    // Pour l’instant, on ne fait rien (juste un log éventuel).
    console.log("[ads] maybeShowInterstitial appelé (non implémenté). context =", context);
  }

  // ----------------------------------------------------------
  // 7. Exposition publique
  // ----------------------------------------------------------
  window.POP_Ads = {
    initAds: initAds,
    showBanner: showBanner,
    hideBanner: hideBanner,
    showRewarded: showRewarded,
    onAndroidRewardedComplete: onAndroidRewardedComplete,
    maybeShowInterstitial: maybeShowInterstitial
  };
})();
