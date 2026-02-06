# Quiz Overlay pour OBS

Overlay HTML/CSS/JS façon jeu TV + panneau admin léger pour piloter les questions, le timer et la révélation des réponses. Compatible avec une source navigateur OBS (fond transparent).

> **🆕 v1.1** – Sécurité (CORS + API Key), déploiement Fly.io.

## 📚 Documentation

- **[📖 Documentation complète](./docs/DOCUMENTATION.md)** – Vue d’ensemble, API, configuration, dépannage
- **[🔒 Sécurité et clé API](./docs/SECURITE_API_KEY.md)** – Configurer la clé API en production

## Structure

```
Interface OBS Jeu/
├── server.js           # Serveur Express unifié
├── package.json        # Dépendances et scripts npm
├── fly.toml            # Configuration déploiement Fly.io
├── Dockerfile          # Image Docker (utilisée par Fly.io)
├── admin/              # Panneau de contrôle (navigateur)
├── api/                # API backend Node.js (router Express)
├── data/               # Données JSON (questions, niveaux, catégories, thèmes)
├── docs/               # Documentation
└── overlay/            # Fichiers pour la source navigateur OBS
```

## 🚀 Lancer en local

```bash
npm install
npm start
```

Le serveur écoute sur le port 3000 (ou la variable `PORT`). Puis :

- **OBS** : ajoutez une source *Browser* avec l’URL `http://localhost:3000/overlay`
- **Admin** : ouvrez `http://localhost:3000/admin` dans votre navigateur

En production (Fly.io), le port est 8080 et l’URL sera celle de votre app (ex. `https://interface-obs-jeu.fly.dev`).

## ☁️ Déploiement sur Fly.io

Le projet est prêt pour un déploiement sur [Fly.io](https://fly.io) (pas de mise en veille, bonne réactivité).

### Prérequis

- Compte [Fly.io](https://fly.io)
- [flyctl](https://fly.io/docs/hands-on/install-flyctl/) installé

### Première fois

1. **Connexion**
   ```bash
   fly auth login
   ```

2. **Création de l’app et déploiement**
   ```bash
   fly launch
   ```
   - Conservez le nom d’app proposé ou choisissez-en un (ex. `interface-obs-jeu`).
   - Ne créez pas de base Postgres si demandé.
   - Le premier déploiement se lance après la configuration.

3. **Variables d’environnement obligatoires**
   ```bash
   fly secrets set API_KEY="votre-cle-secrete-forte"
   fly secrets set ALLOWED_ORIGINS="https://votre-app.fly.dev,https://votre-app.fly.dev/overlay,https://votre-app.fly.dev/admin"
   ```
   Remplacez `votre-app` par le nom de votre application Fly (visible dans `fly.toml` ou avec `fly status`).

4. **Google Sheets (obligatoire si vous utilisez un Sheet)**  
   Sur Fly.io le fichier `.env` n’est pas déployé. Pour que les questions viennent de Google Sheets, définissez les **secrets** suivants (sinon l’app utilisera les JSON locaux dans `data/`) :
   ```bash
   fly secrets set GOOGLE_SHEETS_ID="votre_id_sheet"
   fly secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL="votre-compte@projet.iam.gserviceaccount.com"
   fly secrets set GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\nVOTRE_CLE_SUR_UNE_LIGNE_AVEC_\n_POUR_LES_RETOURS_CHARIOT\n-----END PRIVATE KEY-----\n"
   ```
   Pour la clé privée : utilisez la même valeur que dans votre `.env` (avec des `\n` littéraux pour les retours à la ligne). Sous PowerShell, vous pouvez mettre la valeur entre guillemets simples pour éviter l’interprétation des échappements. Après avoir défini les secrets, redéployez (`fly deploy`).  
   Pour vérifier que le serveur voit bien la config : ouvrez `https://votre-app.fly.dev/api/health` et regardez si `sheetsConfigured` est `true`.

### Déploiements suivants

```bash
fly deploy
```

### URLs après déploiement

- **Overlay OBS** : `https://<votre-app>.fly.dev/overlay`
- **Admin** : `https://<votre-app>.fly.dev/admin`
- **API** : `https://<votre-app>.fly.dev/api` (ex. `/api/health`, `/api/random`)

**Lien entre les deux interfaces** : admin et overlay doivent utiliser la **même base** (même app Fly.io). En ouvrant l’admin et l’overlay depuis les URLs ci-dessus, ils utilisent automatiquement la même API. Dans OBS, configure la source *Browser* avec l’URL de l’overlay (ex. `https://<votre-app>.fly.dev/overlay`). Si besoin de forcer l’API (contexte particulier), ajoute `?apiBase=https://<votre-app>.fly.dev` à l’URL de l’admin ou de l’overlay.

Pensez à mettre à jour `ALLOWED_ORIGINS` si vous changez de domaine ou d’app.

## Option : sans serveur (mode local uniquement)

1. Ouvrez `overlay/index.html` dans OBS (source Browser, URL en `file://`).
2. Ouvrez `admin/admin.html` dans le navigateur.

Communication overlay/admin via `BroadcastChannel` (même machine / même origine). Fallback `localStorage` si besoin.

## API Node.js

Le serveur expose notamment :

- `/overlay` – Interface overlay pour OBS
- `/admin` – Panneau d’administration
- `/api` – API REST (`/api/random`, `/api/health`, etc.)

`GET /api/random` renvoie une question depuis `data/questions.json` ou depuis Google Sheets si configuré.

### Connexion Google Sheets (compte de service)

1. **Google Cloud Console** : créez un projet, activez « Google Sheets API », créez un compte de service et récupérez une clé JSON (`client_email`, `private_key`).
2. **Sheet** : partagez le document avec l’email du compte de service en « Lecteur ».
3. **Structure** : onglets **Questions**, **Theme**, **Category**, **Level**, **Matiere** (détails dans [DOCUMENTATION.md](./docs/DOCUMENTATION.md)).
4. **Variables d’environnement** (ou `.env` en local) : `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_KEY`, et optionnellement les plages (`GOOGLE_SHEETS_QUESTIONS_RANGE`, etc.). Voir `.env.example`.

Sans Google Sheets, l’API utilise `data/questions.json`.

## Conseils OBS

- Fond déjà transparent ; « Custom CSS » transparent si besoin.
- Désactiver « Use hardware acceleration » en cas de souci de rendu.
- Résolution conseillée de la source : 1920×200 (bandeau bas), layout responsive.

## Personnalisation

- Couleurs et animations : `overlay/style.css`
- Durée par défaut : `overlay/script.js` (`DEFAULT_DURATION`)

## Limitations connues

- Overlay et admin doivent être servis depuis la même origine (ou configurer CORS / `ALLOWED_ORIGINS`).
- Pas de persistance des états entre rechargements ; l’admin redemande l’état à l’ouverture.
