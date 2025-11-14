// ============================================================
// Parle ou perd ! - js/config.js
// ------------------------------------------------------------
// Rôle : centraliser TOUTES les valeurs modifiables du jeu :
//
// - Difficulté (rythme des obstacles, combos…)
// - Options par défaut (volume, micro, langue, vibrations…)
// - Textes dynamiques (feedback, titres…)
// - Clés de stockage local (record, options…)
// - Réglages pubs / AdMob (bannière, rewarded…)
//
// IMPORTANT :
// - Ce fichier ne gère PAS la logique de jeu, ni le DOM.
// - Il expose juste un gros objet de config + quelques helpers.
// - Les autres fichiers (game.js, voice.js, ui.js, ads.js) liront
//   ce qu’il y a ici.
// ============================================================

(function () {
  "use strict";

  // ----------------------------------------------------------
  // 1. Meta / version
  // ----------------------------------------------------------
  const META = {
    gameId: "parle-ou-perd",
    title: "Parle ou perd !",
    // Version purement indicative pour toi (aucun impact technique)
    version: "0.1.0-proto",
    // Type de build : "web-proto" ; plus tard éventuellement "android-webview"
    buildType: "web-proto"
  };

  // ----------------------------------------------------------
  // 2. Clés de stockage local (localStorage)
  // ----------------------------------------------------------
  //
  // Si tu veux changer un jour la structure ou “réinitialiser”
  // toutes les sauvegardes, il suffira de modifier ces noms :
  //
  // Exemple : changer "pop_best_score_v1" en "pop_best_score_v2"
  // pour forcer tout le monde à repartir de zéro.
  // ----------------------------------------------------------
  const STORAGE_KEYS = {
    bestScore: "pop_best_score_v1",    // record global
    options: "pop_options_v1"          // volume, micro, langue, vibrations…
    // Plus tard : "statsRunHistory" ou autre si besoin
  };

  // ----------------------------------------------------------
  // 3. Réglages de difficulté & rythme (plan 3️⃣ du doc)
  // ----------------------------------------------------------
  //
  // Directement basé sur le document "Parle ou perd.txt" :
  //
  // - Score 0 → 20 : intervalle 1,8–2,4 s, obstacles simples
  // - Score 20 → 50 : intervalle 1,2–2,0 s, obstacles simples
  // - Score 50 → 100 : intervalle 0,9–1,6 s, combos introduits
  // - Score > 100 : intervalle 0,7–1,4 s, plus de combos
  //
  // Les pourcentages de combos sont gérés plus bas.
  // ----------------------------------------------------------
  const DIFFICULTY = {
    // Nb de pistes (GAUCHE / MILIEU / DROITE)
    lanesCount: 3,

    // Vitesse abstraite du jeu (peut servir plus tard si on veut
    // augmenter la vitesse du personnage en plus du rythme des obstacles)
    speed: {
      base: 1.0,
      max: 3.0
    },

    // Intervalles de spawn des obstacles selon le score
    spawnIntervals: [
      {
        minScore: 0,
        maxScore: 20,
        minIntervalSec: 1.8,
        maxIntervalSec: 2.4,
        // Dans cette zone, uniquement des obstacles simples
        combosEnabled: false
      },
      {
        minScore: 20,
        maxScore: 50,
        minIntervalSec: 1.2,
        maxIntervalSec: 2.0,
        combosEnabled: false
      },
      {
        minScore: 50,
        maxScore: 100,
        minIntervalSec: 0.9,
        maxIntervalSec: 1.6,
        combosEnabled: true
      },
      {
        minScore: 100,
        maxScore: Infinity,
        minIntervalSec: 0.7,
        maxIntervalSec: 1.4,
        combosEnabled: true
      }
    ],

    // Gestion des combos (2 obstacles liés, plan du doc)
    combos: {
      // Score à partir duquel les combos commencent à apparaître
      startScore: 50,

      // Pourcentage initial de combos parmi tous les obstacles,
      // dès que le score >= startScore.
      initialComboPercent: 0.12, // ~12%

      // Paliers supplémentaires (150, 250, 350, etc.) avec % de combos
      steps: [
        { score: 150, comboPercent: 0.20 },
        { score: 250, comboPercent: 0.30 },
        { score: 350, comboPercent: 0.40 }
        // On pourra en ajouter plus tard si on veut
      ]
    },

    // Gestion des séries / multiplicateurs (à affiner plus tard)
    streak: {
      // Nombre de commandes réussies pour activer le premier bonus
      streakForFirstMultiplier: 10,
      // Incrément de série pour augmenter le multiplicateur
      streakStep: 10,
      // Multiplicateur maximum (score * 5, par ex.)
      maxMultiplier: 5
    }
  };

  // ----------------------------------------------------------
  // 4. Réglages vocaux (langue & tolérance)
  // ----------------------------------------------------------
  //
  // Ici on ne fait pas la reconnaissance (ça sera dans voice.js),
  // mais on définit :
  // - la langue
  // - les mots attendus
  // - quelques réglages de sensibilité / timing
  // ----------------------------------------------------------
  const VOICE = {
    // Langue cible pour la reco navigateur (Android / Chrome)
    // (indicatif, voice.js décidera quoi faire avec)
    recognitionLanguage: "fr-FR",

    // Commandes de base
    commands: {
      jump: {
        canonical: "SAUTE",
        // Variantes possibles (si on veut être plus tolérant plus tard)
        variants: ["saute", "sauter"]
      },
      duck: {
        canonical: "BAISSE",
        variants: ["baisse", "baisser"]
      },
      left: {
        canonical: "GAUCHE",
        variants: ["gauche"]
      },
      right: {
        canonical: "DROITE",
        variants: ["droite"]
      }
    },

    // Sensibilité du micro = seuil d’énergie / de volume
    // (la vraie logique sera dans voice.js, ici on ne fait que stocker)
    sensitivityLevels: {
      low: 0.2,
      medium: 0.35,
      high: 0.5
    },

    // Valeur par défaut pour la V1
    defaultSensitivity: "medium",

    // Durée max (en ms) pendant laquelle une commande est “attendue”
    // pour un obstacle donné. Au-delà, on considère que le joueur
    // n’a pas parlé / a trop tardé.
    commandTimeoutMs: 1500
  };

  // ----------------------------------------------------------
  // 5. Options par défaut (pour l’écran OPTIONS)
  // ----------------------------------------------------------
  //
  // Correspond directement aux contrôles dans index.html :
  //
  // - Volume (slider)
  // - Sensibilité du micro (select)
  // - Langue (select, V1 = FR seulement)
  // - Vibrations (checkbox)
  // ----------------------------------------------------------
  const DEFAULT_OPTIONS = {
    volume: 0.8,              // 0.0 → 1.0
    micSensitivity: "medium", // "low" | "medium" | "high"
    language: "fr",           // V1 : FR uniquement
    vibration: true           // ON / OFF
  };

  // ----------------------------------------------------------
  // 6. Textes dynamiques (feedback, titres, etc.)
  // ----------------------------------------------------------
  //
  // But : éviter de dur-coder des phrases partout.
  // ui.js ira chercher ces textes ici.
  // ----------------------------------------------------------
  const TEXTS = {
    // Titres de fin de partie
    gameOverTitles: {
      default: "Tu as perdu…",
      // On pourra l’utiliser si nouveau record, par ex.
      newRecord: "Nouveau record !"
    },

    // Phrases de feedback en fin de partie, basées sur le score.
    // Directement inspiré de "Parle ou perd.txt" :
    // - score < 10 : “On t’entend à peine… rapproche-toi du micro.”
    // - 10 ≤ score < 30 : “Pas mal ! Tu commences à te faire comprendre.”
    // - 30 ≤ score < 60 : (on invente une suite cohérente)
    // etc.
    feedbackByScore: [
      {
        maxScore: 10,
        text: "On t’entend à peine… rapproche-toi du micro."
      },
      {
        maxScore: 30,
        text: "Pas mal ! Tu commences à te faire comprendre."
      },
      {
        maxScore: 60,
        text: "Bien joué ! Tu commences à maîtriser les commandes."
      },
      {
        maxScore: 100,
        text: "Très bien ! Tu parles, le jeu obéit presque toujours."
      },
      {
        maxScore: Infinity,
        text: "Excellent ! Tu domines le jeu, ta voix est leur loi."
      }
    ]
  };

  // ----------------------------------------------------------
  // 7. Réglages Publicité / AdMob (côté config, pas technique)
  // ----------------------------------------------------------
  //
  // Rappel du doc :
  // - Bandeau en bas sur : menu, aide, options, éventuellement en jeu.
  // - Pub récompensée pour “CONTINUER (PUB)” en fin de partie.
  //
  // Ici on stocke aussi les ID AdMob reçus (App ID / bloc banner),
  // pour qu’ads.js et la couche Android puissent les lire.
  // ----------------------------------------------------------
  const ADS = {
    // Permet d’activer/désactiver globalement les pubs.
    enabled: true,

    // En mode dev, on pourra décider d’utiliser plutôt les IDs
    // de test fournis par Google. Pour l’instant : true par sécurité.
    testMode: true,

    // Sur quels écrans le bandeau est autorisé ?
    // (Les IDs ici sont symboliques, ui.js décidera quoi en faire)
    bannerScreens: {
      menu: true,
      help: true,
      options: true,
      game: false,      // "éventuellement en jeu" → on met false pour V1
      pause: false,
      gameover: true
    },

    // Pub récompensée pour reprendre juste avant l’obstacle
    rewarded: {
      enabled: true,
      // Plus tard : limiter à X fois par partie, etc.
      maxPerRun: 1
    },

    // Identifiants AdMob réels (doc Admob.txt)
    admob: {
      // ID d’application Android (pour la couche native / APK)
      appIdAndroid: "ca-app-pub-7887334791636153~7891764627",

      // Bloc d’annonces bannière (bas de l’écran / menu & co)
      bannerBottomMenu: "ca-app-pub-7887334791636153/3373935111"

      // Plus tard, on pourra ajouter :
      // rewardedId: "ca-app-pub-xxx/yyy"
      // interstitialId: "ca-app-pub-xxx/zzz"
    }
  };

  // ----------------------------------------------------------
  // 8. Objet de configuration global
  // ----------------------------------------------------------
  //
  // Tout est regroupé ici, et exposé via window.POP_CONFIG.
  // ----------------------------------------------------------
  const POP_CONFIG = {
    meta: META,
    storageKeys: STORAGE_KEYS,
    difficulty: DIFFICULTY,
    voice: VOICE,
    defaultOptions: DEFAULT_OPTIONS,
    texts: TEXTS,
    ads: ADS
  };

  // ----------------------------------------------------------
  // 9. Helpers pour gérer les options dans localStorage
  // ----------------------------------------------------------
  //
  // Encapsulé ici pour que ui.js / game.js puissent juste appeler :
  // - POP_OptionsStorage.load()
  // - POP_OptionsStorage.save(options)
  //
  // Sans se soucier des noms de clés.
  // ----------------------------------------------------------
  function loadOptionsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.options);
      if (!raw) {
        // Pas encore de sauvegarde → on renvoie les valeurs par défaut
        return { ...DEFAULT_OPTIONS };
      }
      const parsed = JSON.parse(raw);
      // On fusionne avec les valeurs par défaut pour éviter les manques
      return {
        ...DEFAULT_OPTIONS,
        ...parsed
      };
    } catch (err) {
      // En cas de souci (JSON cassé, etc.), on revient aux défauts
      console.warn("[config] Impossible de charger les options, utilisation des valeurs par défaut.", err);
      return { ...DEFAULT_OPTIONS };
    }
  }

  function saveOptionsToStorage(options) {
    try {
      const toSave = {
        ...DEFAULT_OPTIONS,
        ...options
      };
      localStorage.setItem(STORAGE_KEYS.options, JSON.stringify(toSave));
    } catch (err) {
      console.warn("[config] Impossible d’enregistrer les options.", err);
    }
  }

  // ----------------------------------------------------------
  // 10. initConfig() – fonction d’initialisation simple
  // ----------------------------------------------------------
  //
  // Plan du doc : à terme, index.html appellera :
  //   initConfig();
  //   initGame();
  //   initVoice();
  //   initUI();
  //
  // Ici on se contente de :
  // - charger les options stockées
  // - exposer ces options dans un petit objet global POP_STATE
  //   que les autres modules pourront lire.
  // ----------------------------------------------------------
  function initConfig() {
    // On crée un espace global minimaliste pour l’état du jeu
    const globalState = (window.POP_STATE = window.POP_STATE || {});

    // Charge options (ou valeurs par défaut si rien en storage)
    globalState.options = loadOptionsFromStorage();

    // On garde aussi un accès direct à la config
    globalState.config = POP_CONFIG;

    // Simple log pour debug (optionnel)
    console.log("[config] initConfig terminé.", globalState.options);
  }

  // ----------------------------------------------------------
  // 11. Exposition publique (window.*)
  // ----------------------------------------------------------
  //
  // On n’attache qu’un minimum de choses à window pour éviter
  // de tout polluer :
  //
  // - POP_CONFIG       → l’objet de config complet
  // - POP_OptionsStorage.load / save
  // - initConfig       → appelé au démarrage
  // ----------------------------------------------------------
  window.POP_CONFIG = POP_CONFIG;
  window.POP_OptionsStorage = {
    load: loadOptionsFromStorage,
    save: saveOptionsToStorage
  };
  window.initConfig = initConfig;
})();
