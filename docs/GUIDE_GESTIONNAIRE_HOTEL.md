# Guide d'utilisation — Espace Gestionnaire d'Hôtel

Bienvenue sur la plateforme **Xplor**. Ce guide s'adresse aux gestionnaires d'établissements hôteliers (rôle « Gestionnaire d'hôtel ») utilisant le back-office d'administration pour piloter leurs visites virtuelles et leurs kiosques interactifs.

---

## 1. Connexion

Pour accéder à l'interface d'administration de la plateforme, ouvrez votre navigateur web à l'adresse du back-office Xplor fournie par l'administrateur.

### Procédure de connexion
1. Sur l'écran « Connexion », renseignez :
   - Votre « Adresse e-mail » d'utilisateur.
   - Votre « Mot de passe ».
2. Cliquez sur le bouton « Se connecter ».
3. Si la double authentification est activée sur votre compte, l'écran « Authentification à deux facteurs » vous demandera de saisir votre « Code à 6 chiffres », puis de cliquer sur « Vérifier ».

### Messages et erreurs possibles
- Identifiants incorrects : si l'adresse e-mail ou le mot de passe est erroné, le système affiche le message « Identifiants incorrects » ou « La connexion a échoué. Réessayez. ».
- Verrouillage du compte : après 5 tentatives infructueuses consécutives, l'accès est temporairement bloqué et affiche « Compte verrouillé. Réessayez dans 15 minutes. ».
- Session expirée : si votre session a expiré ou si une connexion a été ouverte depuis un autre navigateur, l'application affiche « Ta session a expiré ou a été ouverte ailleurs. Reconnecte-toi. ».

### Mot de passe oublié
1. Si vous avez égaré votre mot de passe, cliquez sur le lien « Mot de passe oublié » présent sur la page de connexion.
2. Saisissez votre « Adresse e-mail » et validez en cliquant sur « Envoyer le lien ».
3. Le message suivant confirme la demande : « Si un compte correspond à cette adresse, un courriel vient d'être envoyé. ».
4. Cliquez sur le lien reçu par e-mail pour définir un nouveau mot de passe.
5. Sur l'écran « Nouveau mot de passe », saisissez votre mot de passe et remplissez la « Confirmation du mot de passe », puis cliquez sur « Enregistrer ». Le mot de passe doit respecter les exigences de sécurité de la plateforme (au moins 12 caractères : « Le mot de passe doit contenir au moins 12 caractères. »).

### Déconnexion
Pour clore votre session en toute sécurité, cliquez sur le bouton « Se déconnecter » situé dans la barre supérieure de l'interface.

---

## 2. Périmètre (vos hôtels)

### Rôle et habilitations
Votre compte dispose du rôle « Gestionnaire d'hôtel » (`HOTEL_MANAGER`). La politique d'accès du système (`AccessPolicy`) applique les règles suivantes :
- **Périmètre strict par établissement** : vous avez exclusivement accès au(x) hôtel(s) qui ont été rattachés à votre profil par l'administrateur. Les hôtels appartenant à d'autres partenaires ou gestionnaires ne vous sont jamais visibles.
- **Consultation et personnalisation des sélections** : vous pouvez consulter et modifier la sélection des visites présentées sur les kiosques de votre hôtel.
- **Suivi des kiosques** : vous visualisez la liste et l'état en temps réel des kiosques déployés dans vos hôtels.
- **Consultation des statistiques** : vous accédez aux tableaux de bord statistiques et aux exports de données pour vos seuls établissements.
- **Actions réservées aux administrateurs** :
  - La création, la modification des informations générales (nom, ville, couleur de marque, code PIN de maintenance) et la suppression d'un hôtel sont réservées au rôle « Administrateur » (`ADMIN`).
  - La création et la publication de visites dans le catalogue global, ainsi que la gestion des scènes et des médias, relèvent des rôles « Administrateur » et « Éditeur » (`ADMIN` / `EDITOR`).
  - La création de comptes utilisateurs et la consultation des journaux d'audit sont réservées à l'administrateur.

### Menu de navigation
Dans la barre latérale « Navigation principale », les rubriques suivantes sont disponibles :
- « Accueil » : tableau de bord général et résumé de l'activité.
- « Visites » : consultation des visites virtuelles publiées disponibles sur la plateforme.
- « Hôtels » : liste de vos hôtels rattachés.
- « Kiosques » : suivi des kiosques de vos établissements.
- « Statistiques » : indicateurs de fréquentation et export CSV.

Dans la section « Hôtels », le tableau présente la liste de vos établissements avec les colonnes « Nom » et « Ville », ainsi qu'un lien d'action « Sélection ».

---

## 3. Visites proposées sur le kiosque

L'écran « Sélection des visites » vous permet de définir le bouquet de visites interactives mises à la disposition des voyageurs sur les kiosques de votre hôtel.

### Accéder à la sélection
1. Cliquez sur « Hôtels » dans la navigation principale.
2. Sur la ligne de votre établissement, cliquez sur le lien « Sélection ».
3. La page affiche la version courante de la sélection (« Version {{version}} »).

### Explorer le catalogue des visites
La section « Catalogue des visites » présente les visites créées et publiées sur la plateforme :
- **Recherche textuelle** : saisissez un mot-clé dans le champ « Rechercher une visite » et cliquez sur « Rechercher ».
- **Filtre par ville** : sélectionnez une ville dans la liste « Ville » (ou « Toutes les villes »).
- **Filtre par catégorie** : filtrez par typologie dans la liste « Catégorie » (ou « Toutes les catégories »).
- Si aucune visite ne correspond aux critères, le message « Aucune visite publiée trouvée. » est affiché.

### Ajouter une visite
- Pour chaque visite du catalogue que vous souhaitez proposer dans votre hôtel, cliquez sur le bouton « Ajouter ».
- Une fois ajoutée, le bouton indique « Ajoutée » et la visite apparaît dans la liste « Visites sélectionnées ».

### Gérer les visites sélectionnées
Dans la section « Visites sélectionnées », vous configurez l'organisation de votre sélection :
- **Modifier l'ordre d'affichage** : utilisez les boutons « Monter » et « Descendre » pour ajuster la position de chaque visite sur l'écran d'accueil du kiosque.
- **Visite à la une** : cochez l'option « Mise en avant » sur une visite pour qu'elle apparaisse en vedette sur le kiosque (« À la une »). Une seule visite peut être mise en avant à la fois.
- **Mode veille (attract loop)** : cochez l'option « Mode veille » sur les visites que vous souhaitez faire défiler automatiquement sur le kiosque lorsque personne ne l'utilise.
- **Retirer une visite** : cliquez sur le bouton « Retirer » pour enlever une visite de votre sélection.

### Enregistrer les modifications
1. Après avoir effectué vos réglages, cliquez sur le bouton « Enregistrer ».
2. Pendant le traitement, le bouton affiche « Enregistrement... ».
3. Lorsque la sauvegarde est validée, le message de confirmation « Sélection enregistrée. » apparaît, et le numéro de version de la sélection est incrémenté.
4. Les kiosques de l'hôtel téléchargeront automatiquement cette nouvelle version lors de leur prochaine synchronisation.

---

## 4. Kiosques (enrôlement, état et heartbeat, mode veille, hors ligne)

La rubrique « Kiosques » vous donne une visibilité complète sur le parc d'appareils installés dans vos établissements.

### Tableau des kiosques
Le tableau liste les appareils associés à vos hôtels avec les colonnes suivantes :
- « Nom » : libellé identifiant l'appareil.
- « Hôtel » : nom de l'établissement auquel l'appareil est affecté.
- « État » : statut de fonctionnement et de connectivité du kiosque.
- « Dernier signal » : horodatage du dernier signal (« heartbeat ») reçu par le serveur (ou « — » si aucun signal n'a encore été enregistré).
- « Version » : version logicielle de l'application installée sur le kiosque (ou « — »).
- « Espace libre » : capacité de stockage disponible sur l'appareil en mégaoctets (« {{mb}} Mo » ou « — »).
- « Actions » : actions d'administration (boutons « Code d’enrôlement », « Forcer la synchronisation », « Désactiver », « Supprimer » — ces opérations techniques sont réservées au rôle administrateur de la plateforme).

### États de connexion (« État »)
L'état affiché pour chaque kiosque reflète sa situation opérationnelle :
- **« En ligne »** : le kiosque fonctionne normalement, est connecté à Internet et communique avec le serveur.
- **« Désynchronisé »** : le kiosque est en ligne mais son contenu local n'est pas encore à jour avec la dernière version de sélection enregistrée. Il téléchargera les nouveaux médias lors de sa prochaine synchronisation.
- **« Hors ligne »** : l'appareil n'a plus envoyé de signal au serveur depuis plus de 15 minutes (délai d'inactivité réseau de 15 minutes).
- **« En attente »** : l'appareil est déclaré dans le back-office mais n'a pas encore été associé physiquement via un code d'enrôlement.
- **« Désactivé »** : le kiosque a été désactivé administrativement.

### Enrôlement d'un appareil
- L'enrôlement est l'opération qui relie un appareil physique (écran tactile ou casque VR) à son enregistrement dans la plateforme.
- L'administrateur génère un « Code d'enrôlement » temporaire à 8 caractères majuscules ou chiffres (valide 15 minutes).
- Sur l'écran physique du kiosque neuf ou réinitialisé, l'écran « Enrôlement du kiosque » demande : « Saisissez le code d'enrôlement à 8 caractères pour associer cet appareil. ».
- Après saisie dans le champ « Code d'enrôlement » et validation par « Enrôler le kiosque », le kiosque télécharge son identité, son jeton de sécurité et le contenu de l'hôtel, puis bascule en état « En ligne ».

### Battement de cœur (« Heartbeat »)
- Chaque kiosque allumé et connecté envoie automatiquement un signal régulier au serveur toutes les 5 minutes.
- Ce battement de cœur transmet au serveur :
  - La version de l'application (« appVersion »).
  - La version du manifeste de contenu synchronisé (« syncedManifestVersion »).
  - L'espace de stockage disponible (« storageFreeMb »).
  - Les erreurs techniques éventuelles récemment rencontrées.
- En réponse, le serveur confirme la réception et peut notifier au kiosque qu'une nouvelle synchronisation immédiate est requise (« forceSync »).

### Mode veille
- Lorsque le kiosque ne reçoit aucune interaction tactile pendant un temps défini (délai configuré par l'administrateur, par défaut 90 secondes soit 1 minute 30), il entre automatiquement en mode veille.
- L'écran affiche alors une boucle d'animation présentant les visites cochées pour le « Mode veille » afin d'attirer l'attention des clients dans le hall ou l'espace d'accueil.
- Dès qu'un utilisateur touche l'écran (« Touchez l'écran pour explorer »), le kiosque se réveille instantanément et affiche la page d'accueil avec les visites de l'hôtel.

### Fonctionnement hors ligne
- Les kiosques Xplor sont conçus pour fonctionner de manière autonome sans interruption de service pour les voyageurs.
- Toutes les visites, scènes 360° et images de votre sélection sont téléchargées et conservées dans la mémoire locale de l'appareil (cache du navigateur / stockage local).
- **En cas de coupure Internet** :
  - Le kiosque continue de fonctionner normalement pour les utilisateurs. Les visites restent consultables sans ralentissement.
  - Les événements statistiques d'utilisation sont enregistrés localement sur l'appareil.
  - Dès que la connexion Internet est rétablie, le kiosque retransmet ses statistiques au serveur et renvoie son heartbeat.

---

## 5. Statistiques et export CSV

L'espace « Statistiques » vous permet de suivre l'intérêt des clients de votre hôtel pour les différentes visites virtuelles proposées.

### Accéder aux statistiques
Cliquez sur « Statistiques » dans la barre de navigation. L'écran affiche :
- Le titre « Statistiques » et le sous-titre « Activité des visites sur la période sélectionnée. ».

### Filtrer les données
Un formulaire de filtres vous permet de préciser la période et les critères d'analyse :
- **« Du » et « Au »** : définissez la date de début et la date de fin de la période (plage maximale de 366 jours consécutifs). Par défaut, les 30 derniers jours sont sélectionnés.
- **« Hôtel »** : sélectionnez l'établissement souhaité ou choisissez « Tous les hôtels accessibles » pour agréger l'ensemble des établissements qui vous sont attribués.
- **« Visite »** : filtrez sur une visite précise ou laissez « Toutes les visites ».
- **« Canal »** : filtrez par canal de diffusion (« Tous les canaux », « KIOSK », etc.).
- **« Langue »** : filtrez selon la langue choisie par les utilisateurs (« Toutes les langues », « Français », « العربية », « English »).
- Cliquez sur le bouton « Appliquer les filtres » pour rafraîchir les indicateurs.

### Indicateurs clés
Des cartes synthétiques présentent les mesures suivantes :
- **« Sessions »** : nombre total de sessions d'utilisation enregistrées.
- **« Durée moyenne »** : durée moyenne d'une session, exprimée en minutes (« min »).
- **« Visites ouvertes »** : nombre total d'ouvertures de visites virtuelles.
- **« Scènes vues »** : nombre total de panoramas à 360° visualisés.
- **« Clics sur les points »** : nombre d'interactions sur les points d'intérêt (hotspots) interactifs.
- **« Entrées VR »** : nombre de passages en mode réalité virtuelle (casque VR ou affichage immersif).
- **« Scans QR »** : nombre de fois où les visiteurs ont scanné le QR code d'une visite pour continuer l'exploration sur leur smartphone personnel.

### Graphiques et classements
- **« Sessions par jour »** : courbe d'évolution quotidienne du nombre de sessions.
- **« Sessions par heure (UTC) »** : répartition horaire de la fréquentation sur 24 heures pour identifier les heures de forte affluence.
- **« Visites les plus ouvertes »** : classement des visites virtuelles les plus populaires auprès de vos clients.
- **« Scènes les plus vues »** : classement des scènes 360° les plus consultées.
- **« Répartition par langue »** : volume de sessions par langue d'interface.
- **« Répartition par canal »** : répartition de l'usage entre les canaux disponibles.

### Exporter les données en CSV
1. Cliquez sur le bouton « Exporter en CSV » en haut à droite de la page.
2. Le bouton indique « Préparation du CSV… » pendant la génération du fichier.
3. Un fichier nommé `xplor-statistiques.csv` est téléchargé sur votre ordinateur.
4. **Format du fichier** :
   - Fichier texte encodé en UTF-8 avec marqueur BOM (garantissant l'ouverture immédiate et sans altération des accents sous Microsoft Excel et LibreOffice).
   - Séparateur point-virgule (`;`).
   - Contenu : tableau récapitulatif des indicateurs (« Indicateur », « Valeur »), suivi des données quotidiennes (« Jour », « Sessions », « Visites ouvertes », « Scènes vues ») et des classements des visites et scènes.

---

## 6. Kiosque hors ligne : que faire et qui contacter

Si un kiosque apparaît avec l'état « Hors ligne » dans votre back-office ou ne semble plus réagir sur place, suivez les étapes de vérification ci-dessous.

### Rappel sur le statut « Hors ligne »
Le statut « Hors ligne » signifie que le serveur central n'a reçu aucun signal (« heartbeat ») de cet appareil depuis au moins 15 minutes. Cela est généralement dû à une perte de connexion réseau locale ou à une coupure d'alimentation électrique.

### Vérifications sur le matériel
1. **Contrôle de l'alimentation électrique** :
   - Vérifiez que le cordon d'alimentation de l'écran ou de la borne est bien branché sur la prise secteur.
   - Assurez-vous que l'interrupteur ou la multiprise n'est pas éteint.
   - Si l'écran est noir, appuyez sur le bouton de mise sous tension de l'appareil.
2. **Contrôle de l'écran tactile** :
   - Si l'écran affiche une image mais ne réagit pas, touchez fermement la surface pour quitter le mode veille (« Touchez l'écran pour explorer »).
   - Si l'application affiche « Service momentanément indisponible », l'appareil n'arrive pas à charger les éléments de démarrage ou est en cours de réinitialisation.
3. **Contrôle de la connexion réseau de l'hôtel** :
   - **En connexion filaire (Ethernet)** : vérifiez que le câble RJ45 est correctement clipsé au dos de l'appareil et sur la prise murale. Vérifiez les voyants lumineux du port réseau (vert/orange clignotant).
   - **En connexion sans fil (Wi-Fi)** : vérifiez que le réseau Wi-Fi de l'établissement fonctionne normalement sur d'autres équipements (smartphone, ordinateur de réception). Assurez-vous que le signal est suffisant à l'endroit où la borne est installée.
   - Vérifiez si un portail captif hôtelier ou une modification du mot de passe Wi-Fi a pu déconnecter l'appareil.
4. **Redémarrage électrique simple** :
   - Débranchez la prise électrique de l'appareil (ou coupez l'alimentation).
   - Patientez 15 à 30 secondes.
   - Rebranchez l'alimentation. Le kiosque démarre automatiquement son système et relance l'application Xplor en plein écran.

### Écran de maintenance sur le kiosque (personnel autorisé)
Sur l'appareil physique, un écran technique est prévu pour les opérations de dépannage sur site :
- L'écran « Maintenance » affiche le sous-titre « Saisissez le code PIN de l'hôtel pour déverrouiller l'écran technique. ».
- Saisissez le code PIN à 4 chiffres configuré pour votre hôtel (« Code PIN ») et validez par « Valider ». En cas de saisie erronée, l'écran affiche « Code PIN incorrect. ».
- L'écran « État du kiosque » présente :
  - « Version de l'application »
  - « Version du manifeste »
  - « Dernière synchronisation »
  - « État de la synchronisation » (« Synchronisé » ou « Erreurs de synchronisation »)
  - « Visites en échec » (« Aucune visite en échec » ou liste des éléments)
- L'action « Forcer la synchronisation » permet de relancer immédiatement le téléchargement des contenus en attente.
- L'action « Réenrôler » réinitialise complètement les données locales de l'appareil après confirmation (« Voulez-vous vraiment réenrôler ce kiosque ? Toutes les données locales seront réinitialisées. »).

### Qui contacter si le dysfonctionnement persiste
Si le kiosque demeure « Hors ligne » ou indisponible après vérification de l'alimentation, du réseau et redémarrage :
1. **Contactez l'administrateur de la plateforme Xplor** (ou l'équipe de support technique désignée par votre organisation).
2. **Préparez et transmettez les informations suivantes** relevées sur votre back-office ou sur l'appareil :
   - Le « Nom » du kiosque (ex. mentionné dans votre tableau de bord).
   - Le nom de votre établissement (« Hôtel »).
   - La date et l'heure du « Dernier signal » affichées dans votre tableau de bord.
   - La « Version » de l'application et l'« Espace libre » restant.
   - La description précise du comportement constaté (ex. écran noir, voyant éteint, message d'erreur textuel à l'écran).
