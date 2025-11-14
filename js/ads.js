// ============================================================
// Parle ou perd ! - js/ads.js
// ------------------------------------------------------------
// Rôle : gestion de la pub (bannières + rewarded) à travers un bridge Android
// ou un mode debug (simulé). Pas d’accès direct à AdMob ici.
// ============================================================
(function () {
  "use strict";

  const CONFIG = window.POP_CONFIG || {};
  const STATE = (window.POP_STATE = window.POP_STATE || {});
  STATE.ads = STATE.ads || {};

  let mode = "disabled";
  let bannerContainer = null;
  let bannerBox = null;

  let pendingRewardCallback = null;

  function hasAndroidBridge() {
    return (
      window.AndroidAds &&
      typeof window.AndroidAds.showBanner === "function" &&
      typeof window.AndroidAds.hideBanner === "function" &&
      typeof window.AndroidAds.showRewarded === "function"
    );
  }

  function initAds() {
    const ADS_CFG = CONFIG.ads || {};
    if (!ADS_CFG.enabled) {
      mode = "disabled";
      return;
    }

    bannerContainer = document.getElementById("ad-banner-container");
    bannerBox = document.getElementById("ad-banner");

    if (hasAndroidBridge()) {
      mode = "android";
      console.log("[ads] Mode Android bridge actif");
    } else {
      mode = "debug";
      console.log("[ads] Mode DEBUG actif");
    }
  }

  function showBanner(screenName) {
    const allowed = CONFIG?.ads?.bannerScreens?.[screenName];
    if (allowed === false) return;

    if (mode === "android") {
      try {
        window.AndroidAds.showBanner(screenName);
      } catch (e) {
        console.warn("[ads] erreur AndroidAds.showBanner", e);
      }
      return;
    }

    if (mode === "debug" && bannerContainer) {
      bannerContainer.style.display = "flex";
      bannerBox.textContent = "PUB DEBUG - écran : " + screenName;
    }
  }

  function hideBanner() {
    if (mode === "android") {
      try {
        window.AndroidAds.hideBanner();
      } catch (e) {
        console.warn("[ads] erreur AndroidAds.hideBanner", e);
      }
      return;
    }

    if (mode === "debug" && bannerContainer) {
      bannerContainer.style.display = "none";
      bannerBox.textContent = "";
    }
  }

  function showRewarded(onComplete) {
    if (mode === "android") {
      try {
        pendingRewardCallback = onComplete;
        window.AndroidAds.showRewarded();
      } catch (e) {
        console.warn("[ads] erreur AndroidAds.showRewarded", e);
        onComplete?.();
      }
      return;
    }

    if (mode === "debug") {
      console.log("[ads] Simulation pub rewarded (debug)...");
      setTimeout(() => {
        onComplete?.();
      }, 2000);
    }
  }

  function onAndroidRewardedComplete(success) {
    const cb = pendingRewardCallback;
    pendingRewardCallback = null;
    if (success && typeof cb === "function") cb();
  }

  window.POP_Ads = {
    initAds,
    showBanner,
    hideBanner,
    showRewarded,
    onAndroidRewardedComplete
  };
})();
