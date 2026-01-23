# Quiz Overlay pour OBS

Overlay HTML/CSS/JS façon jeu TV + panneau admin léger pour piloter les questions, le timer et la révélation des réponses. Compatible avec une source navigateur OBS (fond transparent).

> **🆕 v1.1 - Améliorations** : Sécurité renforcée (CORS + API Key), architecture refactorisée, logging centralisé, validation des données, documentation complète.

## 📚 Documentation rapide

- **[🚀 QUICK_START.md](./QUICK_START.md)** - COMMENCEZ PAR LÀ ! (30 secondes)
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Endpoints API, configuration, Google Sheets
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - Architecture technique 
- [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) - Sécurité et bonnes pratiques

## Structure

- overlay/ : fichiers affichés dans la source navigateur OBS
- admin/ : panneau de contrôle (ouvrir dans un navigateur)
- data/questions.json : banque de questions locale
- api/server.js : API optionnelle `/random` (Node.js)

## Lancer rapidement (sans API)

1. Ouvrez `overlay/index.html` dans OBS via une Browser Source (URL file:// ou http:// via un petit serveur local).
2. Ouvrez `admin/admin.html` dans votre navigateur pour piloter l'overlay.
3. Boutons :
   - "Nouvelle question" charge une question aléatoire (JSON local ou API si disponible)
   - "Révéler la réponse" met en surbrillance la bonne proposition
   - "Relancer le timer" repart le compte à rebours avec la durée saisie

Communication overlay/admin : `BroadcastChannel` (même machine / même origine). Un fallback `localStorage` est présent si BroadcastChannel n'est pas disponible.

## Option API Node.js

Si vous préférez servir les questions via une API :

```bash
cd api
npm install express cors googleapis
node server.js
```

L'endpoint `GET /random` renvoie une question tirée de `data/questions.json`.

### Connexion Google Sheets (service account)

1) Dans Google Cloud Console :
- Créez un projet, activez "Google Sheets API".
- Créez un compte de service, générez une clé JSON.
- Notez `client_email` et `private_key`.

2) Dans le Sheet : partagez le document avec l'email du compte de service en "Lecteur".

3) Structure attendue du Google Sheets (5 onglets) :
- **Questions** : ID, IDTheme, IDLevel, Question, Right_Answer, Proposition1, Proposition2, Proposition3, Explications, Type_Question
- **Theme** : ID, IDCategory, Name, Description
- **Category** : ID, Name, Start_Date, End_Date, IDMatiere
- **Level** : ID, Libel
- **Matiere** : ID, Nom

4) Variables d'environnement à définir (ou un fichier `.env` chargé avant `node server.js`) :
- `GOOGLE_SHEETS_ID` : l'ID du Sheet (entre `/d/` et `/edit`).
- `GOOGLE_SHEETS_QUESTIONS_RANGE` : par défaut `Questions!A2:J`.
- `GOOGLE_SHEETS_THEMES_RANGE` : par défaut `Theme!A2:D`.
- `GOOGLE_SHEETS_CATEGORIES_RANGE` : par défaut `Category!A2:E`.
- `GOOGLE_SHEETS_LEVELS_RANGE` : par défaut `Level!A2:B`.
- `GOOGLE_SHEETS_MATIERES_RANGE` : par défaut `Matiere!A2:B`.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` : `client_email` de la clé JSON.
- `GOOGLE_SERVICE_ACCOUNT_KEY` : `private_key` avec les sauts de ligne échappés (`\n`).

5) Lancement :

```bash
# Exemple PowerShell
$env:GOOGLE_SHEETS_ID="<votre_sheet_id>"
$env:GOOGLE_SERVICE_ACCOUNT_EMAIL="<service_account@project.iam.gserviceaccount.com>"
$env:GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
node server.js
```

L'API tentera d'abord de lire le Sheet, sinon elle retombera sur `data/questions.json`.

## Conseils OBS

- Activez "Custom CSS" transparent si nécessaire, mais le fond est déjà transparent.
- Désactivez "Use hardware acceleration" si vous constatez des problèmes de rendu avec certaines cartes.
- Résolution conseillée de la source : 1920x200 pour un bandeau bas, mais le layout est responsive.

## Personnalisation

- Ajustez les couleurs et animations dans `overlay/style.css`.
- Changez la durée par défaut dans `overlay/script.js` (`DEFAULT_DURATION`).
- Ajoutez/éditez des questions dans `data/questions.json`.

## Limitations connues

- BroadcastChannel nécessite l'ouverture overlay/admin depuis la même origine. Sinon utilisez l'API et servez les deux via le même serveur local.
- Pas de persistance des états entre rechargements : l'admin redemande l'état à l'ouverture.
