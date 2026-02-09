# Qui veut passer pour un teubé - Overlay Interactif OBS

Système local d'overlay interactif pour OBS Studio, permettant d'animer un jeu de questions/réponses en direct.

## Prérequis

- **Node.js** version 18 ou supérieure ([télécharger](https://nodejs.org/))
- **OBS Studio** ([télécharger](https://obsproject.com/))
- Un **Google Spreadsheet** avec les questions du jeu
- Un **compte de service Google** pour accéder au spreadsheet

## Installation

### 1. Configuration Google Sheets

1. Créez un projet sur [Google Cloud Console](https://console.cloud.google.com/)
2. Activez l'API Google Sheets
3. Créez un compte de service et téléchargez le fichier JSON de credentials
4. Placez le fichier dans `server/credentials/service-account.json`
5. Partagez votre Google Spreadsheet avec l'email du compte de service (en lecture)

### 2. Configuration du projet

1. Copiez `.env.example` en `.env`
2. Remplissez `GOOGLE_SHEETS_ID` avec l'ID de votre spreadsheet
   - L'ID se trouve dans l'URL : `https://docs.google.com/spreadsheets/d/VOTRE_ID_ICI/edit`
3. Vérifiez que le chemin vers les credentials est correct

### 3. Lancement

Double-cliquez sur `start.bat` ou exécutez :

```bash
cd server
npm install
node index.js
```

## Utilisation

### Interface Admin

Ouvrez `http://localhost:3000/admin` dans votre navigateur.

- Sélectionnez une question dans la liste (filtrable par matière, catégorie, thème, niveau)
- Cliquez sur une proposition pour valider la réponse
- Utilisez les boutons pour révéler, avancer, afficher les scores ou réinitialiser
- Gérez les scores des joueurs avec les boutons +1/-1

### Overlay OBS

1. Dans OBS, ajoutez une **Source Navigateur** (Browser Source)
2. URL : `http://localhost:3000/overlay`
3. Dimensions : 1920 x 1080
4. Le fond est transparent — l'overlay se superpose à votre contenu

### Rafraîchir les données

Si vous modifiez le Google Spreadsheet en cours de jeu :
- Cliquez sur **Rafraîchir** dans l'interface admin
- Les nouvelles données seront chargées immédiatement

## Structure du Google Spreadsheet

Le spreadsheet doit contenir 5 onglets :

- **Questions** : `ID, IDTheme, Question, Right_Answer, Proposition1, Proposition2, Proposition3, Explications, Type_Question`
- **Theme** : `ID, IDCategory, IDLevel, Name, Description`
- **Category** : `ID, Name, Start_Date, End_Date, IDMatiere`
- **Level** : `ID, Libel`
- **Matiere** : `ID, Nom`

## Architecture

```
├── server/          # Backend Node.js (Express + Socket.IO)
├── admin/           # Interface d'administration
├── overlay/         # Overlay pour OBS
├── docs/            # Documentation
├── .env             # Configuration
└── start.bat        # Script de lancement
```
