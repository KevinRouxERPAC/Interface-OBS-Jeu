# Quiz Overlay pour OBS

Overlay HTML/CSS/JS façon jeu TV + panneau admin léger pour piloter les questions, le timer et la révélation des réponses. Compatible avec une source navigateur OBS (fond transparent).

**Données** : la base de données est votre **Google Sheet**. À chaque lancement du projet, l’app importe tout (questions, thèmes, catégories, niveaux, matières) dans les fichiers JSON locaux (`data/`). Ensuite, plus aucune connexion internet n’est nécessaire pendant l’utilisation.

## 📚 Documentation

- **[📖 Documentation complète](./docs/DOCUMENTATION.md)** – Vue d’ensemble, API, configuration, dépannage

## Structure

```
Interface OBS Jeu/
├── server.js           # Serveur Express unifié
├── package.json        # Dépendances et scripts npm
├── admin/              # Panneau de contrôle (navigateur)
├── api/                # API backend Node.js (router Express)
├── data/               # Données JSON (remplies au démarrage depuis Google Sheets)
├── docs/               # Documentation
└── overlay/            # Fichiers pour la source navigateur OBS
```

## 🚀 Lancer le projet

```bash
npm install
npm start
```

Au **premier démarrage** (avec Google Sheets configuré dans `api/.env`), l’app récupère toutes les données du Sheet et les écrit dans `data/*.json`. Ensuite le serveur écoute sur le port 3000.

- **OBS** : source *Browser* → `http://localhost:3000/overlay`
- **Admin** : `http://localhost:3000/admin`

Une fois le sync fait, vous pouvez couper internet : l’app lit uniquement les JSON locaux.

## Configuration Google Sheets (obligatoire pour la base de questions)

1. **Google Cloud Console** : créez un projet, activez « Google Sheets API », créez un **compte de service** et récupérez la clé JSON (`client_email`, `private_key`).
2. **Sheet** : partagez le document avec l’email du compte de service en **Lecteur**.
3. **Structure du Sheet** : onglets **Questions**, **Theme**, **Category**, **Level**, **Matiere** (détails dans [DOCUMENTATION.md](./docs/DOCUMENTATION.md)).
4. **Fichier `api/.env`** (copiez depuis `.env.example`) :
   - `GOOGLE_SHEETS_ID` : l’ID du tableur (dans l’URL)
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` : l’email du compte de service
   - `GOOGLE_SERVICE_ACCOUNT_KEY` : la clé privée (coller avec `\n` pour les retours à la ligne)

Optionnel : `ALLOWED_ORIGINS`, `PORT`. Voir `.env.example`.

Sans Google Sheets configuré, l’app démarre quand même et utilise les JSON déjà présents dans `data/` (utile si vous avez déjà fait un sync une fois).

## API

- `/overlay` – Interface overlay pour OBS
- `/admin` – Panneau d’administration
- `/api` – API REST (`/api/random`, `/api/health`, `/api/matieres`, etc.)

Les réponses viennent toujours des **fichiers locaux** `data/*.json`, mis à jour au démarrage depuis Google Sheets.

## Conseils OBS

- Fond déjà transparent ; « Custom CSS » transparent si besoin.
- Désactiver « Use hardware acceleration » en cas de souci de rendu.
- Résolution conseillée de la source : 1920×200 (bandeau bas), layout responsive.

## Personnalisation

- Couleurs et animations : `overlay/style.css`
- Durée par défaut : `overlay/script.js` (`DEFAULT_DURATION`)
