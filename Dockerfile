FROM node:18-alpine

WORKDIR /app

# Copier package.json
COPY api/package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier tout le projet
COPY . ./

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Exposer le port
EXPOSE 3000

# Lancer le serveur
CMD ["npm", "start"]
