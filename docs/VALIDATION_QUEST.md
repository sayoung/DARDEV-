# Protocole de validation Quest — Navigation VR main / manette (M6 F-71)

Ce protocole définit les étapes opérationnelles, les points de contrôle et les symptômes attendus pour valider le mode VR WebXR autonome (`immersive-vr`) et la navigation par rayon manette / main sur **Meta Quest Browser** (Meta Quest 3, Meta Quest Pro ou Meta Quest 2), conformément à l'exigence **F-71** et à la décision **D-129**.

> **Statut de validation matérielle :** **À FAIRE SUR QUEST**
> *En l'absence de casque physique connecté au poste de développement, l'ensemble des fonctionnalités a été couvert et vérifié par tests automatisés unitaires et d'intégration WebXR Three.js (`packages/viewer-core/src/vr/mount-vr.test.ts`). Cependant, les tests automatisés ne valident pas les gestes physiques réels (actionnement de la gâchette sur manette Touch ou pincement index-pouce en suivi des mains). La validation physique finale sur casque réel reste à exécuter par le porteur selon les étapes ci-dessous.*

---

## 1. Prérequis d'exécution

1. **Serveur web local ou hébergé :**
   - L'application Web (`apps/web`) doit être servie en HTTPS (ou sur `http://localhost:5174` accessible via reverse-proxy ou tunnel sécurisé si le casque est sur le même réseau local, car WebXR exige un contexte sécurisé).
2. **Visite de test :**
   - Une visite publiée comportant au moins :
     - Deux scènes reliées par un hotspot de transition (`SCENE_LINK`, flèche de navigation).
     - Au moins un hotspot d'information (`INFO`, fiche explicative).
     - La cible de sortie systématique sous l'horizon (`vr-exit`, nadir `yaw: 0, pitch: -1.0`).
3. **Casque VR :**
   - Meta Quest (Quest 3 recommandé pour 72/90 fps et hand-tracking haute fidélité).
   - Manettes Touch appairées + suivi des mains activé dans les paramètres système du casque.
   - Meta Quest Browser à jour.
4. **Débogage console (optionnel mais recommandé) :**
   - Connecter le casque en USB au PC avec le débogage USB activé, ou utiliser `chrome://inspect/#devices` sur Chrome desktop pour surveiller les messages de la console en temps réel.

---

## 2. Protocole de test pas à pas

### Étape 1 : Entrée en session VR (F-70, F-73)
1. Ouvrir l'URL de la visite dans Meta Quest Browser.
2. Vérifier la présence du bouton **« Entrer en VR »** (ou libellé équivalent défini par `vr.enter`).
3. Cliquer sur le bouton avec le pointeur du navigateur.
4. **Symptôme attendu :**
   - La demande de session WebXR `immersive-vr` avec la fonctionnalité `local-floor` s'active immédiatement (appel synchrone dans le geste utilisateur avant tout `await`).
   - Le casque bascule dans l'environnement immersif 3D sans écran blanc ni saccade.
   - Fond noir transitoire pendant le chargement de la texture équirectangulaire de la première scène, suivi de l'affichage net du panorama 360°.

### Étape 2 : Visibilité des rayons de visée (Manette et Mains)
1. Tenir la manette droite ou gauche devant soi.
2. Observer l'apparition d'un rayon linéaire blanc semi-transparent (`xplor-vr-ray`, longueur 8 m) émanant du contrôleur et orienté selon l'axe de pointage.
3. Poser les manettes et lever les mains nues dans le champ des caméras (suivi des mains Quest).
4. **Symptôme attendu :**
   - Le rayon de visée s'oriente fidèlement avec le poignet / l'index de l'utilisateur.
   - Le rayon traverse l'espace 3D vers les hotspots sans décalage géométrique.

### Étape 3 : Pointage et sélection d'une flèche de navigation (`SCENE_LINK`)
1. Aligner le rayon de la manette ou de la main vers un hotspot flèche (`SCENE_LINK`).
2. Déclencher la sélection :
   - **Sur manette :** appuyer sur la gâchette d'index (trigger).
   - **Sur main nue :** effectuer un pincement index-pouce (pinch).
3. **Symptômes attendus :**
   - Déclenchement immédiat de la transition (`selectNow`).
   - L'écran s'assombrit progressivement via un fondu au noir confortable (durée totale 300 ms, montée 150 ms).
   - Au noir complet (150 ms), la scène bascule vers la scène cible et la nouvelle texture est chargée.
   - L'écran s'éclaircit progressivement (descente 150 ms) sur la nouvelle scène.
   - Aucun mouvement brutal de caméra ou translation artificielle (confort anti-cinétose, F-72).

> [!NOTE]
> Les tests automatisés simulent la réception des événements d'entrée WebXR (`select`), mais ne valident pas les gestes physiques réels (détection biomécanique de la gâchette ou reconnaissance visuelle du pincement par le casque). Seule la validation matérielle sur Meta Quest permet de confirmer le ressenti et la fiabilité de ces gestes physiques.

### Étape 4 : Déclenchement unique (Anti-rebond / double envoi)
1. Viser une flèche de navigation et presser la gâchette de façon répétée et très rapide (mitraillage de 3 ou 4 clics successifs) ou enchaîner plusieurs pincements rapides.
2. **Symptôme attendu :**
   - Seul le premier appui déclenche la transition de scène.
   - Tant que le fondu au noir est actif (`fade.isActive()`), tous les appuis ou événements `select` ultérieurs sont strictement ignorés.
   - Pas de double navigation, pas de saut intempestif de scène, pas de bégaiement graphique.

### Étape 5 : Pointage et ouverture d'un point d'information (`INFO`)
1. Aligner le rayon vers un marqueur d'information (`INFO`).
2. Presser la gâchette ou pincer l'index et le pouce.
3. **Symptômes attendus :**
   - Un panneau textuel 3D (`createInfoPanel`) apparaît à distance confortable (2 m en face de l'utilisateur, conformément à `DEFAULT_INFO_PANEL_DISTANCE_M = 2.0`).
   - Le texte est net, lisible (enveloppement automatique des lignes, rendu Canvas 2D projeté sur un Mesh 3D).
   - En arabe, le texte s'affiche de droite à gauche avec l'alignement approprié (propriétés RTL respectées).
   - Un nouvel appui sur le point d'info referme le panneau.

### Étape 6 : Maintien du regard-dwell en secours (Mains libres / sans manette)
1. Poser les manettes hors de portée et garder les mains baissées (aucun événement `select` généré).
2. Fixer du regard le centre d'un hotspot pendant 2 secondes consécutives (2000 ms).
3. **Symptômes attendus :**
   - Le regard est suivi via l'orientation de la caméra centrale (`getGazeDir`).
   - L'indicateur visuel de progression de regard s'accumule de 0 % à 100 %.
   - À 2000 ms, la transition au noir s'enclenche exactement de la même manière que pour un clic manette.
   - Cette solution de repli garantit l'accessibilité si les manettes n'ont plus de batterie ou si le tracking des mains est perdu.

### Étape 7 : Sortie de session VR (F-72)
1. Tester la sortie via le point de regard fixe sous l'horizon :
   - Baisser la tête vers le nadir (`yaw: 0, pitch: -1.0` radian).
   - Viser ou fixer la cible de sortie `vr-exit`.
2. Tester la sortie via le bouton système :
   - Appuyer sur le bouton Oculus/Meta de la manette droite ou ouvrir le menu système Quest et choisir « Quitter l'immersion ».
3. **Symptômes attendus :**
   - La session WebXR se termine immédiatement et proprement via `session.exit()`.
   - Les ressources WebGL et Three.js sont libérées (`teardown` complet : suppression des géométries, des textures, détachement des contrôleurs et des lignes de rayon).
   - Retour fluide à l'affichage 2D de la page web dans Meta Quest Browser.

### Étape 8 : Absence d'erreurs en console
1. Dans l'inspecteur Chrome distant (`chrome://inspect`) connecté au Quest Browser, vérifier les logs de la page.
2. **Symptôme attendu :**
   - Aucune exception JavaScript non gérée (`Uncaught Error`, `TypeError`, `WebGL Context Lost`).
   - Aucun avertissement de fuite mémoire ou d'écouteur d'événement orphelin après la fermeture de session.

---

## 3. Grille des points de contrôle

| # | Point de contrôle | Résultat attendu | Statut matériel |
|---|---|---|---|
| 1 | Entrée en VR | Entrée WebXR immédiate, pas de blocage `await`, panorama 360° net | À faire sur Quest |
| 2 | Rayon manette | Rayon visible `xplor-vr-ray` attaché au contrôleur Three.js | À faire sur Quest |
| 3 | Rayon main | Rayon visible synchronisé avec le suivi des mains Quest | À faire sur Quest |
| 4 | Visée flèche (`SCENE_LINK`) | Détection du hotspot sur l'axe de visée, pas de saut visuel | À faire sur Quest |
| 5 | Visée info (`INFO`) | Détection du hotspot, ouverture du panneau textuel 3D | À faire sur Quest |
| 6 | Gâchette manette | Déclenchement de l'action dès la pression de l'index | À faire sur Quest |
| 7 | Pincement main nue | Déclenchement de l'action dès le pincement pouce-index | À faire sur Quest |
| 8 | Déclenchement unique | Mitraillage de gâchette ignoré pendant le fondu au noir | À faire sur Quest |
| 9 | Fondu au noir (confort) | Fondu 300 ms anti-cinétose, changement de scène à mi-parcours (150 ms) | À faire sur Quest |
| 10 | Regard-dwell de secours | Fixation 2 s déclenche la sélection si manettes inactives | À faire sur Quest |
| 11 | Sortie VR nadir | Cible nadir `vr-exit` quitte la session proprement | À faire sur Quest |
| 12 | Sortie VR système | Bouton système quitte et libère toutes les ressources | À faire sur Quest |
| 13 | Console propre | 0 erreur console non gérée pendant tout le cycle de vie | À faire sur Quest |

> [!IMPORTANT]
> Les points de contrôle 6 (Gâchette manette) et 7 (Pincement main nue) évaluent la réponse aux actions biomécaniques réelles. Les tests automatisés simulent fidèlement l'émission des événements WebXR `select` au niveau applicatif, mais ne valident pas la détection physique du geste matériel (course de la gâchette Touch ou reconnaissance visuelle du pincement par le casque) ; leur validation physique reste donc impérativement à réaliser sur casque Meta Quest réel.
