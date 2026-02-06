FROM node:18-alpine

WORKDIR /app

# Copier package.json à la racine
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier tout le projet
COPY . ./

# Health check (utilise /api/health)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Port utilisé par Fly.io (ou 3000 en local)
EXPOSE 8080

# Lancer le serveur
CMD ["npm", "start"]
